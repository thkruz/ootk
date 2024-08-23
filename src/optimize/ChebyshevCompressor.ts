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

import { StateInterpolator } from '../interpolator/StateInterpolator.js';
import { EpochUTC, Seconds, Vector3D } from '../main.js';
import { ChebyshevCoefficients } from './../interpolator/ChebyshevCoefficients.js';
import { ChebyshevInterpolator } from './../interpolator/ChebyshevInterpolator.js';

// / Ephemeris compressor.
export class ChebyshevCompressor {
  // / Create a new [ChebyshevCompressor] object from an [Interpolator].
  constructor(private _interpolator: StateInterpolator) {
    // Do nothing.
  }

  // / Return the cosine of π times [x].
  private static _cosPi(x: number): number {
    return Math.cos(Math.PI * x);
  }

  private _fitCoefficient(j: number, n: number, a: number, b: number): Vector3D {
    let sumX = 0.0;
    let sumY = 0.0;
    let sumZ = 0.0;
    const h = 0.5;

    for (let i = 0; i < n; i++) {
      const x = ChebyshevCompressor._cosPi((i + h) / n);
      const seconds = x * (h * (b - a)) + h * (b + a) as Seconds;
      const state = this._interpolator.interpolate(new EpochUTC(seconds))!;
      const fx = state.position.x;
      const fy = state.position.y;
      const fz = state.position.z;
      const nFac = ChebyshevCompressor._cosPi((j * (i + h)) / n);

      sumX += fx * nFac;
      sumY += fy * nFac;
      sumZ += fz * nFac;
    }

    return new Vector3D(sumX * (2 / n), sumY * (2 / n), sumZ * (2 / n));
  }

  private _fitWindow(coeffs: number, a: Seconds, b: Seconds): ChebyshevCoefficients {
    const cx = new Float64Array();
    const cy = new Float64Array();
    const cz = new Float64Array();

    for (let j = 0; j < coeffs; j++) {
      const result = this._fitCoefficient(j, coeffs, a, b);

      cx[j] = result.x;
      cy[j] = result.y;
      cz[j] = result.z;
    }

    return new ChebyshevCoefficients(a, b, cx, cy, cz);
  }

  /**
   * Compress this object's interpolater, using the provided coefficients
   * per revolution [cpr].
   * @param cpr Coefficients per revolution.
   * @returns A new [ChebyshevInterpolator] object.
   */
  compress(cpr = 21): ChebyshevInterpolator {
    const { start, end } = this._interpolator.window();
    const period = this._interpolator.interpolate(start)!.period;
    const coefficients: ChebyshevCoefficients[] = [];
    let current = start;

    while (current < end) {
      const step = Math.min(period, end.posix - current.posix) as Seconds;
      const segment = current.roll(step);

      coefficients.push(this._fitWindow(cpr, current.posix, segment.posix));
      current = segment;
    }

    return new ChebyshevInterpolator(coefficients);
  }
}
