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

import { Kilometers, KilometersPerSecond, Seconds, Vector3D } from '../main.js';

// / Container for cubic spline data.
export class CubicSpline {
  // / Create a new [CubicSpline] object.
  constructor(
    public t0: Seconds,
    public p0: Vector3D,
    public m0: Vector3D,
    public t1: Seconds,
    public p1: Vector3D,
    public m1: Vector3D,
  ) {
    // Nothing to do here.
  }

  // / Interpolate position at the provided time [t] _(POSIX seconds)_.
  private position_(t: Seconds): Vector3D<Kilometers> {
    const t2 = t * t;
    const t3 = t2 * t;
    const r0 = this.p0.scale(2 * t3 - 3 * t2 + 1);
    const v0 = this.m0.scale((t3 - 2 * t2 + t) * (this.t1 - this.t0));
    const r1 = this.p1.scale(-2 * t3 + 3 * t2);
    const v1 = this.m1.scale((t3 - t2) * (this.t1 - this.t0));

    return r0.add(v0).add(r1).add(v1) as Vector3D<Kilometers>;
  }

  // / Interpolate velocity at the provided time [t] _(POSIX seconds)_.
  private velocity_(t: Seconds): Vector3D<KilometersPerSecond> {
    const t2 = t * t;
    const r0 = this.p0.scale(6 * t2 - 6 * t);
    const v0 = this.m0.scale((3 * t2 - 4 * t + 1) * (this.t1 - this.t0));
    const r1 = this.p1.scale(-6 * t2 + 6 * t);
    const v1 = this.m1.scale((3 * t2 - 2 * t) * (this.t1 - this.t0));

    return r0
      .add(v0)
      .add(r1)
      .add(v1)
      .scale(1 / (this.t1 - this.t0)) as Vector3D<KilometersPerSecond>;
  }

  /**
   * Interpolates the position and velocity at a given time.
   * (km) and velocity (km/s) vectors at the provided time.
   * @param t The time value to interpolate at _(POSIX seconds)_.
   * @returns An array containing the interpolated position and velocity as Vector3D objects.
   */
  interpolate(t: Seconds): Vector3D[] {
    const n = (t - this.t0) / (this.t1 - this.t0) as Seconds;

    return [this.position_(n), this.velocity_(n)];
  }
}
