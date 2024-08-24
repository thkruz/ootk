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

import { Sgp4OpsMode } from '../enums/Sgp4OpsMode.js';
import { Sgp4, Vector3D } from '../main.js';
import { Sgp4GravConstants } from '../sgp4/sgp4.js';
import { EpochUTC } from '../time/EpochUTC.js';
import {
  Degrees,
  EciVec3,
  Kilometers,
  KilometersPerSecond,
  Line1Data,
  Line2Data,
  Minutes,
  SatelliteRecord,
  Seconds,
  StateVectorSgp4,
  TleData,
  TleDataFull,
  TleLine1,
  TleLine2,
} from '../types/types.js';
import { DEG2RAD, earthGravityParam, RAD2DEG, secondsPerDay, TAU } from '../utils/constants.js';
import { newtonNu, toPrecision } from '../utils/functions.js';
import { ClassicalElements, FormatTle, TEME } from './index.js';
import { TleFormatData } from './tle-format-data.js';

/**
 * Tle is a static class with a collection of methods for working with TLEs.
 */
export class Tle {
  line1: string;
  line2: string;
  epoch: EpochUTC;
  satnum: number;
  private satrec_: SatelliteRecord;
  /**
   * Mapping of alphabets to their corresponding numeric values.
   */
  private static alpha5_ = {
    A: '10',
    B: '11',
    C: '12',
    D: '13',
    E: '14',
    F: '15',
    G: '16',
    H: '17',
    J: '18',
    K: '19',
    L: '20',
    M: '21',
    N: '22',
    P: '23',
    Q: '24',
    R: '25',
    S: '26',
    T: '27',
    U: '28',
    V: '29',
    W: '30',
    X: '31',
    Y: '32',
    Z: '33',
  };
  /** The argument of perigee field. */
  private static readonly argPerigee_ = new TleFormatData(35, 42);
  /** The BSTAR drag term field. */
  private static readonly bstar_ = new TleFormatData(54, 61);
  /** The checksum field. */
  private static readonly checksum_ = new TleFormatData(69, 69);
  /** The classification field. */
  private static readonly classification_ = new TleFormatData(8, 8);
  /** The eccentricity field. */
  private static readonly eccentricity_ = new TleFormatData(27, 33);
  /** The element set number field. */
  private static readonly elsetNum_ = new TleFormatData(65, 68);
  /** The ephemeris type field. */
  private static readonly ephemerisType_ = new TleFormatData(63, 63);
  /** The epoch day field. */
  private static readonly epochDay_ = new TleFormatData(21, 32);
  /** The epoch year field. */
  private static readonly epochYear_ = new TleFormatData(19, 20);
  /** The inclination field. */
  private static readonly inclination_ = new TleFormatData(9, 16);
  /** The international designator launch number field. */
  private static readonly intlDesLaunchNum_ = new TleFormatData(12, 14);
  /** The international designator launch piece field. */
  private static readonly intlDesLaunchPiece_ = new TleFormatData(15, 17);
  /** The international designator year field. */
  private static readonly intlDesYear_ = new TleFormatData(10, 11);
  /** The international designator field. */
  private static readonly intlDes_ = new TleFormatData(10, 17);
  /** The line number field. */
  private static readonly lineNumber_ = new TleFormatData(1, 1);
  /** The mean anomaly field. */
  private static readonly meanAnom_ = new TleFormatData(44, 51);
  /** The first derivative of the mean motion field. */
  private static readonly meanMoDev1_ = new TleFormatData(34, 43);
  /** The second derivative of the mean motion field. */
  private static readonly meanMoDev2_ = new TleFormatData(45, 52);
  /** The mean motion field. */
  private static readonly meanMo_ = new TleFormatData(53, 63);
  /** The right ascension of the ascending node field. */
  private static readonly rightAscension_ = new TleFormatData(18, 25);
  /** The revolution number field. */
  private static readonly revNum_ = new TleFormatData(64, 68);
  /** The satellite number field. */
  private static readonly satNum_ = new TleFormatData(3, 7);

  constructor(
    line1: string,
    line2: string,
    opsMode: Sgp4OpsMode = Sgp4OpsMode.AFSPC,
    gravConst: Sgp4GravConstants = Sgp4GravConstants.wgs72,
  ) {
    this.line1 = line1;
    this.line2 = line2;
    this.epoch = Tle.parseEpoch_(line1.substring(18, 32));
    this.satnum = parseInt(Tle.convertA5to6Digit(line1.substring(2, 7)));
    this.satrec_ = Sgp4.createSatrec(line1, line2, gravConst, opsMode);
  }

  toString(): string {
    return `${this.line1}\n${this.line2}`;
  }

  /**
   * Gets the semimajor axis of the TLE.
   * @returns The semimajor axis value.
   */
  get semimajorAxis(): number {
    return Tle.tleSma_(this.line2);
  }

  /**
   * Gets the eccentricity of the TLE.
   * @returns The eccentricity value.
   */
  get eccentricity(): number {
    return Tle.tleEcc_(this.line2);
  }

  /**
   * Gets the inclination of the TLE.
   * @returns The inclination in degrees.
   */
  get inclination(): number {
    return Tle.tleInc_(this.line2);
  }

  /**
   * Gets the inclination in degrees.
   * @returns The inclination in degrees.
   */
  get inclinationDegrees(): number {
    return Tle.tleInc_(this.line2) * RAD2DEG;
  }

  /**
   * Gets the apogee of the TLE (Two-Line Elements) object.
   * Apogee is the point in an orbit that is farthest from the Earth.
   * It is calculated as the product of the semimajor axis and (1 + eccentricity).
   * @returns The apogee value.
   */
  get apogee(): number {
    return this.semimajorAxis * (1 + this.eccentricity);
  }

  /**
   * Gets the perigee of the TLE (Two-Line Element Set).
   * The perigee is the point in the orbit of a satellite or other celestial body where it is closest to the Earth.
   * It is calculated as the product of the semimajor axis and the difference between 1 and the eccentricity.
   * @returns The perigee value.
   */
  get perigee(): number {
    return this.semimajorAxis * (1 - this.eccentricity);
  }

  /**
   * Gets the period of the TLE in minutes.
   * @returns The period of the TLE in minutes.
   */
  get period(): Minutes {
    const periodSec = (TAU * Math.sqrt(this.semimajorAxis ** 3 / earthGravityParam)) as Seconds;

    return (periodSec / 60) as Minutes;
  }

  /**
   * Parses the epoch string and returns the corresponding EpochUTC object.
   * @param epochStr - The epoch string to parse.
   * @returns The parsed EpochUTC object.
   */
  private static parseEpoch_(epochStr: string): EpochUTC {
    let year = parseInt(epochStr.substring(0, 2));

    if (year >= 57) {
      year += 1900;
    } else {
      year += 2000;
    }
    const days = parseFloat(epochStr.substring(2, 14)) - 1;

    return EpochUTC.fromDateTimeString(`${year}-01-01T00:00:00.000Z`).roll(days * secondsPerDay as Seconds);
  }

  /**
   * Propagates the TLE (Two-Line Element Set) to a specific epoch and returns the TEME (True Equator Mean Equinox)
   * coordinates.
   * @param epoch The epoch to propagate the TLE to.
   * @returns The TEME coordinates at the specified epoch.
   * @throws Error if propagation fails.
   */
  propagate(epoch: EpochUTC): TEME {
    const r = new Float64Array(3);
    const v = new Float64Array(3);

    const stateVector = Sgp4.propagate(this.satrec_, epoch.difference(this.epoch) / 60.0);

    if (!stateVector) {
      throw new Error('Propagation failed');
    }

    Tle.sv2rv_(stateVector, r, v);

    return new TEME(
      epoch,
      new Vector3D(<Kilometers>r[0], <Kilometers>r[1], <Kilometers>r[2]),
      new Vector3D(<KilometersPerSecond>v[0], <KilometersPerSecond>v[1], <KilometersPerSecond>v[2]),
    );
  }

  /**
   * Converts the state vector to position and velocity arrays.
   * @param stateVector - The state vector containing position and velocity information.
   * @param r - The array to store the position values.
   * @param v - The array to store the velocity values.
   */
  private static sv2rv_(stateVector: StateVectorSgp4, r: Float64Array, v: Float64Array) {
    const pos = stateVector.position as EciVec3;
    const vel = stateVector.velocity as EciVec3;

    r[0] = pos.x;
    r[1] = pos.y;
    r[2] = pos.z;
    v[0] = vel.x;
    v[1] = vel.y;
    v[2] = vel.z;
  }

  /**
   * Returns the current state of the satellite in the TEME coordinate system.
   * @returns The current state of the satellite.
   */
  private currentState_(): TEME {
    const r = new Float64Array(3);
    const v = new Float64Array(3);

    const stateVector = Sgp4.propagate(this.satrec_, 0.0);

    Tle.sv2rv_(stateVector, r, v);

    return new TEME(
      this.epoch,
      new Vector3D(<Kilometers>r[0], <Kilometers>r[1], <Kilometers>r[2]),
      new Vector3D(<KilometersPerSecond>v[0], <KilometersPerSecond>v[1], <KilometersPerSecond>v[2]),
    );
  }

  /**
   * Gets the state of the TLE in the TEME coordinate system.
   * @returns The state of the TLE in the TEME coordinate system.
   */
  get state(): TEME {
    return this.currentState_();
  }

  /**
   * Calculates the Semi-Major Axis (SMA) from the second line of a TLE.
   * @param line2 The second line of the TLE.
   * @returns The Semi-Major Axis (SMA) in kilometers.
   */
  private static tleSma_(line2: string): number {
    const n = parseFloat(line2.substring(52, 63));

    return earthGravityParam ** (1 / 3) / ((TAU * n) / secondsPerDay) ** (2 / 3);
  }

  /**
   * Parses the eccentricity value from the second line of a TLE.
   * @param line2 The second line of the TLE.
   * @returns The eccentricity value.
   */
  private static tleEcc_(line2: string): number {
    return parseFloat(`0.${line2.substring(26, 33)}`);
  }

  /**
   * Calculates the inclination angle from the second line of a TLE.
   * @param line2 The second line of the TLE.
   * @returns The inclination angle in radians.
   */
  private static tleInc_(line2: string): number {
    return parseFloat(line2.substring(8, 16)) * DEG2RAD;
  }

  /**
   * Creates a TLE (Two-Line Element) object from classical orbital elements.
   * @param elements - The classical orbital elements.
   * @returns A TLE object.
   */
  static fromClassicalElements(elements: ClassicalElements): Tle {
    const { epochYr, epochDay } = elements.epoch.toEpochYearAndDay();
    const intl = '58001A  ';
    const scc = '00001';

    const tles = FormatTle.createTle({
      inc: FormatTle.inclination(elements.inclinationDegrees),
      meanmo: FormatTle.meanMotion(elements.revsPerDay),
      ecen: FormatTle.eccentricity(elements.eccentricity.toFixed(7)),
      argPe: FormatTle.argumentOfPerigee(elements.argPerigeeDegrees),
      meana: FormatTle.meanAnomaly(newtonNu(elements.eccentricity, elements.trueAnomaly).m * RAD2DEG),
      rasc: FormatTle.rightAscension(elements.rightAscensionDegrees),
      epochday: epochDay,
      epochyr: epochYr,
      scc,
      intl,
    });

    return new Tle(tles.tle1, tles.tle2);
  }

  /**
   * Argument of perigee.
   * @see https://en.wikipedia.org/wiki/Argument_of_perigee
   * @example 69.9862
   * @param tleLine2 The second line of the Tle to parse.
   * @returns The argument of perigee in degrees (0 to 360).
   */
  static argOfPerigee(tleLine2: TleLine2): Degrees {
    const argPe = parseFloat(tleLine2.substring(Tle.argPerigee_.start, Tle.argPerigee_.stop));

    if (!(argPe >= 0 && argPe <= 360)) {
      throw new Error(`Invalid argument of perigee: ${argPe}`);
    }

    return toPrecision(argPe, 4) as Degrees;
  }

  /**
   * BSTAR drag term (decimal point assumed).  Estimates the effects of atmospheric drag on the satellite's motion.
   * @see https://en.wikipedia.org/wiki/BSTAR
   * @example 0.000036771
   * @description ('36771-4' in the original Tle or 0.36771 * 10 ^ -4)
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The drag coefficient.
   */
  static bstar(tleLine1: TleLine1): number {
    const BSTAR_PART_2 = Tle.bstar_.start + 1;
    const BSTAR_PART_3 = Tle.bstar_.start + 6;
    const BSTAR_PART_4 = Tle.bstar_.stop - 1;

    const bstarSymbol = tleLine1.substring(Tle.bstar_.start, BSTAR_PART_2);
    // Decimal place is assumed
    let bstar1 = parseFloat(`0.${tleLine1.substring(BSTAR_PART_2, BSTAR_PART_3)}`);
    const exponentSymbol = tleLine1.substring(BSTAR_PART_3, BSTAR_PART_4);
    let exponent = parseInt(tleLine1.substring(BSTAR_PART_4, Tle.bstar_.stop));

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

    return toPrecision(bstar1, 14);
  }

  /**
   * Tle line 1 checksum (modulo 10), for verifying the integrity of this line of the Tle.
   * @example 3
   * @param tleLine The first line of the Tle to parse.
   * @returns The checksum value (0 to 9)
   */
  static checksum(tleLine: TleLine1 | TleLine2): number {
    return parseInt(tleLine.substring(Tle.checksum_.start, Tle.checksum_.stop));
  }

  /**
   * Returns the satellite classification.
   * Some websites like https://KeepTrack.space and Celestrak.org will embed
   * information in this field about the source of the Tle.
   * @example 'U'
   * unclassified
   * @example 'C'
   * confidential
   * @example 'S'
   * secret
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The satellite classification.
   */
  static classification(tleLine1: TleLine1): string {
    return tleLine1.substring(Tle.classification_.start, Tle.classification_.stop);
  }

  /**
   * Orbital eccentricity, decimal point assumed. All artificial Earth satellites have an eccentricity between 0
   * (perfect circle) and 1 (parabolic orbit).
   * @example 0.0006317
   * (`0006317` in the original Tle)
   * @param tleLine2 The second line of the Tle to parse.
   * @returns The eccentricity of the satellite (0 to 1)
   */
  static eccentricity(tleLine2: TleLine2): number {
    const ecc = parseFloat(`0.${tleLine2.substring(Tle.eccentricity_.start, Tle.eccentricity_.stop)}`);

    if (!(ecc >= 0 && ecc <= 1)) {
      throw new Error(`Invalid eccentricity: ${ecc}`);
    }

    return toPrecision(ecc, 7);
  }

  /**
   * Tle element set number, incremented for each new Tle generated.
   * @see https://en.wikipedia.org/wiki/Two-line_element_set
   * @example 999
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The element number (1 to 999)
   */
  static elsetNum(tleLine1: TleLine1): number {
    return parseInt(tleLine1.substring(Tle.elsetNum_.start, Tle.elsetNum_.stop));
  }

  /**
   * Private value - used by United States Space Force to reference the orbit model used to generate the Tle. Will
   * always be seen as zero externally (e.g. by "us", unless you are "them" - in which case, hello!).
   *
   * Starting in 2024, this may contain a 4 if the Tle was generated using the new SGP4-XP model. Until the source code
   * is released, there is no way to support that format in JavaScript or TypeScript.
   * @example 0
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The ephemeris type.
   */
  static ephemerisType(tleLine1: TleLine1): 0 {
    const ephemerisType = parseInt(tleLine1.substring(Tle.ephemerisType_.start, Tle.ephemerisType_.stop));

    if (ephemerisType !== 0 && ephemerisType !== 4) {
      throw new Error('Invalid ephemeris type');
    }

    if (ephemerisType === 4) {
      throw new Error('SGP4-XP is not supported');
    }

    return ephemerisType;
  }

  /**
   * Fractional day of the year when the Tle was generated (Tle epoch).
   * @example 206.18396726
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The day of the year the Tle was generated. (1 to 365.99999999)
   */
  static epochDay(tleLine1: string): number {
    const epochDay = parseFloat(tleLine1.substring(Tle.epochDay_.start, Tle.epochDay_.stop));

    if (epochDay < 1 || epochDay > 365.99999999) {
      throw new Error('Invalid epoch day');
    }

    return toPrecision(epochDay, 8);
  }

  /**
   * Year when the Tle was generated (Tle epoch), last two digits.
   * @example 17
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The year the Tle was generated. (0 to 99)
   */
  static epochYear(tleLine1: TleLine1) {
    const epochYear = parseInt(tleLine1.substring(Tle.epochYear_.start, Tle.epochYear_.stop));

    if (epochYear < 0 || epochYear > 99) {
      throw new Error('Invalid epoch year');
    }

    return epochYear;
  }

  /**
   * Year when the Tle was generated (Tle epoch), four digits.
   * @example 2008
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The year the Tle was generated. (1957 to 2056)
   */
  static epochYearFull(tleLine1: TleLine1) {
    const epochYear = parseInt(tleLine1.substring(Tle.epochYear_.start, Tle.epochYear_.stop));

    if (epochYear < 0 || epochYear > 99) {
      throw new Error('Invalid epoch year');
    }

    if (epochYear < 57) {
      return epochYear + 2000;
    }

    return epochYear + 1900;
  }

  /**
   * Inclination relative to the Earth's equatorial plane in degrees. 0 to 90 degrees is a prograde orbit and 90 to 180
   * degrees is a retrograde orbit.
   * @example 51.6400
   * @param tleLine2 The second line of the Tle to parse.
   * @returns The inclination of the satellite. (0 to 180)
   */
  static inclination(tleLine2: TleLine2): Degrees {
    const inc = parseFloat(tleLine2.substring(Tle.inclination_.start, Tle.inclination_.stop));

    if (inc < 0 || inc > 180) {
      throw new Error(`Invalid inclination: ${inc}`);
    }

    return toPrecision(inc, 4) as Degrees;
  }

  /**
   * International Designator (COSPAR ID)
   * @see https://en.wikipedia.org/wiki/International_Designator
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The International Designator.
   */
  static intlDes(tleLine1: TleLine1): string {
    const year2 = this.intlDesYear(tleLine1);

    // Some TLEs don't have a year, so we can't generate an IntlDes
    if (isNaN(year2)) {
      return '';
    }

    const year4 = year2 < 57 ? year2 + 2000 : year2 + 1900;
    const launchNum = this.intlDesLaunchNum(tleLine1);
    const launchPiece = this.intlDesLaunchPiece(tleLine1);

    return `${year4}-${launchNum.toString().padStart(3, '0')}${launchPiece}`;
  }

  /**
   * International Designator (COSPAR ID): Launch number of the year.
   * @example 67
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The launch number of the International Designator. (1 to 999)
   */
  static intlDesLaunchNum(tleLine1: string): number {
    return parseInt(tleLine1.substring(Tle.intlDesLaunchNum_.start, Tle.intlDesLaunchNum_.stop));
  }

  /**
   * International Designator  (COSPAR ID): Piece of the launch.
   * @example 'A'
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The launch piece of the International Designator. (A to ZZZ)
   */
  static intlDesLaunchPiece(tleLine1: TleLine1): string {
    return tleLine1.substring(Tle.intlDesLaunchPiece_.start, Tle.intlDesLaunchPiece_.stop).trim();
  }

  /**
   * International Designator (COSPAR ID): Last 2 digits of launch year.
   * @example 98
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The year of the International Designator. (0 to 99)
   */
  static intlDesYear(tleLine1: TleLine1): number {
    return parseInt(tleLine1.substring(Tle.intlDesYear_.start, Tle.intlDesYear_.stop));
  }

  /**
   * This should always return a 1 or a 2.
   * @example 1
   * @param tleLine The first line of the Tle to parse.
   * @returns The line number of the Tle. (1 or 2)
   */
  static lineNumber(tleLine: TleLine1 | TleLine2): 1 | 2 {
    const lineNum = parseInt(tleLine.substring(Tle.lineNumber_.start, Tle.lineNumber_.stop));

    if (lineNum !== 1 && lineNum !== 2) {
      throw new Error(`Invalid line number ${lineNum} in ${tleLine}`);
    }

    return lineNum;
  }

  /**
   * Mean anomaly. Indicates where the satellite was located within its orbit at the time of the Tle epoch.
   * @see https://en.wikipedia.org/wiki/Mean_Anomaly
   * @example 25.2906
   * @param tleLine2 The second line of the Tle to parse.
   * @returns The mean anomaly of the satellite. (0 to 360)
   */
  static meanAnomaly(tleLine2: TleLine2): Degrees {
    const meanA = parseFloat(tleLine2.substring(Tle.meanAnom_.start, Tle.meanAnom_.stop));

    if (!(meanA >= 0 && meanA <= 360)) {
      throw new Error(`Invalid mean anomaly: ${meanA}`);
    }

    return toPrecision(meanA, 4) as Degrees;
  }

  /**
   * First Time Derivative of the Mean Motion divided by two.  Defines how mean motion changes over time, so Tle
   * propagators can still be used to make reasonable guesses when times are distant from the original Tle epoch. This
   * is recorded in units of orbits per day per day.
   * @example 0.00001961
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The first derivative of the mean motion.
   */
  static meanMoDev1(tleLine1: TleLine1): number {
    const meanMoDev1 = parseFloat(tleLine1.substring(Tle.meanMoDev1_.start, Tle.meanMoDev1_.stop));

    if (isNaN(meanMoDev1)) {
      throw new Error('Invalid first derivative of mean motion.');
    }

    return toPrecision(meanMoDev1, 8);
  }

  /**
   * Second Time Derivative of Mean Motion divided by six (decimal point assumed). Measures rate of change in the Mean
   * Motion Dot so software can make reasonable guesses when times are distant from the original Tle epoch. Usually
   * zero, unless the satellite is manuevering or in a decaying orbit. This is recorded in units of orbits per day per
   * day per day.
   * @example 0
   * '00000-0' in the original Tle or 0.00000 * 10 ^ 0
   * @param tleLine1 The first line of the Tle to parse.
   * @returns The second derivative of the mean motion.
   */
  static meanMoDev2(tleLine1: string): number {
    const meanMoDev2 = parseFloat(tleLine1.substring(Tle.meanMoDev2_.start, Tle.meanMoDev2_.stop));

    if (isNaN(meanMoDev2)) {
      throw new Error('Invalid second derivative of mean motion.');
    }

    // NOTE: Should this limit to a specific number of decimals?
    return meanMoDev2;
  }

  /**
   * Revolutions around the Earth per day (mean motion).
   * @see https://en.wikipedia.org/wiki/Mean_Motion
   * @example 15.54225995
   * @param tleLine2 The second line of the Tle to parse.
   * @returns The mean motion of the satellite. (0 to 17)
   */
  static meanMotion(tleLine2: TleLine2): number {
    const meanMo = parseFloat(tleLine2.substring(Tle.meanMo_.start, Tle.meanMo_.stop));

    if (!(meanMo > 0 && meanMo <= 17)) {
      throw new Error(`Invalid mean motion: ${meanMo}`);
    }

    return toPrecision(meanMo, 8);
  }

  /**
   * Calculates the period of a satellite orbit based on the given Tle line 2.
   * @example 92.53035747
   * @param tleLine2 The Tle line 2.
   * @returns The period of the satellite orbit in minutes.
   */
  static period(tleLine2: TleLine2): Minutes {
    const meanMo = Tle.meanMotion(tleLine2);

    return (1440 / meanMo) as Minutes;
  }

  /**
   * Right ascension of the ascending node in degrees. Essentially, this is the angle of the satellite as it crosses
   * northward (ascending) across the Earth's equator (equatorial plane).
   * @example 208.9163
   * @param tleLine2 The second line of the Tle to parse.
   * @returns The right ascension of the satellite. (0 to 360)
   */
  static rightAscension(tleLine2: TleLine2): Degrees {
    const rightAscension = parseFloat(tleLine2.substring(Tle.rightAscension_.start, Tle.rightAscension_.stop));

    if (!(rightAscension >= 0 && rightAscension <= 360)) {
      throw new Error(`Invalid Right Ascension: ${rightAscension}`);
    }

    return toPrecision(rightAscension, 4) as Degrees;
  }

  /**
   * NORAD catalog number. To support Alpha-5, the first digit can be a letter. This will NOT be converted to a number.
   * Use satNum() for that.
   * @see https://en.wikipedia.org/wiki/Satellite_Catalog_Number
   * @example 25544
   * @example B1234
   * @param tleLine The first line of the Tle to parse.
   * @returns NORAD catalog number.
   */
  static rawSatNum(tleLine: TleLine1 | TleLine2): string {
    return tleLine.substring(Tle.satNum_.start, Tle.satNum_.stop);
  }

  /**
   * Total satellite revolutions when this Tle was generated. This number rolls over (e.g. 99999 -> 0).
   * @example 6766
   * @param tleLine2 The second line of the Tle to parse.
   * @returns The revolutions around the Earth per day (mean motion). (0 to 99999)
   */
  static revNum(tleLine2: TleLine2): number {
    return parseInt(tleLine2.substring(Tle.revNum_.start, Tle.revNum_.stop));
  }

  /**
   * NORAD catalog number converted to a number.
   * @see https://en.wikipedia.org/wiki/Satellite_Catalog_Number
   * @example 25544
   * @example 111234
   * @param tleLine The first line of the Tle to parse.
   * @returns NORAD catalog number. (0 to 339999)
   */
  static satNum(tleLine: TleLine1 | TleLine2): number {
    const satNumStr = tleLine.substring(Tle.satNum_.start, Tle.satNum_.stop);
    const sixDigitSatNum = Tle.convertA5to6Digit(satNumStr);

    return parseInt(sixDigitSatNum);
  }

  /**
   * Parse the first line of the Tle.
   * @param tleLine1 The first line of the Tle to parse.
   * @returns Returns the data from the first line of the Tle.
   */
  static parseLine1(tleLine1: TleLine1): Line1Data {
    const lineNumber1 = Tle.lineNumber(tleLine1);
    const satNum = Tle.satNum(tleLine1);
    const satNumRaw = Tle.rawSatNum(tleLine1);
    const classification = Tle.classification(tleLine1);
    const intlDes = Tle.intlDes(tleLine1);
    const intlDesYear = Tle.intlDesYear(tleLine1);
    const intlDesLaunchNum = Tle.intlDesLaunchNum(tleLine1);
    const intlDesLaunchPiece = Tle.intlDesLaunchPiece(tleLine1);
    const epochYear = Tle.epochYear(tleLine1);
    const epochYearFull = Tle.epochYearFull(tleLine1);
    const epochDay = Tle.epochDay(tleLine1);
    const meanMoDev1 = Tle.meanMoDev1(tleLine1);
    const meanMoDev2 = Tle.meanMoDev2(tleLine1);
    const bstar = Tle.bstar(tleLine1);
    const ephemerisType = Tle.ephemerisType(tleLine1);
    const elsetNum = Tle.elsetNum(tleLine1);
    const checksum1 = Tle.checksum(tleLine1);

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
   * Parse the second line of the Tle.
   * @param tleLine2 The second line of the Tle to parse.
   * @returns Returns the data from the second line of the Tle.
   */
  static parseLine2(tleLine2: TleLine2): Line2Data {
    const lineNumber2 = Tle.lineNumber(tleLine2);
    const satNum = Tle.satNum(tleLine2);
    const satNumRaw = Tle.rawSatNum(tleLine2);
    const inclination = Tle.inclination(tleLine2);
    const rightAscension = Tle.rightAscension(tleLine2);
    const eccentricity = Tle.eccentricity(tleLine2);
    const argOfPerigee = Tle.argOfPerigee(tleLine2);
    const meanAnomaly = Tle.meanAnomaly(tleLine2);
    const meanMotion = Tle.meanMotion(tleLine2);
    const revNum = Tle.revNum(tleLine2);
    const checksum2 = Tle.checksum(tleLine2);
    const period = Tle.period(tleLine2);

    return {
      lineNumber2,
      satNum,
      satNumRaw,
      inclination,
      rightAscension,
      eccentricity,
      argOfPerigee,
      meanAnomaly,
      meanMotion,
      revNum,
      checksum2,
      period,
    };
  }

  /**
   * Parses the Tle into orbital data.
   *
   * If you want all of the data then use parseTleFull instead.
   * @param tleLine1 Tle line 1
   * @param tleLine2 Tle line 2
   * @returns Returns most commonly used orbital data from Tle
   */
  static parse(tleLine1: TleLine1, tleLine2: TleLine2): TleData {
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
      rightAscension: line2.rightAscension,
      eccentricity: line2.eccentricity,
      argOfPerigee: line2.argOfPerigee,
      meanAnomaly: line2.meanAnomaly,
      meanMotion: line2.meanMotion,
      period: line2.period,
    };
  }

  /**
   * Parses all of the data contained in the Tle.
   *
   * If you only want the most commonly used data then use parseTle instead.
   * @param tleLine1 The first line of the Tle to parse.
   * @param tleLine2 The second line of the Tle to parse.
   * @returns Returns all of the data from the Tle.
   */
  static parseAll(tleLine1: TleLine1, tleLine2: TleLine2): TleDataFull {
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
   * Converts a 6 digit SCC number to a 5 digit SCC alpha 5 number
   * @param sccNum The 6 digit SCC number
   * @returns The 5 digit SCC alpha 5 number
   */
  static convert6DigitToA5(sccNum: string): string {
    // Only applies to 6 digit numbers
    if (sccNum.length < 6) {
      return sccNum;
    }

    // Already an alpha 5 number
    if (RegExp(/[A-Z]/iu, 'u').test(sccNum[0])) {
      return sccNum;
    }

    // Extract the trailing 4 digits
    const rest = sccNum.slice(2, 6);

    /*
     * Convert the first two digit numbers into a Letter. Skip I and O as they
     * look too similar to 1 and 0 A=10, B=11, C=12, D=13, E=14, F=15, G=16,
     * H=17, J=18, K=19, L=20, M=21, N=22, P=23, Q=24, R=25, S=26, T=27, U=28,
     * V=29, W=30, X=31, Y=32, Z=33
     */
    let first = parseInt(`${sccNum[0]}${sccNum[1]}`);
    const iPlus = first >= 18 ? 1 : 0;
    const tPlus = first >= 24 ? 1 : 0;

    first = first + iPlus + tPlus;

    return `${String.fromCharCode(first + 55)}${rest}`;
  }

  /**
   * Converts a 5-digit SCC number to a 6-digit SCC number.
   * @param sccNum - The 5-digit SCC number to convert.
   * @returns The converted 6-digit SCC number.
   */
  static convertA5to6Digit(sccNum: string): string {
    const values = sccNum.toUpperCase().split('');

    if (values[0] in Tle.alpha5_) {
      const firstLetter = values[0] as keyof typeof Tle.alpha5_;

      values[0] = Tle.alpha5_[firstLetter];
    }

    return values.join('');
  }
}
