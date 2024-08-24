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

import { StringifiedNumber, Tle, TleLine1, TleLine2, TleParams } from '../main.js';

/**
 * A class containing static methods for formatting TLEs (Two-Line Elements).
 */
export abstract class FormatTle {
  private constructor() {
    // Static class
  }

  /**
   * Creates a TLE (Two-Line Element) string based on the provided TleParams.
   * @param tleParams - The parameters used to generate the TLE.
   * @returns An object containing the TLE strings tle1 and tle2.
   */
  static createTle(tleParams: TleParams): { tle1: TleLine1; tle2: TleLine2 } {
    const { inc, meanmo, rasc, argPe, meana, ecen, epochyr, epochday, intl } = tleParams;
    const scc = Tle.convert6DigitToA5(tleParams.scc);
    const epochYrStr = epochyr.padStart(2, '0');
    const epochdayStr = parseFloat(epochday).toFixed(8).padStart(12, '0');
    const incStr = FormatTle.inclination(inc);
    const meanmoStr = FormatTle.meanMotion(meanmo);
    const rascStr = FormatTle.rightAscension(rasc);
    const argPeStr = FormatTle.argumentOfPerigee(argPe);
    const meanaStr = FormatTle.meanAnomaly(meana);
    const ecenStr = FormatTle.eccentricity(ecen);
    const intlStr = intl.padEnd(8, ' ');

    // M' and M'' are both set to 0 to put the object in a perfect stable orbit
    let TLE1Ending = tleParams.sat ? tleParams.sat.orbitData.tle1.substring(32, 71) : ' +.00000000 +00000+0 +00000-0 0  9990';

    // Add explicit positive/negative signs
    TLE1Ending = TLE1Ending[1] === ' ' ? FormatTle.setCharAt(TLE1Ending, 1, '+') : TLE1Ending;
    TLE1Ending = TLE1Ending[12] === ' ' ? FormatTle.setCharAt(TLE1Ending, 12, '+') : TLE1Ending;
    TLE1Ending = TLE1Ending[21] === ' ' ? FormatTle.setCharAt(TLE1Ending, 21, '+') : TLE1Ending;
    TLE1Ending = TLE1Ending[32] === ' ' ? FormatTle.setCharAt(TLE1Ending, 32, '0') : TLE1Ending;

    const tle1 = `1 ${scc}U ${intlStr} ${epochYrStr}${epochdayStr}${TLE1Ending}`;
    const tle2 = `2 ${scc} ${incStr} ${rascStr} ${ecenStr} ${argPeStr} ${meanaStr} ${meanmoStr} 00010`;

    return { tle1: tle1 as TleLine1, tle2: tle2 as TleLine2 };
  }

  /**
   * Converts the argument of perigee to a stringified number.
   * @param argPe - The argument of perigee to be converted. Can be either a number or a string.
   * @returns The argument of perigee as a stringified number.
   * @throws Error if the length of the argument of perigee is not 8.
   */
  static argumentOfPerigee(argPe: number | string): StringifiedNumber {
    if (typeof argPe === 'number') {
      argPe = argPe.toString();
    }

    const argPeNum = parseFloat(argPe).toFixed(4);
    const argPe0 = argPeNum.padStart(8, '0');

    if (argPe0.length !== 8) {
      throw new Error('argPe length is not 8');
    }

    return argPe0 as StringifiedNumber;
  }

  /**
   * Returns the eccentricity value of a given string.
   * @param ecen - The string representing the eccentricity.
   * @returns The eccentricity value.
   * @throws Error if the length of the eccentricity string is not 7.
   */
  static eccentricity(ecen: string): string {
    let ecen0 = ecen.padEnd(9, '0');

    if (ecen0[1] === '.') {
      ecen0 = ecen0.substring(2);
    } else {
      ecen0 = ecen0.substring(0, 7);
    }
    if (ecen0.length !== 7) {
      throw new Error('ecen length is not 7');
    }

    return ecen0;
  }

  /**
   * Converts the inclination value to a string representation.
   * @param inc - The inclination value to be converted.
   * @returns The string representation of the inclination value.
   * @throws Error if the length of the converted value is not 8.
   */
  static inclination(inc: number | string): StringifiedNumber {
    if (typeof inc === 'number') {
      inc = inc.toString();
    }

    const incNum = parseFloat(inc).toFixed(4);
    const inc0 = incNum.padStart(8, '0');

    if (inc0.length !== 8) {
      throw new Error('inc length is not 8');
    }

    return inc0 as StringifiedNumber;
  }

  /**
   * Converts the mean anomaly to a string representation with 8 digits, padded with leading zeros.
   * @param meana - The mean anomaly to be converted. Can be either a number or a string.
   * @returns The mean anomaly as a string with 8 digits, padded with leading zeros.
   * @throws Error if the length of the mean anomaly is not 8.
   */
  static meanAnomaly(meana: number | string): StringifiedNumber {
    if (typeof meana === 'number') {
      meana = meana.toString();
    }

    const meanaNum = parseFloat(meana).toFixed(4);
    const meana0 = meanaNum.padStart(8, '0');

    if (meana0.length !== 8) {
      throw new Error('meana length is not 8');
    }

    return meana0 as StringifiedNumber;
  }

  /**
   * Converts the mean motion value to a string representation with 8 decimal
   * places. If the input is a number, it is converted to a string. If the input
   * is already a string, it is parsed as a float and then converted to a string
   * with 8 decimal places. The resulting string is padded with leading zeros to
   * ensure a length of 11 characters. Throws an error if the resulting string
   * does not have a length of 11 characters.
   * @param meanmo - The mean motion value to be converted.
   * @returns The string representation of the mean motion value with 8 decimal
   * places and padded with leading zeros.
   * @throws Error if the resulting string does not have a length of 11
   * characters.
   */
  static meanMotion(meanmo: number | string): StringifiedNumber {
    if (typeof meanmo === 'number') {
      meanmo = meanmo.toString();
    }

    const meanmoNum = parseFloat(meanmo).toFixed(8);
    const meanmo0 = meanmoNum.padStart(11, '0');

    if (meanmo0.length !== 11) {
      throw new Error('meanmo length is not 11');
    }

    return meanmo0 as StringifiedNumber;
  }

  /**
   * Converts the right ascension value to a stringified number.
   * @param rasc - The right ascension value to convert.
   * @returns The stringified number representation of the right ascension.
   * @throws Error if the length of the converted right ascension is not 8.
   */
  static rightAscension(rasc: number | string): StringifiedNumber {
    if (typeof rasc === 'number') {
      rasc = rasc.toString();
    }

    const rascNum = parseFloat(rasc).toFixed(4);
    const rasc0 = rascNum.padStart(8, '0');

    if (rasc0.length !== 8) {
      throw new Error('rasc length is not 8');
    }

    return rasc0 as StringifiedNumber;
  }

  /**
   * Sets a character at a specific index in a string. If the index is out of range, the original string is returned.
   * @param str - The input string.
   * @param index - The index at which to set the character.
   * @param chr - The character to set at the specified index.
   * @returns The modified string with the character set at the specified index.
   */
  static setCharAt(str: string, index: number, chr: string): string {
    if (index > str.length - 1) {
      return str;
    }

    return `${str.substring(0, index)}${chr}${str.substring(index + 1)}`;
  }
}
