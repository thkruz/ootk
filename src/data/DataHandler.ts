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

import { egm96Data, Egm96Entry } from './values/Egm96Data.js';
import { hpAtmosphereData } from './values/HpAtmosphereData.js';
import { HpAtmosphereResult } from './values/HpAtmosphereResult.js';
import { iau1980Data, Iau1980Entry } from './values/Iau1980Data.js';
import { leapSecondData } from './values/LeapSecondData.js';

/**
 * Astrodynamic data management singleton.
 *
 * This class provides access to the various data sets used by the library.
 * It is a singleton class, and can be accessed via the static
 * [getInstance] method.
 */
export class DataHandler {
  private static instance_ = new DataHandler();

  private constructor() {
    // Prevent instantiation.
  }

  /**
   * Returns the singleton instance of the DataHandler class.
   * @returns The singleton instance of the DataHandler class.
   */
  static getInstance(): DataHandler {
    return DataHandler.instance_;
  }

  /**
   * Retrieves the Egm96 coefficients for the given l and m values.
   * @param l - The degree of the coefficient.
   * @param m - The order of the coefficient.
   * @returns The Egm96Entry object containing the coefficients.
   */
  getEgm96Coeffs(l: number, m: number): Egm96Entry {
    return egm96Data.getCoeffs(l, m);
  }

  /**
   * Retrieves the IAU 1980 coefficients for the specified row.
   * @param row The row index of the coefficients to retrieve.
   * @returns The IAU 1980 entry containing the coefficients.
   */
  getIau1980Coeffs(row: number): Iau1980Entry {
    return iau1980Data.getCoeffs(row);
  }

  /**
   * Retrieves the number of leap seconds for a given Julian date.
   * @param jd The Julian date.
   * @returns The number of leap seconds.
   */
  getLeapSeconds(jd: number): number {
    return leapSecondData.getLeapSeconds(jd);
  }

  /**
   * Retrieves the atmosphere data for a given height.
   * @param height The height for which to retrieve the atmosphere data.
   * @returns The atmosphere data for the given height, or null if no data is available.
   */
  getHpAtmosphere(height: number): HpAtmosphereResult | null {
    return hpAtmosphereData.getAtmosphere(height);
  }
}
