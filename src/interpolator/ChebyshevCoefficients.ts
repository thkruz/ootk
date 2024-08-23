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

import { Kilometers, KilometersPerSecond, PositionVelocity, Seconds, Vector3D } from '../main.js';


// / Chebyshev compressed ephemeris coefficients.
export class ChebyshevCoefficients {
  cxd_: Float64Array;
  cyd_: Float64Array;
  czd_: Float64Array;
  // / Create a new [ChebyshevCoefficients] object.
  constructor(
    public a: Seconds,
    public b: Seconds,
    private cx_: Float64Array,
    private cy_: Float64Array,
    private cz_: Float64Array,
  ) {
    this.cxd_ = ChebyshevCoefficients._derivative(a, b, cx_);
    this.cyd_ = ChebyshevCoefficients._derivative(a, b, cy_);
    this.czd_ = ChebyshevCoefficients._derivative(a, b, cz_);
  }

  /**
   * Calculates the derivative of a polynomial represented by Chebyshev coefficients.
   * @param a - The lower bound of the polynomial's domain.
   * @param b - The upper bound of the polynomial's domain.
   * @param c - The Chebyshev coefficients of the polynomial.
   * @returns The derivative of the polynomial as an array of coefficients.
   */
  private static _derivative(a: number, b: number, c: Float64Array): Float64Array {
    const n = c.length;
    const d = new Float64Array(n);

    d[n - 1] = 0;
    d[n - 2] = 2 * (n - 1) * c[n - 1];
    for (let k = n - 3; k >= 0; k--) {
      d[k] = d[k + 2] + 2 * (k + 1) * c[k + 1];
    }
    for (let k = 0; k < n; k++) {
      d[k] *= 2 / (b - a);
    }

    return d;
  }

  // / Return the size _(bytes)_ of this coefficient set's cached data.
  get sizeBytes(): number {
    return (64 * 2 + 64 * 3 * this.cx_.length) / 8;
  }

  /**
   * Evaluates the Chebyshev polynomial represented by the given coefficients at the specified value.
   * @param c - The coefficients of the Chebyshev polynomial.
   * @param t - The value at which to evaluate the polynomial _(POSIX seconds)_.
   * @returns The result of evaluating the polynomial at the specified value.
   */
  evaluate(c: Float64Array, t: number): number {
    const n = c.length;
    const x = (t - 0.5 * (this.b + this.a)) / (0.5 * (this.b - this.a));
    const alpha = 2 * x;
    const beta = -1;
    let y1 = 0.0;
    let y2 = 0.0;

    for (let k = n - 1; k >= 1; k--) {
      const tmp = y1;

      y1 = alpha * y1 + beta * y2 + c[k];
      y2 = tmp;
    }

    return x * y1 - y2 + 0.5 * c[0];
  }

  /**
   * Interpolates the position and velocity at a given time (km, km/s).
   * @param t - The time value to interpolate at _(POSIX seconds)_.
   * @returns An object containing the interpolated position and velocity.
   */
  interpolate(t: number): PositionVelocity {
    const pos = new Vector3D(
      this.evaluate(this.cx_, t) as Kilometers,
      this.evaluate(this.cy_, t) as Kilometers,
      this.evaluate(this.cz_, t) as Kilometers,
    );
    const vel = new Vector3D(
      this.evaluate(this.cxd_, t) as KilometersPerSecond,
      this.evaluate(this.cyd_, t) as KilometersPerSecond,
      this.evaluate(this.czd_, t) as KilometersPerSecond,
    );

    return { position: pos, velocity: vel };
  }
}
