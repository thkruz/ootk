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
