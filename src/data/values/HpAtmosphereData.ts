/**
 * @author @thkruz Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
 *
 * Many of the classes are based off of the work of @david-rc-dayton and his
 * Pious Squid library (https://github.com/david-rc-dayton/pious_squid) which
 * is licensed under the MIT license.
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
  private readonly table_: HpAtmosphereEntry[];
  private readonly hMin_: number;
  private readonly hMax_: number;

  constructor(table: HpAtmosphereEntry[]) {
    this.table_ = table;
    if (table.length === 0 || typeof table[0]?.[0] === 'undefined') {
      throw new Error('Table must have at least one valid entry.');
    }

    this.hMin_ = table[0][0];
    this.hMax_ = table[table.length - 1]?.[0] ?? 0;
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
    if (height < this.hMin_ || height > this.hMax_) {
      return null;
    }
    let index = 0;

    while (index < this.table_.length - 2 && height > (this.table_[index + 1])[0]) {
      index++;
    }

    return new HpAtmosphereResult(
      height,
      (this.table_[index]),
      (this.table_[index + 1]),
    );
  }
}

export const hpAtmosphereData = HpAtmosphereData.fromVals(hpAtmosphere);
