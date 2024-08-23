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

import { hpAtmosphere } from './hpAtmosphere.js';
import { HpAtmosphereResult } from './HpAtmosphereResult.js';

// / Harris-Priester atmosphere entry for height, min, and max density values.
export type HpAtmosphereEntry = [number, number, number];

// / Container for Harris-Priester atmosphere data.
export class HpAtmosphereData {
  private _table: HpAtmosphereEntry[];
  private _hMin: number;
  private _hMax: number;

  constructor(table: HpAtmosphereEntry[]) {
    this._table = table;
    this._hMin = table[0][0];
    this._hMax = table[table.length - 1][0];
  }

  static fromVals(vals: [number, number, number][]): HpAtmosphereData {
    const output: HpAtmosphereEntry[] = [];

    for (const v of vals) {
      const [h, minD, maxD] = v;

      output.push([h, minD, maxD]);
    }

    return new HpAtmosphereData(output);
  }

  getAtmosphere(height: number): HpAtmosphereResult | null {
    if (height < this._hMin || height > this._hMax) {
      return null;
    }
    let index = 0;

    while (index < this._table.length - 2 && height > this._table[index + 1][0]) {
      index++;
    }

    return new HpAtmosphereResult(height, this._table[index], this._table[index + 1]);
  }
}

export const hpAtmosphereData = HpAtmosphereData.fromVals(hpAtmosphere);
