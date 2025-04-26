/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2025 Theodore Kruczek Permission is
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

import type { ClassicalElements } from '../coordinate/index.js';
import { Geodetic } from '../coordinate/Geodetic.js';
import { ITRF } from '../coordinate/ITRF.js';
import { J2000 } from '../coordinate/J2000.js';
import { RIC } from '../coordinate/RIC.js';
import { Tle } from '../coordinate/Tle.js';
import { OptionsParams } from '../interfaces/OptionsParams.js';
import { SatelliteParams } from '../interfaces/SatelliteParams.js';
import { RAE } from '../observation/RAE.js';
import { Vector3D } from '../operations/Vector3D.js';
import { EpochUTC } from '../time/EpochUTC.js';
import { ecf2rae, eci2ecf, eci2lla, jday } from '../transforms/index.js';
import {
  Degrees,
  EcfVec3,
  EciVec3,
  GreenwichMeanSiderealTime,
  Kilometers,
  KilometersPerSecond,
  LlaVec3,
  Minutes,
  PosVel,
  Radians,
  RaeVec3,
  SatelliteRecord,
  Seconds,
  TleLine1,
  TleLine2,
} from '../types/types.js';
import { DEG2RAD, MILLISECONDS_TO_DAYS, MINUTES_PER_DAY, RAD2DEG } from '../utils/constants.js';
import { dopplerFactor } from './../utils/functions.js';
import { BaseObject } from './BaseObject.js';
import { GroundObject } from './GroundObject.js';
import { OmmDataFormat, OmmParsedDataFormat } from '../interfaces/OmmFormat.js';
import { Sgp4 } from '../main.js';

/**
 * Represents a satellite object with orbital information and methods for
 * calculating its position and other properties.
 */
export class Satellite extends BaseObject {
  apogee!: Kilometers;
  argOfPerigee!: Degrees;
  bstar!: number;
  eccentricity!: number;
  epochDay!: number;
  epochYear!: number;
  inclination!: Degrees;
  intlDes!: string;
  meanAnomaly!: Degrees;
  meanMoDev1!: number;
  meanMoDev2!: number;
  meanMotion!: number;
  options: OptionsParams;
  perigee!: Kilometers;
  period!: Minutes;
  rightAscension!: Degrees;
  satrec!: SatelliteRecord;
  /** The satellite catalog number as listed in the TLE. */
  sccNum!: string;
  /** The 5 digit alpha-numeric satellite catalog number. */
  sccNum5!: string;
  /** The 6 digit numeric satellite catalog number. */
  sccNum6!: string;
  tle1!: TleLine1;
  tle2!: TleLine2;
  /** The semi-major axis of the satellite's orbit. */
  semiMajorAxis!: Kilometers;
  /** The semi-minor axis of the satellite's orbit. */
  semiMinorAxis!: Kilometers;

  constructor(info: SatelliteParams, options?: OptionsParams) {
    super(info);

    if (info.tle1 && info.tle2) {
      this.parseTleAndUpdateOrbit_(info.tle1, info.tle2, info.sccNum);
    } else if (info.omm) {
      this.parseOmmAndUpdateOrbit_(info.omm);
    } else {
      throw new Error('tle1 and tle2 or omm must be provided to create a Satellite object.');
    }

    this.options = options ?? {
      notes: '',
    };
  }

  private parseTleAndUpdateOrbit_(tle1: TleLine1, tle2: TleLine2, sccNum?: string) {
    const tleData = Tle.parse(tle1, tle2);

    this.tle1 = tle1;
    this.tle2 = tle2;

    this.sccNum = sccNum ?? tleData.satNum.toString();
    this.sccNum5 = Tle.convert6DigitToA5(this.sccNum);
    this.sccNum6 = Tle.convertA5to6Digit(this.sccNum5);
    this.intlDes = tleData.intlDes;
    this.epochYear = tleData.epochYear;
    this.epochDay = tleData.epochDay;
    this.meanMoDev1 = tleData.meanMoDev1;
    this.meanMoDev2 = tleData.meanMoDev2;
    this.bstar = tleData.bstar;
    this.inclination = tleData.inclination;
    this.rightAscension = tleData.rightAscension;
    this.eccentricity = tleData.eccentricity;
    this.argOfPerigee = tleData.argOfPerigee;
    this.meanAnomaly = tleData.meanAnomaly;
    this.meanMotion = tleData.meanMotion;
    this.period = tleData.period;
    this.semiMajorAxis = ((8681663.653 / this.meanMotion) ** (2 / 3)) as Kilometers;
    this.semiMinorAxis = (this.semiMajorAxis * Math.sqrt(1 - this.eccentricity ** 2)) as Kilometers;
    this.apogee = (this.semiMajorAxis * (1 + this.eccentricity) - 6371) as Kilometers;
    this.perigee = (this.semiMajorAxis * (1 - this.eccentricity) - 6371) as Kilometers;
    this.satrec = Sgp4.createSatrec(tle1, tle2);
  }

  private parseOmmAndUpdateOrbit_(omm: OmmDataFormat) {
    this.sccNum = omm.NORAD_CAT_ID.padStart(5, '0');
    this.sccNum5 = Tle.convert6DigitToA5(omm.NORAD_CAT_ID);
    this.sccNum6 = Tle.convertA5to6Digit(this.sccNum5);
    this.intlDes = omm.OBJECT_ID;
    const YYYY = omm.EPOCH.slice(0, 4);
    const MM = omm.EPOCH.slice(5, 7);
    const DD = omm.EPOCH.slice(8, 10);
    const hh = omm.EPOCH.slice(11, 13);
    const mm = omm.EPOCH.slice(14, 16);
    const ss = omm.EPOCH.slice(17, 23);
    const epochDateObj = Date.UTC(Number(YYYY), Number(MM) - 1, Number(DD), Number(hh), Number(mm), Number(ss));
    const dayOfYear = (epochDateObj - Date.UTC(Number(YYYY), 0, 0)) / 86400000;

    const ommParsed: OmmParsedDataFormat = {
      ...omm,
      epoch: {
        year: Number(YYYY),
        month: Number(MM),
        day: Number(DD),
        hour: Number(hh),
        minute: Number(mm),
        second: Number(ss),
        doy: dayOfYear,
      },
    };

    this.epochYear = parseInt(YYYY.slice(2, 4));
    this.epochDay = dayOfYear;
    this.meanMoDev1 = parseFloat(omm.MEAN_MOTION_DOT);
    this.meanMoDev2 = parseFloat(omm.MEAN_MOTION_DDOT);
    this.bstar = parseFloat(omm.BSTAR);
    this.inclination = parseFloat(omm.INCLINATION) as Degrees;
    this.rightAscension = parseFloat(omm.RA_OF_ASC_NODE) as Degrees;
    this.eccentricity = parseFloat(omm.ECCENTRICITY);
    this.argOfPerigee = parseFloat(omm.ARG_OF_PERICENTER) as Degrees;
    this.meanAnomaly = parseFloat(omm.MEAN_ANOMALY) as Degrees;
    this.meanMotion = parseFloat(omm.MEAN_MOTION);
    this.period = 1440 / this.meanMotion as Minutes;
    this.semiMajorAxis = ((8681663.653 / this.meanMotion) ** (2 / 3)) as Kilometers;
    this.semiMinorAxis = (this.semiMajorAxis * Math.sqrt(1 - this.eccentricity ** 2)) as Kilometers;
    this.apogee = (this.semiMajorAxis * (1 + this.eccentricity) - 6371) as Kilometers;
    this.perigee = (this.semiMajorAxis * (1 - this.eccentricity) - 6371) as Kilometers;
    this.satrec = Sgp4.createSatrecFromOmm(ommParsed);
  }

  /**
   * Checks if the object is a satellite.
   * @returns True if the object is a satellite, false otherwise.
   */
  override isSatellite(): boolean {
    return true;
  }

  /**
   * Returns whether the satellite is static or not.
   * @returns True if the satellite is static, false otherwise.
   */
  override isStatic(): boolean {
    return false;
  }

  /**
   * Checks if the given SatelliteRecord object is valid by checking if its properties are all numbers.
   * @param satrec - The SatelliteRecord object to check.
   * @returns True if the SatelliteRecord object is valid, false otherwise.
   */
  static isValidSatrec(satrec: SatelliteRecord): boolean {
    if (
      isNaN(satrec.a) ||
      isNaN(satrec.am) ||
      isNaN(satrec.alta) ||
      isNaN(satrec.em) ||
      isNaN(satrec.mo) ||
      isNaN(satrec.ecco) ||
      isNaN(satrec.no)
    ) {
      return false;
    }

    return true;
  }

  ageOfElset(nowInput?: Date, outputUnits: 'days' | 'hours' | 'minutes' | 'seconds' = 'days'): number {
    return Tle.calcElsetAge(this, nowInput, outputUnits);
  }

  editTle(tle1: TleLine1, tle2: TleLine2, sccNum?: string): void {
    this.parseTleAndUpdateOrbit_(tle1, tle2, sccNum);
  }

  /**
   * Calculates the azimuth angle of the satellite relative to the given sensor at the specified date. If no date is
   * provided, the current time of the satellite is used.
   * @variation optimized
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the azimuth angle. Optional, defaults to the current date.
   * @returns The azimuth angle of the satellite relative to the given sensor at the specified date.
   */
  az(observer: GroundObject, date: Date = new Date()): Degrees | null {
    const rae = this.rae(observer, date);

    if (!rae) {
      return null;
    }

    return (rae.az * RAD2DEG) as Degrees;
  }

  /**
   * Calculates the RAE (Range, Azimuth, Elevation) values for a given sensor and date. If no date is provided, the
   * current time is used.
   * @variation expanded
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the RAE values. Optional, defaults to the current date.
   * @returns The RAE values for the given sensor and date.
   */
  toRae(observer: GroundObject, date: Date = new Date()): RAE | null {
    const rae = this.rae(observer, date);

    if (!rae) {
      return null;
    }

    const rae2 = this.rae(observer, new Date(date.getTime() + 1000));

    if (!rae2) {
      return null;
    }

    const epoch = new EpochUTC(date.getTime() / 1000 as Seconds);
    const rangeRate = rae2.rng - rae.rng;
    const azimuthRate = rae2.az - rae.az;
    const elevationRate = rae2.el - rae.el;

    return new RAE(
      epoch,
      rae.rng,
      (rae.az * DEG2RAD) as Radians,
      (rae.el * DEG2RAD) as Radians,
      rangeRate,
      azimuthRate,
      elevationRate,
    );
  }

  /**
   * Calculates ECF position at a given time.
   * @variation optimized
   * @param date - The date at which to calculate the ECF position. Optional, defaults to the current date.
   * @returns The ECF position at the specified date.
   */
  ecf(date: Date = new Date()): EcfVec3<Kilometers> | null {
    const { gmst } = Satellite.calculateTimeVariables(date);
    const eci = this.eci(date);

    if (!eci) {
      return null;
    }

    return eci2ecf(eci.position, gmst);
  }

  /**
   * Calculates ECI position at a given time.
   * @variation optimized
   * @param date - The date at which to calculate the ECI position. Optional, defaults to the current date.
   * @param j - Julian date. Optional, defaults to null.
   * @param gmst - Greenwich Mean Sidereal Time. Optional, defaults to null.
   * @returns The ECI position at the specified date.
   */
  eci(date?: Date, j?: number, gmst?: GreenwichMeanSiderealTime): PosVel | null {
    date ??= new Date();
    const { m } = Satellite.calculateTimeVariables(date, this.satrec, j, gmst);

    if (!m) {
      return null;
    }
    const pv = Sgp4.propagate(this.satrec, m);

    if (!pv.position || !pv.velocity) {
      return null;
    }

    return pv as PosVel;
  }

  /**
   * Calculates the J2000 coordinates for a given date. If no date is provided, the current time is used.
   * @variation expanded
   * @param date - The date for which to calculate the J2000 coordinates, defaults to the current date.
   * @returns The J2000 coordinates for the specified date.
   * @throws Error if propagation fails.
   */
  toJ2000(date: Date = new Date()): J2000 {
    const { m } = Satellite.calculateTimeVariables(date, this.satrec);

    if (!m) {
      throw new Error('Propagation failed!');
    }
    const pv = Sgp4.propagate(this.satrec, m);

    if (!pv.position) {
      throw new Error('Propagation failed!');
    } else {
      const p = pv.position as EciVec3;
      const v = pv.velocity as EciVec3<KilometersPerSecond>;

      const epoch = new EpochUTC(date.getTime() / 1000 as Seconds);
      const pos = new Vector3D(p.x, p.y, p.z);
      const vel = new Vector3D(v.x, v.y, v.z);

      return new J2000(epoch, pos, vel);
    }
  }

  /**
   * Returns the elevation angle of the satellite as seen by the given sensor at the specified time.
   * @variation optimized
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the elevation angle. Optional, defaults to the current date.
   * @returns The elevation angle of the satellite as seen by the given sensor at the specified time.
   */
  el(observer: GroundObject, date: Date = new Date()): Degrees | null {
    const rae = this.rae(observer, date);

    if (!rae) {
      return null;
    }

    return (rae.el * RAD2DEG) as Degrees;
  }

  /**
   * Calculates LLA position at a given time.
   * @variation optimized
   * @param date - The date at which to calculate the LLA position. Optional, defaults to the current date.
   * @param j - Julian date. Optional, defaults to null.
   * @param gmst - Greenwich Mean Sidereal Time. Optional, defaults to null.
   * @returns The LLA position at the specified date.
   */
  lla(date?: Date, j?: number, gmst?: GreenwichMeanSiderealTime):
    LlaVec3<Degrees, Kilometers> | null {
    date ??= new Date();
    if (!j || !gmst) {
      const timeVar = Satellite.calculateTimeVariables(date, this.satrec);

      j = timeVar.j;
      gmst = timeVar.gmst;
    }

    const eci = this.eci(date, j, gmst);

    if (!eci) {
      return null;
    }

    const pos = eci.position;
    const lla = eci2lla(pos, gmst);

    return lla;
  }

  /**
   * Converts the satellite's position to geodetic coordinates.
   * @variation expanded
   * @param date The date for which to calculate the geodetic coordinates. Defaults to the current date.
   * @returns The geodetic coordinates of the satellite.
   */
  toGeodetic(date: Date = new Date()): Geodetic {
    return this.toJ2000(date).toITRF().toGeodetic();
  }

  /**
   * Converts the satellite's position to the International Terrestrial Reference Frame (ITRF) at the specified date.
   * If no date is provided, the current date is used.
   * @variation expanded
   * @param date The date for which to convert the position. Defaults to the current date.
   * @returns The satellite's position in the ITRF at the specified date.
   */
  toITRF(date: Date = new Date()): ITRF {
    return this.toJ2000(date).toITRF();
  }

  /**
   * Converts the current satellite's position to the Reference-Inertial-Celestial (RIC) frame
   * relative to the specified reference satellite at the given date.
   * @variation expanded
   * @param reference The reference satellite.
   * @param date The date for which to calculate the RIC frame. Defaults to the current date.
   * @returns The RIC frame representing the current satellite's position relative to the reference satellite.
   */
  toRIC(reference: Satellite, date: Date = new Date()): RIC {
    return RIC.fromJ2000(this.toJ2000(date), reference.toJ2000(date));
  }

  /**
   * Converts the satellite object to a TLE (Two-Line Element) object.
   * @returns The TLE object representing the satellite.
   */
  toTle(): Tle {
    return new Tle(this.tle1, this.tle2);
  }

  /**
   * Converts the satellite's position to classical orbital elements.
   * @param date The date for which to calculate the classical elements. Defaults to the current date.
   * @returns The classical orbital elements of the satellite.
   */
  toClassicalElements(date: Date = new Date()): ClassicalElements {
    return this.toJ2000(date).toClassicalElements();
  }

  /**
   * Calculates the RAE (Range, Azimuth, Elevation) vector for a given sensor and time.
   * @variation optimized
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the RAE vector. Optional, defaults to the current date.
   * @param j - Julian date. Optional, defaults to null.
   * @param gmst - Greenwich Mean Sidereal Time. Optional, defaults to null.
   * @returns The RAE vector for the given sensor and time.
   */
  rae(observer: GroundObject, date?: Date, j?: number, gmst?: GreenwichMeanSiderealTime):
    RaeVec3<Kilometers, Degrees> | null {
    date ??= new Date();
    gmst ??= Satellite.calculateTimeVariables(date, this.satrec).gmst;
    const eci = this.eci(date, j, gmst);

    if (!eci) {
      return null;
    }

    const ecf = eci2ecf(eci.position, gmst);

    return ecf2rae(observer, ecf);
  }

  /**
   * Returns the range of the satellite from the given sensor at the specified time.
   * @variation optimized
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the range. Optional, defaults to the current date.
   * @returns The range of the satellite from the given sensor at the specified time.
   */
  rng(observer: GroundObject, date: Date = new Date()): Kilometers | null {
    const rae = this.rae(observer, date);

    if (!rae) {
      return null;
    }

    return rae.rng;
  }

  /**
   * Applies the Doppler effect to the given frequency based on the observer's position and the date.
   * @param freq - The frequency to apply the Doppler effect to.
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the Doppler effect. Optional, defaults to the current date.
   * @returns The frequency after applying the Doppler effect.
   */
  applyDoppler(freq: number, observer: GroundObject, date?: Date): number | null {
    const doppler = this.dopplerFactor(observer, date);

    if (!doppler) {
      return null;
    }

    return freq * doppler;
  }

  /**
   * Calculates the Doppler factor for the satellite.
   * @param observer The observer's ground position.
   * @param date The optional date for which to calculate the Doppler factor. If not provided, the current date is used.
   * @returns The calculated Doppler factor.
   */
  dopplerFactor(observer: GroundObject, date?: Date): number | null {
    const position = this.eci(date);

    if (!position) {
      return null;
    }

    return dopplerFactor(observer.eci(date), position.position, position.velocity);
  }

  /**
   * Calculates the time variables for a given date relative to the TLE epoch.
   * @param date Date to calculate
   * @param satrec Satellite orbital information
   * @param j Julian date
   * @param gmst Greenwich Mean Sidereal Time
   * @returns Time variables
   */
  private static calculateTimeVariables(
    date: Date, satrec?: SatelliteRecord, j?: number, gmst?: GreenwichMeanSiderealTime,
  ) {
    j ??= jday(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ) + date.getUTCMilliseconds() * MILLISECONDS_TO_DAYS;
    gmst ??= Sgp4.gstime(j);

    const m = satrec ? (j - satrec.jdsatepoch) * MINUTES_PER_DAY : null;

    return { gmst, m, j };
  }
}
