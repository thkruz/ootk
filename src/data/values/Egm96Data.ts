/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2025 Theodore Kruczek Permission is
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

import { factorial } from '../../utils/functions.js';
import { egm96 } from './egm96.js';

// / EGM-96 entry for l, m indexes and clm, slm values.
export type Egm96Entry = [number, number, number, number];

// / Container for EGM-96 data.
export class Egm96Data {
  private readonly coeffs_: Egm96Entry[];

  // / Create a new [Egm96Data] object.
  constructor(coeffs: Egm96Entry[]) {
    this.coeffs_ = coeffs;
  }

  /**
   * Create a new [Egm96Data] container given a list of EGM-96
   * coefficient tuples [vals].
   * @param vals List of EGM-96 coefficient tuples.
   * @returns A new [Egm96Data] object.
   */
  static fromVals(vals: Egm96Entry[]): Egm96Data {
    const output: Egm96Entry[] = [];

    for (const v of vals) {
      const [l, m, clm, slm] = v;
      const k = m === 0 ? 1 : 2;
      const a = factorial(l + m);
      const b = factorial(l - m) * (k * (2 * l + 1));
      const nFac = Math.sqrt(a / b);
      const normalizedClm = clm / nFac;
      const normalizedSlm = slm / nFac;

      output.push([l, m, normalizedClm, normalizedSlm]);
    }

    return new Egm96Data(output);
  }

  // / Return de-normalized EGM-96 coefficients for a given [l] and [m] index.
  getCoeffs(l: number, m: number): Egm96Entry {
    return this.coeffs_[Egm96Data.index_(l, m)] as Egm96Entry;
  }

  // / Return the EGM-96 index for a given [l] and [m] lookup.
  private static index_(l: number, m: number): number {
    return (((l - 2) * (l + 2) + l) >> 1) - 1 + m;
  }
}

// / De-normalized EGM-96 data container.
export const egm96Data = Egm96Data.fromVals(egm96);
