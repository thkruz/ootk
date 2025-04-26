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

import { EpochUTC, EpochWindow, J2000, Kilometers, KilometersPerSecond, Vector3D } from '../main.js';
import { CubicSpline } from './CubicSpline.js';
import { StateInterpolator } from './StateInterpolator.js';

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

  private matchSpline_(posix: number): CubicSpline {
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
    const splineVecs = this
      .matchSpline_(posix)
      .interpolate(posix) as [Vector3D<Kilometers>, Vector3D<KilometersPerSecond>];

    return new J2000(epoch, splineVecs[0], splineVecs[1]);
  }

  window(): EpochWindow {
    return new EpochWindow(new EpochUTC(this._splines[0].t0), new EpochUTC(this._splines[this._splines.length - 1].t1));
  }
}
