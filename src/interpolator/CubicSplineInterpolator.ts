import { J2000 } from '../coordinate/J2000';
import { EpochUTC } from '../time/EpochUTC';
import { EpochWindow } from '../time/EpochWindow';
import { CubicSpline } from './CubicSpline';
import { StateInterpolator } from './StateInterpolator';

/**
 * Cubic spline ephemeris interpolator.
 *
 * The [CubicSplineInterpolator] is a very fast and accurate interpolator
 * at the expense of memory due to the cached spline pairs used in the
 * interpolation operation. Accuracy is significantly impacted when using
 * sparse ephemerides.
 */
export class CubicSplineInterpolator extends StateInterpolator {
  constructor(private _splines: CubicSpline[]) {
    super();
  }

  static fromEphemeris(ephemeris: J2000[]): CubicSplineInterpolator {
    const splines: CubicSpline[] = [];

    for (let i = 0; i < ephemeris.length - 1; i++) {
      const e0 = ephemeris[i];
      const t0 = e0.epoch.posix;
      const p0 = e0.position;
      const m0 = e0.velocity;
      const e1 = ephemeris[i + 1];
      const t1 = e1.epoch.posix;
      const p1 = e1.position;
      const m1 = e1.velocity;

      splines.push(new CubicSpline(t0, p0, m0, t1, p1, m1));
    }

    return new CubicSplineInterpolator(splines);
  }

  get sizeBytes(): number {
    return (64 * 14 * this._splines.length) / 8;
  }

  private _matchSpline(posix: number): CubicSpline {
    let left = 0;
    let right = this._splines.length;

    while (left < right) {
      const middle = (left + right) >> 1;

      if (this._splines[middle].t1 < posix) {
        left = middle + 1;
      } else {
        right = middle;
      }
    }

    return this._splines[left];
  }

  interpolate(epoch: EpochUTC): J2000 | null {
    if (!this.inWindow(epoch)) {
      return null;
    }
    const posix = epoch.posix;
    const splineVecs = this._matchSpline(posix).interpolate(posix);

    return new J2000(epoch, splineVecs[0], splineVecs[1]);
  }

  window(): EpochWindow {
    return new EpochWindow(new EpochUTC(this._splines[0].t0), new EpochUTC(this._splines[this._splines.length - 1].t1));
  }
}
