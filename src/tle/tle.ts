/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The TLE module contains a collection of functions for working with TLEs.
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2023 Theodore Kruczek
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

import { Line1Data, Line2Data, TleLine1, TleLine2 } from '../types/types';

import { TleFormatData } from './tle-format-data';
import { Utils } from '../utils/utils';

type TleData = {
  satNum: number;
  intlDes: string;
  epochYear: number;
  epochDay: number;
  meanMoDev1: number;
  meanMoDev2: number;
  bstar: number;
  inclination: number;
  raan: number;
  eccentricity: number;
  argOfPerigee: number;
  meanAnomaly: number;
  meanMotion: number;
};
type TleDataFull = Line1Data & Line2Data;

export class Tle {
  private static lineNumber = new TleFormatData(1, 1);

  private static satNum = new TleFormatData(3, 7);

  private static classification = new TleFormatData(8, 8);

  private static intlDes = new TleFormatData(10, 17);

  private static intlDesYear = new TleFormatData(10, 11);

  private static intlDesLaunchNum = new TleFormatData(12, 14);

  private static intlDesLaunchPiece = new TleFormatData(15, 17);

  private static epochYear = new TleFormatData(19, 20);

  private static epochDay = new TleFormatData(21, 32);

  private static meanMoDev1 = new TleFormatData(34, 43);

  private static meanMoDev2 = new TleFormatData(45, 52);

  private static bstar = new TleFormatData(54, 61);

  private static ephemerisType = new TleFormatData(63, 63);

  private static elsetNum = new TleFormatData(65, 68);

  private static checksum = new TleFormatData(69, 69);

  private static inclination = new TleFormatData(9, 16);

  private static raan = new TleFormatData(18, 25);

  private static eccentricity = new TleFormatData(27, 33);

  private static argPerigee = new TleFormatData(35, 42);

  private static meanAnom = new TleFormatData(44, 51);

  private static meanMo = new TleFormatData(53, 63);

  private static revNum = new TleFormatData(64, 68);

  /**
   * Parses the TLE into orbital data.
   *
   * If you want all of the data then use parseTleFull instead.
   * @param {TleLine1} tleLine1 TLE line 1
   * @param {TleLine2} tleLine2 TLE line 2
   * @returns {TleData} Returns most commonly used orbital data from TLE
   */
  public static parseTle(tleLine1: TleLine1, tleLine2: TleLine2): TleData {
    const line1 = Tle.parseLine1(tleLine1);
    const line2 = Tle.parseLine2(tleLine2);

    if (line1.satNum !== line2.satNum) {
      throw new Error('Satellite numbers do not match');
    }

    if (line1.satNumRaw !== line2.satNumRaw) {
      throw new Error('Raw satellite numbers do not match');
    }

    if (line1.lineNumber1 !== 1) {
      throw new Error('First line number must be 1');
    }

    if (line2.lineNumber2 !== 2) {
      throw new Error('Second line number must be 2');
    }

    return {
      satNum: line1.satNum,
      intlDes: line1.intlDes,
      epochYear: line1.epochYear,
      epochDay: line1.epochDay,
      meanMoDev1: line1.meanMoDev1,
      meanMoDev2: line1.meanMoDev2,
      bstar: line1.bstar,
      inclination: line2.inclination,
      raan: line2.raan,
      eccentricity: line2.eccentricity,
      argOfPerigee: line2.argOfPerigee,
      meanAnomaly: line2.meanAnomaly,
      meanMotion: line2.meanMotion,
    };
  }

  /**
   * Parses all of the data contained in the TLE.
   *
   * If you only want the most commonly used data then use parseTle instead.
   * @param {TleLine1} tleLine1 The first line of the TLE to parse.
   * @param {TleLine2} tleLine2 The second line of the TLE to parse.
   * @returns {TleDataFull} Returns all of the data from the TLE.
   */
  public static parseTleFull(tleLine1: TleLine1, tleLine2: TleLine2): TleDataFull {
    const line1 = Tle.parseLine1(tleLine1);
    const line2 = Tle.parseLine2(tleLine2);

    if (line1.satNum !== line2.satNum) {
      throw new Error('Satellite numbers do not match');
    }

    if (line1.satNumRaw !== line2.satNumRaw) {
      throw new Error('Raw satellite numbers do not match');
    }

    if (line1.lineNumber1 !== 1) {
      throw new Error('First line number must be 1');
    }

    if (line2.lineNumber2 !== 2) {
      throw new Error('Second line number must be 2');
    }

    return { ...line1, ...line2 };
  }

  /**
   * Parse the first line of the TLE.
   * @param {TleLine1} tleLine1 The first line of the TLE to parse.
   * @returns {Line1Data} Returns the data from the first line of the TLE.
   */
  public static parseLine1(tleLine1: TleLine1): Line1Data {
    const lineNumber1 = Tle.getLineNumber(tleLine1);
    const satNum = Tle.getSatNum(tleLine1);
    const satNumRaw = Tle.getRawSatNum(tleLine1);
    const classification = Tle.getClassification(tleLine1);
    const intlDes = Tle.getIntlDes(tleLine1);
    const intlDesYear = Tle.getIntlDesYear(tleLine1);
    const intlDesLaunchNum = Tle.getIntlDesLaunchNum(tleLine1);
    const intlDesLaunchPiece = Tle.getIntlDesLaunchPiece(tleLine1);
    const epochYear = Tle.getEpochYear(tleLine1);
    const epochYearFull = Tle.getEpochYearFull(tleLine1);
    const epochDay = Tle.getEpochDay(tleLine1);
    const meanMoDev1 = Tle.getMeanMoDev1(tleLine1);
    const meanMoDev2 = Tle.getMeanMoDev2(tleLine1);
    const bstar = Tle.getBstar(tleLine1);
    const ephemerisType = Tle.getEphemerisType(tleLine1);
    const elsetNum = Tle.getElsetNum(tleLine1);
    const checksum1 = Tle.getChecksum(tleLine1);

    return {
      lineNumber1,
      satNum,
      satNumRaw,
      classification,
      intlDes,
      intlDesYear,
      intlDesLaunchNum,
      intlDesLaunchPiece,
      epochYear,
      epochYearFull,
      epochDay,
      meanMoDev1,
      meanMoDev2,
      bstar,
      ephemerisType,
      elsetNum,
      checksum1,
    };
  }

  /**
   * Parse the second line of the TLE.
   * @param {TleLine2} tleLine2 The second line of the TLE to parse.
   * @returns {Line2Data} Returns the data from the second line of the TLE.
   */
  public static parseLine2(tleLine2: TleLine2): Line2Data {
    const lineNumber2 = Tle.getLineNumber(tleLine2);
    const satNum = Tle.getSatNum(tleLine2);
    const satNumRaw = Tle.getRawSatNum(tleLine2);
    const inclination = Tle.getInclination(tleLine2);
    const raan = Tle.getRaan(tleLine2);
    const eccentricity = Tle.getEccentricity(tleLine2);
    const argOfPerigee = Tle.getArgOfPerigee(tleLine2);
    const meanAnomaly = Tle.getMeanAnomaly(tleLine2);
    const meanMotion = Tle.getMeanMotion(tleLine2);
    const revNum = Tle.getRevNum(tleLine2);
    const checksum2 = Tle.getChecksum(tleLine2);

    return {
      lineNumber2,
      satNum,
      satNumRaw,
      inclination,
      raan,
      eccentricity,
      argOfPerigee,
      meanAnomaly,
      meanMotion,
      revNum,
      checksum2,
    };
  }

  /**
   * This should always return a 1 or a 2.
   * @param {string} tleLine The first line of the TLE to parse.
   * @returns {number} The line number of the TLE.
   */
  public static getLineNumber(tleLine: TleLine1 | TleLine2): 1 | 2 {
    const lineNum = parseInt(tleLine.substring(Tle.lineNumber.start, Tle.lineNumber.stop));

    if (lineNum !== 1 && lineNum !== 2) {
      throw new Error('Invalid line number');
    }

    return lineNum;
  }

  /**
   * See https://en.wikipedia.org/wiki/Satellite_Catalog_Number
   *
   * Range: 0 to 99999 or 26999.
   *
   * NOTE: To support Alpha-5, the first digit can be a letter.
   * This will be converted to a number in order to expand the range to 26999.
   *
   * Example: 25544 or B1234 (e.g. Sputnik's rocket body was number 00001)
   *
   * @param {string} tleLine The first line of the TLE to parse.
   * @returns {number} NORAD catalog number.
   */
  public static getSatNum(tleLine: TleLine1 | TleLine2): number {
    const satNumStr = tleLine.substring(Tle.satNum.start, Tle.satNum.stop);
    const leadingChar = satNumStr.split('')[0].toLowerCase(); // Using uppercase will break the -96 math.

    if (isNaN(parseInt(leadingChar))) {
      return parseInt(leadingChar.charCodeAt(0) - 96 + 9 + satNumStr.slice(1, 5));
    }

    return parseInt(satNumStr);
  }

  /**
   * See https://en.wikipedia.org/wiki/Satellite_Catalog_Number
   *
   * Range: 0 to 99999 or 26999.
   *
   * NOTE: To support Alpha-5, the first digit can be a letter.
   * This will NOT be converted to a number. Use getSatNum() for that.
   *
   * Example: 25544 or B1234 (e.g. Sputnik's rocket body was number 00001)
   *
   * @param {string} tleLine The first line of the TLE to parse.
   * @returns {string} NORAD catalog number.
   */
  public static getRawSatNum(tleLine: TleLine1 | TleLine2): string {
    return tleLine.substring(Tle.satNum.start, Tle.satNum.stop);
  }

  /**
   * Satellite classification.
   * * 'U' = unclassified
   * * 'C' = confidential
   * * 'S' = secret
   *
   * Example: 'U'
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {string} The classification.
   */
  public static getClassification(tleLine1: TleLine1): string {
    return tleLine1.substring(Tle.classification.start, Tle.classification.stop);
  }

  /**
   * International Designator (COSPAR ID)
   * See https://en.wikipedia.org/wiki/International_Designator
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {string} The International Designator.
   */
  public static getIntlDes(tleLine1: TleLine1): string {
    return tleLine1.substring(Tle.intlDes.start, Tle.intlDes.stop).trim();
  }

  /**
   * International Designator (COSPAR ID): Last 2 digits of launch year.
   *
   * Range: 00 to 99
   *
   * Example: 98
   *
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {number} The year of the International Designator.
   */
  public static getIntlDesYear(tleLine1: TleLine1): number {
    return parseInt(tleLine1.substring(Tle.intlDesYear.start, Tle.intlDesYear.stop));
  }

  /**
   * International Designator (COSPAR ID): Launch number of the year.
   *
   * Range: 1 to 999
   *
   * Example: 67
   *
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {number} The launch number of the International Designator.
   */
  public static getIntlDesLaunchNum(tleLine1: string): number {
    return parseInt(tleLine1.substring(Tle.intlDesLaunchNum.start, Tle.intlDesLaunchNum.stop));
  }

  /**
   * International Designator  (COSPAR ID): Piece of the launch.
   *
   * Range: A to ZZZ
   *
   * Example: 'A'
   *
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {string} The launch piece of the International Designator.
   */
  public static getIntlDesLaunchPiece(tleLine1: TleLine1): string {
    return tleLine1.substring(Tle.intlDesLaunchPiece.start, Tle.intlDesLaunchPiece.stop).trim();
  }

  /**
   * Year when the TLE was generated (TLE epoch), last two digits.
   *
   * Range: 00 to 99
   *
   * Example: 17
   *
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {number} The year the TLE was generated.
   */
  public static getEpochYear(tleLine1: TleLine1) {
    const epochYear = parseInt(tleLine1.substring(Tle.epochYear.start, Tle.epochYear.stop));

    if (epochYear < 0 || epochYear > 99) {
      throw new Error('Invalid epoch year');
    }

    return epochYear;
  }

  /**
   * Year when the TLE was generated (TLE epoch), four digits.
   *
   * Range: 1957 to 2056
   *
   * Example: 2008
   *
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {number} The year the TLE was generated.
   */
  public static getEpochYearFull(tleLine1: TleLine1) {
    const epochYear = parseInt(tleLine1.substring(Tle.epochYear.start, Tle.epochYear.stop));

    if (epochYear < 0 || epochYear > 99) {
      throw new Error('Invalid epoch year');
    }

    if (epochYear < 57) {
      return epochYear + 2000;
    }

    return epochYear + 1900;
  }

  /**
   * Fractional day of the year when the TLE was generated (TLE epoch).
   *
   * Range: 1 to 365.99999999
   *
   * Example: 206.18396726
   *
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {number} The day of the year the TLE was generated.
   */
  public static getEpochDay(tleLine1: string): number {
    const epochDay = parseFloat(tleLine1.substring(Tle.epochDay.start, Tle.epochDay.stop));

    if (epochDay < 1 || epochDay > 365.99999999) {
      throw new Error('Invalid epoch day');
    }

    return Utils.roundToNDecimalPlaces(epochDay, 8);
  }

  /**
   * First Time Derivative of the Mean Motion divided by two.  Defines how mean motion changes
   * over time, so TLE propagators can still be used to make reasonable guesses when
   * times are distant from the original TLE epoch.
   *
   * Units: Orbits / day ^ 2
   *
   * Example: 0.00001961
   *
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {number} The first derivative of the mean motion.
   */
  public static getMeanMoDev1(tleLine1: TleLine1): number {
    const meanMoDev1 = parseFloat(tleLine1.substring(Tle.meanMoDev1.start, Tle.meanMoDev1.stop));

    if (isNaN(meanMoDev1)) {
      throw new Error('Invalid first derivative of mean motion.');
    }

    return Utils.roundToNDecimalPlaces(meanMoDev1, 8);
  }

  /**
   * Second Time Derivative of Mean Motion divided by six (decimal point assumed). Measures rate
   * of change in the Mean Motion Dot so software can make reasonable guesses when times are
   * distant from the original TLE epoch.
   *
   * Usually zero, unless the satellite is manuevering or in a decaying orbit.
   *
   * Units: Orbits / day ^ 3.
   *
   * Example: 0 ('00000-0' in the original TLE [= 0.00000 * 10 ^ 0])
   *
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {number} The second derivative of the mean motion.
   */
  public static getMeanMoDev2(tleLine1: string): number {
    const meanMoDev2 = parseFloat(tleLine1.substring(Tle.meanMoDev2.start, Tle.meanMoDev2.stop));

    if (isNaN(meanMoDev2)) {
      throw new Error('Invalid second derivative of mean motion.');
    }

    // NOTE: Should this limit to a specific number of decimals?
    return meanMoDev2;
  }

  /**
   * BSTAR drag term (decimal point assumed).  Estimates the effects of
   * atmospheric drag on the satellite's motion.
   *
   * Units: EarthRadii ^ -1
   *
   * Example: 0.000036771 ('36771-4' in the original TLE [= 0.36771 * 10 ^ -4])
   *
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {number} The drag coefficient.
   */
  public static getBstar(tleLine1: TleLine1): number {
    const BSTAR_PART_2 = Tle.bstar.start + 1;
    const BSTAR_PART_3 = Tle.bstar.start + 6;
    const BSTAR_PART_4 = Tle.bstar.stop - 1;

    const bstarSymbol = tleLine1.substring(Tle.bstar.start, BSTAR_PART_2);
    // Decimal place is assumed
    let bstar1 = parseFloat(`0.${tleLine1.substring(BSTAR_PART_2, BSTAR_PART_3)}`);
    const exponentSymbol = tleLine1.substring(BSTAR_PART_3, BSTAR_PART_4);
    let exponent = parseInt(tleLine1.substring(BSTAR_PART_4, Tle.bstar.stop));

    if (exponentSymbol === '-') {
      exponent *= -1;
    } else if (exponentSymbol !== '+') {
      throw new Error(`Invalid BSTAR symbol: ${bstarSymbol}`);
    }

    bstar1 *= 10 ** exponent;

    if (bstarSymbol === '-') {
      bstar1 *= -1;
    } else if (bstarSymbol === '+' || bstarSymbol === ' ') {
      // Do nothing
    } else {
      throw new Error(`Invalid BSTAR symbol: ${bstarSymbol}`);
    }

    return Utils.roundToNDecimalPlaces(bstar1, 14);
  }

  /**
   * Private value - used by United States Space Force to reference the orbit model used to
   * generate the TLE.  Will always be seen as zero externally (e.g. by "us", unless you are
   * "them" - in which case, hello!).
   *
   * Example: 0
   *
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {number} The ephemeris type.
   */
  public static getEphemerisType(tleLine1: TleLine1): number {
    return parseInt(tleLine1.substring(Tle.ephemerisType.start, Tle.ephemerisType.stop));
  }

  /**
   * TLE element set number, incremented for each new TLE generated. 999 seems to mean the TLE
   * has maxed out.
   *
   * Range: Technically 1 to 9999, though in practice the maximum number seems to be 999.
   *
   * Example: 999
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {number} The element number.
   */
  public static getElsetNum(tleLine1: TleLine1): number {
    return parseInt(tleLine1.substring(Tle.elsetNum.start, Tle.elsetNum.stop));
  }

  /**
   * TLE line 1 checksum (modulo 10), for verifying the integrity of this line of the TLE.
   *
   * Range: 0 to 9
   * Example: 3
   *
   * @param {string} tleLine1 The first line of the TLE to parse.
   * @returns {number} The checksum value.
   */
  public static getChecksum(tleLine1: TleLine1): number {
    return parseInt(tleLine1.substring(Tle.checksum.start, Tle.checksum.stop));
  }

  /**
   * Inclination relative to the Earth's equatorial plane in degrees. 0 to 90 degrees is a
   * prograde orbit and 90 to 180 degrees is a retrograde orbit.
   *
   * Units: degrees
   *
   * Range: 0 to 180
   *
   * Example: 51.6400
   *
   * @param {string} tleLine2 The second line of the TLE to parse.
   * @returns {number} The inclination of the satellite.
   */
  public static getInclination(tleLine2: TleLine2): number {
    const inc = parseFloat(tleLine2.substring(Tle.inclination.start, Tle.inclination.stop));

    if (inc < 0 || inc > 180) {
      throw new Error(`Invalid inclination: ${inc}`);
    }

    return Utils.roundToNDecimalPlaces(inc, 4);
  }

  /**
   * Right ascension of the ascending node in degrees. Essentially, this is the angle of the
   * satellite as it crosses northward (ascending) across the Earth's equator (equatorial
   * plane).
   *
   * Units: degrees
   *
   * Range: 0 to 359.9999
   *
   * Example: 208.9163
   *
   * @param {string} tleLine2 The second line of the TLE to parse.
   * @returns {number} The right ascension of the satellite.
   */
  public static getRaan(tleLine2: TleLine2): number {
    const raan = parseFloat(tleLine2.substring(Tle.raan.start, Tle.raan.stop));

    if (!(raan >= 0 && raan <= 360)) {
      throw new Error(`Invalid RAAN: ${raan}`);
    }

    return Utils.roundToNDecimalPlaces(raan, 4);
  }

  /**
   * Orbital eccentricity, decimal point assumed. All artificial Earth satellites have an
   * eccentricity between 0 (perfect circle) and 1 (parabolic orbit).
   *
   * Range: 0 to 1
   *
   * Example: 0.0006317 (`0006317` in the original TLE)
   *
   * @param {string} tleLine2 The second line of the TLE to parse.
   * @returns {number} The eccentricity of the satellite.
   */
  public static getEccentricity(tleLine2: TleLine2): number {
    const ecc = parseFloat(`0.${tleLine2.substring(Tle.eccentricity.start, Tle.eccentricity.stop)}`);

    if (!(ecc >= 0 && ecc <= 1)) {
      throw new Error(`Invalid eccentricity: ${ecc}`);
    }

    return Utils.roundToNDecimalPlaces(ecc, 7);
  }

  /**
   * Argument of perigee. See https://en.wikipedia.org/wiki/Argument_of_perigee
   *
   * Units: degrees
   *
   * Range: 0 to 359.9999
   *
   * Example: 69.9862
   *
   * @param {string} tleLine2 The second line of the TLE to parse.
   * @returns {number} The argument of perigee in degrees.
   */
  public static getArgOfPerigee(tleLine2: TleLine2): number {
    const argPe = parseFloat(tleLine2.substring(Tle.argPerigee.start, Tle.argPerigee.stop));

    if (!(argPe >= 0 && argPe <= 360)) {
      throw new Error(`Invalid argument of perigee: ${argPe}`);
    }

    return Utils.roundToNDecimalPlaces(argPe, 4);
  }

  /**
   * Mean anomaly. Indicates where the satellite was located within its orbit at the time of the
   * TLE epoch.
   * See https://en.wikipedia.org/wiki/Mean_Anomaly
   *
   * Units: degrees
   *
   * Range: 0 to 359.9999
   *
   * Example: 25.2906
   *
   * @param {string} tleLine2 The second line of the TLE to parse.
   * @returns {number} The mean anomaly of the satellite.
   */
  public static getMeanAnomaly(tleLine2: TleLine2): number {
    const meanA = parseFloat(tleLine2.substring(Tle.meanAnom.start, Tle.meanAnom.stop));

    if (!(meanA >= 0 && meanA <= 360)) {
      throw new Error(`Invalid mean anomaly: ${meanA}`);
    }

    return Utils.roundToNDecimalPlaces(meanA, 4);
  }

  /**
   * Revolutions around the Earth per day (mean motion).
   * See https://en.wikipedia.org/wiki/Mean_Motion
   *
   * Range: 0 to 17 (theoretically)
   * Example: 15.54225995
   * @param {string} tleLine2 The second line of the TLE to parse.
   * @returns {number} The mean motion of the satellite.
   */
  public static getMeanMotion(tleLine2: TleLine2): number {
    const meanMo = parseFloat(tleLine2.substring(Tle.meanMo.start, Tle.meanMo.stop));

    if (!(meanMo >= 0 && meanMo <= 17)) {
      throw new Error(`Invalid mean motion: ${meanMo}`);
    }

    return Utils.roundToNDecimalPlaces(meanMo, 8);
  }

  /**
   * Total satellite revolutions when this TLE was generated. This number rolls over
   * (e.g. 99999 -> 0).
   *
   * Range: 0 to 99999
   *
   * Example: 6766
   *
   * @param {string} tleLine2 The second line of the TLE to parse.
   * @returns {number} The revolutions around the Earth per day (mean motion).
   */
  public static getRevNum(tleLine2: TleLine2): number {
    return parseInt(tleLine2.substring(Tle.revNum.start, Tle.revNum.stop));
  }
}
