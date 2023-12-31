import { EpochUTC } from '@src/time/EpochUTC';
import { EpochWindow } from '@src/time/EpochWindow';
import { Earth } from '../body/Earth';
import { J2000 } from '../coordinate/J2000';
import { copySign } from '../operations/functions';
import { Vector3D } from '../operations/Vector3D';
import { CubicSplineInterpolator } from './CubicSplineInterpolator';
import { LagrangeInterpolator } from './LagrangeInterpolator';
import { StateInterpolator } from './StateInterpolator';

/**
 * Two-body Velocity Verlet Blend interpolator.
 *
 * The [VerletBlendInterpolator] retains the original ephemerides, so the
 * original _"truth"_ states can be retrieved if needed without imparting any
 * additional error, so this can be used to build other interpolator types.
 * The implementation is simple and very tolerant when working with sparse
 * ephemerides.
 */
export class VerletBlendInterpolator extends StateInterpolator {
  constructor(public ephemeris: J2000[]) {
    super();
  }

  get sizeBytes(): number {
    return (64 * 7 * this.ephemeris.length) / 8;
  }

  window(): EpochWindow {
    return new EpochWindow(this.ephemeris[0].epoch, this.ephemeris[this.ephemeris.length - 1].epoch);
  }

  private static _getClosest(target: number, s1: J2000, s2: J2000): J2000 {
    return target - s1.epoch.posix >= s2.epoch.posix - target ? s2 : s1;
  }

  private _matchState(epoch: EpochUTC): J2000 {
    const target = epoch.posix;

    if (target <= this.ephemeris[0].epoch.posix) {
      return this.ephemeris[0];
    }
    if (target >= this.ephemeris[this.ephemeris.length - 1].epoch.posix) {
      return this.ephemeris[this.ephemeris.length - 1];
    }

    let i = 0;
    let j = this.ephemeris.length;
    let mid = 0;

    while (i < j) {
      mid = (i + j) >> 1;
      if (this.ephemeris[mid].epoch.posix === target) {
        return this.ephemeris[mid];
      }
      if (target < this.ephemeris[mid].epoch.posix) {
        if (mid > 0 && target > this.ephemeris[mid - 1].epoch.posix) {
          return VerletBlendInterpolator._getClosest(target, this.ephemeris[mid - 1], this.ephemeris[mid]);
        }
        j = mid;
      } else {
        if (mid < this.ephemeris.length - 1 && target < this.ephemeris[mid + 1].epoch.posix) {
          return VerletBlendInterpolator._getClosest(target, this.ephemeris[mid], this.ephemeris[mid + 1]);
        }
        i = mid + 1;
      }
    }

    return this.ephemeris[mid];
  }

  private static _gravity(position: Vector3D): Vector3D {
    const r = position.magnitude();

    return position.scale(-Earth.mu / (r * r * r));
  }

  private static _integrate(state: J2000, step: number): J2000 {
    const x0 = state.position;
    const a0 = VerletBlendInterpolator._gravity(x0);
    const v0 = state.velocity;
    const x1 = x0.add(v0.scale(step)).add(a0.scale(0.5 * step * step));
    const a1 = VerletBlendInterpolator._gravity(x1);
    const v1 = v0.add(a0.add(a1).scale(0.5 * step));

    return new J2000(state.epoch.roll(step), x1, v1);
  }

  interpolate(epoch: EpochUTC): J2000 | null {
    if (!this.inWindow(epoch)) {
      return null;
    }
    let state = this._matchState(epoch);

    while (state.epoch.posix !== epoch.posix) {
      const delta = epoch.posix - state.epoch.posix;
      const stepMag = Math.min(5.0, Math.abs(delta));
      const stepSize = copySign(stepMag, delta);

      state = VerletBlendInterpolator._integrate(state, stepSize);
    }

    return state;
  }

  getCachedState(epoch: EpochUTC): J2000 | null {
    if (!this.inWindow(epoch)) {
      return null;
    }

    return this._matchState(epoch);
  }

  toCubicSpline(): CubicSplineInterpolator {
    return CubicSplineInterpolator.fromEphemeris(this.ephemeris);
  }

  toLagrange(order = 10): LagrangeInterpolator {
    return LagrangeInterpolator.fromEphemeris(this.ephemeris, order);
  }
}
