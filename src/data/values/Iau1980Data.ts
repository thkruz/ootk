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

import { iau1980 } from './iau1980.js';

// / IAU a1, a2, a3, a4, a5, Ai, Bi, Ci, Di coefficients.
export type Iau1980Entry = [number, number, number, number, number, number, number, number, number];

// / Container for IAU-1980 data.
export class Iau1980Data {
  private readonly coeffs_: Iau1980Entry[];

  // / Create a new [Iau1980Data] object.
  constructor(coeffs: Iau1980Entry[]) {
    this.coeffs_ = coeffs;
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
    return this.coeffs_[row];
  }
}

// / IAU-1980 data container.
export const iau1980Data = Iau1980Data.fromCoeffs(iau1980);
