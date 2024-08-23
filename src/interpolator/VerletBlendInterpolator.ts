/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

import { Earth, EpochUTC, EpochWindow, J2000, Kilometers, KilometersPerSecond, Seconds, Vector3D, copySign } from '../main.js';
import { CubicSplineInterpolator } from './CubicSplineInterpolator.js';
import { LagrangeInterpolator } from './LagrangeInterpolator.js';
import { StateInterpolator } from './StateInterpolator.js';

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

  private static getClosest_(target: number, s1: J2000, s2: J2000): J2000 {
    return target - s1.epoch.posix >= s2.epoch.posix - target ? s2 : s1;
  }

  private matchState_(epoch: EpochUTC): J2000 {
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
          return VerletBlendInterpolator.getClosest_(target, this.ephemeris[mid - 1], this.ephemeris[mid]);
        }
        j = mid;
      } else {
        if (mid < this.ephemeris.length - 1 && target < this.ephemeris[mid + 1].epoch.posix) {
          return VerletBlendInterpolator.getClosest_(target, this.ephemeris[mid], this.ephemeris[mid + 1]);
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

  private static integrate_(state: J2000, step: Seconds): J2000 {
    const x0 = state.position;
    const a0 = VerletBlendInterpolator._gravity(x0) as Vector3D<KilometersPerSecond>;
    const v0 = state.velocity;
    const x1 = x0
      .add(v0.scale(step) as unknown as Vector3D<Kilometers>)
      .add(a0.scale(0.5 * step * step) as unknown as Vector3D<Kilometers>);
    const a1 = VerletBlendInterpolator._gravity(x1) as Vector3D<KilometersPerSecond>;
    const v1 = v0
      .add(a0.add(a1).scale(0.5 * step) as Vector3D<KilometersPerSecond>);

    return new J2000(state.epoch.roll(step), x1, v1);
  }

  interpolate(epoch: EpochUTC): J2000 | null {
    if (!this.inWindow(epoch)) {
      return null;
    }
    let state = this.matchState_(epoch);

    while (state.epoch.posix !== epoch.posix) {
      const delta = epoch.posix - state.epoch.posix;
      const stepMag = Math.min(5.0, Math.abs(delta));
      const stepSize = copySign(stepMag, delta) as Seconds;

      state = VerletBlendInterpolator.integrate_(state, stepSize);
    }

    return state;
  }

  getCachedState(epoch: EpochUTC): J2000 | null {
    if (!this.inWindow(epoch)) {
      return null;
    }

    return this.matchState_(epoch);
  }

  toCubicSpline(): CubicSplineInterpolator {
    return CubicSplineInterpolator.fromEphemeris(this.ephemeris);
  }

  toLagrange(order = 10): LagrangeInterpolator {
    return LagrangeInterpolator.fromEphemeris(this.ephemeris, order);
  }
}
