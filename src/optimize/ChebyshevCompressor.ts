/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
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

import { StateInterpolator } from '../interpolator/StateInterpolator';
import { EpochUTC } from '../time/EpochUTC';
import { Seconds } from '../types/types';
import { Vector3D } from '../operations/Vector3D';
import { ChebyshevCoefficients } from './../interpolator/ChebyshevCoefficients';
import { ChebyshevInterpolator } from './../interpolator/ChebyshevInterpolator';

/**
 * Compresses satellite ephemeris data using Chebyshev polynomial approximation.
 *
 * This class takes a StateInterpolator (which provides satellite positions at
 * arbitrary times) and creates a compact ChebyshevInterpolator that can
 * reproduce those positions using far less data.
 *
 * The compression works by:
 * 1. Dividing the time span into windows (one orbital period each)
 * 2. Fitting Chebyshev polynomial coefficients for X, Y, Z position components
 * 3. Sampling at Chebyshev nodes (cosine-spaced points) to minimize interpolation error
 *
 * This is useful for storing and transmitting ephemeris data efficiently in
 * mission planning software.
 *
 * @example
 * ```typescript
 * const compressor = new ChebyshevCompressor(ephemerisInterpolator);
 * const compressed = compressor.compress(21);
 * // Now use compressed.interpolate(epoch) to get positions
 * ```
 */
export class ChebyshevCompressor {
  /**
   * Creates a new ChebyshevCompressor from a StateInterpolator.
   * @param interpolator_ The source interpolator containing ephemeris data to compress.
   */
  constructor(private readonly interpolator_: StateInterpolator) {
    // Do nothing.
  }

  /** Returns the cosine of π times x. */
  private static cosPi_(x: number): number {
    return Math.cos(Math.PI * x);
  }

  /**
   * Fits a single Chebyshev coefficient for the j-th term.
   * @param j The coefficient index.
   * @param n The total number of coefficients.
   * @param a The start time of the window (POSIX seconds).
   * @param b The end time of the window (POSIX seconds).
   * @returns A Vector3D containing the X, Y, Z coefficients for this term.
   */
  private fitCoefficient_(j: number, n: number, a: number, b: number): Vector3D {
    let sumX = 0.0;
    let sumY = 0.0;
    let sumZ = 0.0;
    const h = 0.5;

    for (let i = 0; i < n; i++) {
      const x = ChebyshevCompressor.cosPi_((i + h) / n);
      const seconds = x * (h * (b - a)) + h * (b + a) as Seconds;
      const state = this.interpolator_.interpolate(new EpochUTC(seconds))!;
      const fx = state.position.x;
      const fy = state.position.y;
      const fz = state.position.z;
      const nFac = ChebyshevCompressor.cosPi_((j * (i + h)) / n);

      sumX += fx * nFac;
      sumY += fy * nFac;
      sumZ += fz * nFac;
    }

    return new Vector3D(sumX * (2 / n), sumY * (2 / n), sumZ * (2 / n));
  }

  /**
   * Fits all Chebyshev coefficients for a single time window.
   * @param coeffs The number of coefficients to fit.
   * @param a The start time of the window (POSIX seconds).
   * @param b The end time of the window (POSIX seconds).
   * @returns ChebyshevCoefficients for the X, Y, Z position components.
   */
  private fitWindow_(coeffs: number, a: Seconds, b: Seconds): ChebyshevCoefficients {
    const cx = new Float64Array(coeffs);
    const cy = new Float64Array(coeffs);
    const cz = new Float64Array(coeffs);

    for (let j = 0; j < coeffs; j++) {
      const result = this.fitCoefficient_(j, coeffs, a, b);

      cx[j] = result.x;
      cy[j] = result.y;
      cz[j] = result.z;
    }

    return new ChebyshevCoefficients(a, b, cx, cy, cz);
  }

  /**
   * Compresses the ephemeris data into a ChebyshevInterpolator.
   *
   * The time span is divided into windows of one orbital period each, and
   * Chebyshev coefficients are fitted for each window. Higher cpr values
   * provide more accuracy but less compression.
   *
   * @param cpr Coefficients per revolution. Default is 21, which provides
   *            a good balance between accuracy and compression.
   * @returns A new ChebyshevInterpolator that can reconstruct positions
   *          from the polynomial coefficients.
   */
  compress(cpr = 21, segmentDuration?: Seconds): ChebyshevInterpolator {
    const { start, end } = this.interpolator_.window();
    const period = segmentDuration ?? this.interpolator_.interpolate(start)!.period;
    const coefficients: ChebyshevCoefficients[] = [];
    let current = start;

    while (current < end) {
      const step = Math.min(period, end.posix - current.posix) as Seconds;
      const segment = current.roll(step);

      coefficients.push(this.fitWindow_(cpr, current.posix, segment.posix));
      current = segment;
    }

    return new ChebyshevInterpolator(coefficients);
  }
}
