/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
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

import { ValidationError } from '../errors';
import { StringifiedNumber, TleLine1, TleLine2, TleParams } from '../types/types';
import { convert6DigitToA5 } from './alpha5';

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
    // TLE cols 3-7 must be exactly 5 chars. convert6DigitToA5 hands back the
    // alpha-5 form for 6-digit numerics (5 chars by construction); for short
    // numeric inputs ("5", "25544") and alpha-5 inputs ("T0001") it's a
    // passthrough — so pad short numerics to 5 chars here so the TLE stays
    // 69 chars regardless of the caller's display-canonical sccNum form.
    let scc = convert6DigitToA5(tleParams.scc);

    if ((/^\d{1,4}$/u).test(scc)) {
      scc = scc.padStart(5, '0');
    }
    const epochYrStr = String(epochyr).padStart(2, '0');
    const epochdayStr = Number(epochday).toFixed(8).padStart(12, '0');
    const incStr = FormatTle.inclination(inc);
    const meanmoStr = FormatTle.meanMotion(meanmo);
    const rascStr = FormatTle.rightAscension(rasc);
    const argPeStr = FormatTle.argumentOfPerigee(argPe);
    const meanaStr = FormatTle.meanAnomaly(meana);
    const ecenStr = FormatTle.eccentricity(ecen);
    const intlStr = intl.padEnd(8, ' ');
    const classification = tleParams.classification ?? 'U';
    const elementSetNo = (tleParams.elementSetNo ?? 999).toString().padStart(4, ' ');
    const ephemerisType = (tleParams.ephemerisType ?? 0).toString();
    const revAtEpoch = (tleParams.revAtEpoch ?? 0).toString().padStart(5, ' ');

    let TLE1Ending: string;

    if (tleParams.sat) {
      // Preserve the original TLE1 ending from the satellite
      TLE1Ending = tleParams.sat.tle1.substring(32, 71);
    } else {
      // Build TLE1 ending from provided parameters or defaults
      const mmDot = FormatTle.formatMeanMotionDot(tleParams.meanMotionDot ?? 0);
      const mmDdot = FormatTle.formatTleExponential(tleParams.meanMotionDdot ?? 0);
      const bstarStr = FormatTle.formatTleExponential(tleParams.bstar ?? 0);

      TLE1Ending = ` ${mmDot} ${mmDdot} ${bstarStr} ${ephemerisType} ${elementSetNo}0`;
    }

    // NOTE: TLE standard uses space (not '+') for positive values — do not replace spaces with '+'

    const tle1Pre = `1 ${scc}${classification} ${intlStr} ${epochYrStr}${epochdayStr}${TLE1Ending}`;
    const tle1 = FormatTle.setCharAt(tle1Pre, 68, FormatTle.tleChecksum(tle1Pre).toString());

    const tle2Pre = `2 ${scc} ${incStr} ${rascStr} ${ecenStr} ${argPeStr} ${meanaStr} ${meanmoStr}${revAtEpoch}0`;
    const tle2 = FormatTle.setCharAt(tle2Pre, 68, FormatTle.tleChecksum(tle2Pre).toString());

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
    const argPe0 = argPeNum.padStart(8, ' ');

    if (argPe0.length !== 8) {
      throw new ValidationError('Argument of perigee must be 8 characters', 'argPe', argPe0);
    }

    return argPe0 as StringifiedNumber;
  }

  /**
   * Returns the eccentricity value formatted for TLE.
   * @param ecen - The eccentricity value (string or number).
   * @returns The eccentricity value formatted as 7 digits without leading "0.".
   * @throws Error if the length of the eccentricity string is not 7.
   */
  static eccentricity(ecen: string | number): string {
    if (typeof ecen === 'number') {
      // Truncate to 7 decimal places (no rounding) to match TLE/NORAD convention.
      // Work with string representation to avoid IEEE 754 precision issues
      // (e.g., 0.0002554 * 1e7 = 2553.999... in floating point).
      const ecenStr = ecen.toString();
      const dotIdx = ecenStr.indexOf('.');
      const afterDot = dotIdx >= 0 ? ecenStr.substring(dotIdx + 1) : '';

      ecen = `0.${afterDot.substring(0, 7).padEnd(7, '0')}`;
    }

    let ecen0 = ecen.padEnd(9, '0');

    if (ecen0[1] === '.') {
      ecen0 = ecen0.substring(2);
    } else {
      ecen0 = ecen0.substring(0, 7);
    }
    if (ecen0.length !== 7) {
      throw new ValidationError('Eccentricity must be 7 characters', 'eccentricity', ecen0);
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
    const inc0 = incNum.padStart(8, ' ');

    if (inc0.length !== 8) {
      throw new ValidationError('Inclination must be 8 characters', 'inclination', inc0);
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
    const meana0 = meanaNum.padStart(8, ' ');

    if (meana0.length !== 8) {
      throw new ValidationError('Mean anomaly must be 8 characters', 'meanAnomaly', meana0);
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
      throw new ValidationError('Mean motion must be 11 characters', 'meanMotion', meanmo0);
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
    const rasc0 = rascNum.padStart(8, ' ');

    if (rasc0.length !== 8) {
      throw new ValidationError('Right ascension must be 8 characters', 'rightAscension', rasc0);
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

  /**
   * Format mean motion dot (first derivative / 2) for TLE line 1.
   * Format: sign + ".NNNNNNNN" = 10 chars total.
   * @param value - Mean motion dot value (rev/day^2)
   * @returns Formatted 10-character string
   */
  static formatMeanMotionDot(value: number): string {
    const sign = value >= 0 ? ' ' : '-';

    return sign + Math.abs(value).toFixed(8).substring(1);
  }

  /**
   * Format a value in TLE exponential notation for BSTAR or mean motion ddot.
   * Format: "sNNNNN±N" (8 chars) where mantissa has implied leading decimal point.
   * Example: 0.00017507 → " 17507-3" (i.e., .17507 × 10^-3)
   * @param value - The value to format
   * @returns Formatted 8-character string
   */
  static formatTleExponential(value: number): string {
    if (value === 0) {
      return ' 00000+0';
    }

    const sign = value >= 0 ? ' ' : '-';
    const absVal = Math.abs(value);

    // Find exponent such that mantissa is in [0.1, 1.0)
    let exponent = Math.floor(Math.log10(absVal)) + 1;
    let mantissa = absVal / 10 ** exponent;

    // Guard against floating-point edge cases
    if (mantissa >= 1) {
      mantissa /= 10;
      exponent++;
    }
    if (mantissa < 0.1 && mantissa > 0) {
      mantissa *= 10;
      exponent--;
    }

    const mantissaStr = Math.round(mantissa * 100000).toString().padStart(5, '0');
    const expSign = exponent >= 0 ? '+' : '-';
    const expStr = Math.abs(exponent).toString();

    return sign + mantissaStr + expSign + expStr;
  }

  /**
   * Compute TLE line checksum (modulo 10 sum of digits, '-' counts as 1).
   * @param line - TLE line (first 68 characters are summed)
   * @returns Checksum digit (0-9)
   */
  static tleChecksum(line: string): number {
    let sum = 0;

    for (let i = 0; i < 68 && i < line.length; i++) {
      const c = line[i];

      if (c >= '0' && c <= '9') {
        sum += parseInt(c);
      } else if (c === '-') {
        sum += 1;
      }
    }

    return sum % 10;
  }
}
