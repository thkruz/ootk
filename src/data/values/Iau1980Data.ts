/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2024 Theodore Kruczek Permission is
 * hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { iau1980 } from './iau1980.js';

// / IAU a1, a2, a3, a4, a5, Ai, Bi, Ci, Di coefficients.
export type Iau1980Entry = [number, number, number, number, number, number, number, number, number];

// / Container for IAU-1980 data.
export class Iau1980Data {
  private _coeffs: Iau1980Entry[];

  // / Create a new [Iau1980Data] object.
  constructor(coeffs: Iau1980Entry[]) {
    this._coeffs = coeffs;
  }

  /**
   * Create a new [Iau1980Data] container object from an array of IAU-1980
   * coefficient tuples [coeffs].
   * @param coeffs IAU-1980 coefficients.
   * @returns A new [Iau1980Data] object.
   */
  static fromCoeffs(coeffs: Array<Iau1980Entry>): Iau1980Data {
    const output: Iau1980Entry[] = [];

    for (const c of coeffs) {
      const [a1, a2, a3, a4, a5, ai, bi, ci, di] = c;

      output.push([a1, a2, a3, a4, a5, ai, bi, ci, di]);
    }

    return new Iau1980Data(output);
  }

  // / Get IAU-1980 coefficients for a given row number.
  getCoeffs(row: number): Iau1980Entry {
    return this._coeffs[row];
  }
}

// / IAU-1980 data container.
export const iau1980Data = Iau1980Data.fromCoeffs(iau1980);
