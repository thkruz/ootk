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
