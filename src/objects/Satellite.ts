/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The Satellite class provides functions for calculating satellites positions
 * relative to earth based sensors and other orbital objects.
 *
 * @license MIT License
 * @Copyright (c) 2020-2024 Theodore Kruczek
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {
  Degrees,
  EcfVec3,
  EciVec3,
  GreenwichMeanSiderealTime,
  Kilometers,
  LlaVec3,
  OptionsParams,
  PosVel,
  Radians,
  RaeVec3,
  SatelliteParams,
  SatelliteRecord,
  SpaceObjectType,
  TleLine1,
  TleLine2,
} from '../types/types';
import { DEG2RAD, MILLISECONDS_TO_DAYS, MINUTES_PER_DAY, RAD2DEG } from '../utils/constants';

import { FormatTle } from '../coordinate/FormatTle';
import { Geodetic } from '../coordinate/Geodetic';
import { ITRF } from '../coordinate/ITRF';
import { J2000 } from '../coordinate/J2000';
import { RIC } from '../coordinate/RIC';
import { RAE } from '../observation/RAE';
import { Vector3D } from '../operations/Vector3D';
import { Sgp4 } from '../sgp4/sgp4';
import { EpochUTC } from '../time/EpochUTC';
import { Tle } from '../tle/tle';
import { ecf2rae, eci2ecf, eci2lla } from '../transforms';
import { Utils } from '../utils/utils';
import { BaseObject } from './BaseObject';
import { Sensor } from './Sensor';

/**
 * TODO: Reduce unnecessary calls to calculateTimeVariables using optional
 * parameters and caching.
 */

/**
 * Represents a satellite object with orbital information and methods for calculating its position and other properties.
 */
export class Satellite extends BaseObject {
  name: string;
  type: SpaceObjectType;
  position: EciVec3; // Where is the object
  time: Date; // When is the object there
  apogee: number;
  argOfPerigee: number;
  bstar: number;
  eccentricity: number;
  epochDay: number;
  epochYear: number;
  inclination: number;
  intlDes: string;
  meanAnomaly: number;
  meanMoDev1: number;
  meanMoDev2: number;
  meanMotion: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: OptionsParams;
  perigee: number;
  period: number;
  raan: number;
  satrec: SatelliteRecord;
  /**
   * The satellite catalog number as listed in the TLE.
   */
  sccNum: string;
  /**
   * The 5 digit alpha-numeric satellite catalog number.
   */
  sccNum5: string;
  /**
   * The 6 digit numeric satellite catalog number.
   */
  sccNum6: string;
  tle1: TleLine1;
  tle2: TleLine2;

  constructor(info: SatelliteParams, options?: OptionsParams) {
    super(info);

    const tleData = Tle.parseTle(info.tle1, info.tle2);

    this.tle1 = info.tle1;
    this.tle2 = info.tle2;

    this.sccNum = info.sccNum || tleData.satNum.toString();
    this.sccNum5 = FormatTle.convert6DigitToA5(this.sccNum);
    this.sccNum6 = FormatTle.convertA5to6Digit(this.sccNum5);
    this.epochYear = tleData.epochYear;
    this.epochDay = tleData.epochDay;
    this.meanMoDev1 = tleData.meanMoDev1;
    this.meanMoDev2 = tleData.meanMoDev2;
    this.bstar = tleData.bstar;
    this.inclination = tleData.inclination;
    this.raan = tleData.raan;
    this.eccentricity = tleData.eccentricity;
    this.argOfPerigee = tleData.argOfPerigee;
    this.meanAnomaly = tleData.meanAnomaly;
    this.meanMotion = tleData.meanMotion;
    this.period = 1440 / this.meanMotion;

    // NOTE: Calculate apogee and perigee

    this.satrec = Sgp4.createSatrec(info.tle1, info.tle2);
    this.options = options || {
      notes: '',
    };
  }

  isSatellite(): boolean {
    return true;
  }

  isStatic(): boolean {
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

  /**
   * Calculates the azimuth angle of the satellite relative to the given sensor at the specified date.
   * If no date is provided, the current time of the satellite is used.
   *
   * @optimized
   */
  az(sensor: Sensor, date: Date = this.time): Degrees {
    return (this.raeOpt(sensor, date).az * RAD2DEG) as Degrees;
  }

  /**
   * Calculates the RAE (Range, Azimuth, Elevation) values for a given sensor and date.
   * If no date is provided, the current time is used.
   *
   * @expanded
   */
  rae(sensor: Sensor, date: Date = this.time): RAE {
    const rae = this.raeOpt(sensor, date);
    const epoch = new EpochUTC(date.getTime());

    return new RAE(epoch, rae.rng, (rae.az * DEG2RAD) as Radians, (rae.el * DEG2RAD) as Radians);
  }

  /**
   * Calculates ECF position at a given time.
   *
   * @optimized
   */
  getEcf(date: Date = this.time): EcfVec3<Kilometers> {
    const { gmst } = Satellite.calculateTimeVariables(date);

    return eci2ecf(this.getEci(date).position, gmst);
  }

  /**
   * Calculates ECI position at a given time.
   *
   * @optimized
   */
  getEci(date: Date = this.time): PosVel<Kilometers> {
    const { m } = Satellite.calculateTimeVariables(date, this.satrec);
    const pv = Sgp4.propagate(this.satrec, m);

    if (!pv) {
      throw new Error('Propagation failed!');
    } else {
      return pv as PosVel<Kilometers>;
    }
  }

  /**
   * Calculates the J2000 coordinates for a given date.
   * If no date is provided, the current time is used.
   * @param date - The date for which to calculate the J2000 coordinates.
   * @returns The J2000 coordinates for the specified date.
   * @throws Error if propagation fails.
   */
  getJ2000(date: Date = this.time): J2000 {
    const { m } = Satellite.calculateTimeVariables(date, this.satrec);
    const pv = Sgp4.propagate(this.satrec, m);

    if (!pv.position) {
      throw new Error('Propagation failed!');
    } else {
      const p = pv.position as EciVec3;
      const v = pv.velocity as EciVec3;

      const epoch = new EpochUTC(date.getTime());
      const pos = new Vector3D(p.x, p.y, p.z);
      const vel = new Vector3D(v.x, v.y, v.z);

      return new J2000(epoch, pos, vel);
    }
  }

  /**
   * Returns the elevation angle of the satellite as seen by the given sensor at the specified time.
   *
   * @optimized
   */
  el(sensor: Sensor, date: Date = this.time): Degrees {
    return (this.raeOpt(sensor, date).el * RAD2DEG) as Degrees;
  }

  /**
   * Calculates LLA position at a given time.
   */
  lla(date: Date = this.time): LlaVec3<Degrees, Kilometers> {
    const { gmst } = Satellite.calculateTimeVariables(date, this.satrec);
    const pos = this.getEci(date).position;

    return eci2lla(pos, gmst);
  }

  getGeodetic(date: Date = this.time): Geodetic {
    return this.getJ2000(date).toITRF().toGeodetic();
  }

  getITRF(date: Date = this.time): ITRF {
    return this.getJ2000(date).toITRF();
  }

  getRIC(reference: Satellite, date: Date = this.time): RIC {
    return RIC.fromJ2000(this.getJ2000(date), reference.getJ2000(date));
  }

  /**
   * Calculates the RAE (Range, Azimuth, Elevation) vector for a given sensor and time.
   *
   * @optimized
   */
  raeOpt(sensor: Sensor, date: Date = this.time): RaeVec3<Kilometers, Degrees> {
    const { gmst } = Satellite.calculateTimeVariables(date, this.satrec);
    const eci = this.getEci(date).position;
    const ecf = eci2ecf(eci, gmst);

    const lla = {
      lat: (sensor.lat * DEG2RAD) as Radians,
      lon: (sensor.lon * DEG2RAD) as Radians,
      alt: sensor.alt,
    };

    return ecf2rae(lla, ecf);
  }

  /**
   * Returns the range of the satellite from the given sensor at the specified time.
   *
   * @optimized
   */
  range(sensor: Sensor, date: Date = this.time): Kilometers {
    return this.raeOpt(sensor, date).rng;
  }

  /**
   * Propagates the satellite position to the given date using the SGP4 model.
   *
   * This method changes the position and time properties of the satellite object.
   */
  propagateTo(date: Date): this {
    const pv = this.getEci(date);

    this.position = pv.position as EciVec3;
    this.time = date;

    return this;
  }

  /**
   * Calculates the time variables for a given date relative to the TLE epoch.
   * @param {Date} date Date to calculate
   * @param {SatelliteRecord} satrec Satellite orbital information
   * @returns {{m: number, gmst: GreenwichMeanSiderealTime, j: number}} Time variables
   */
  private static calculateTimeVariables(
    date: Date,
    satrec?: SatelliteRecord,
  ): { gmst: GreenwichMeanSiderealTime; m: number; j: number } {
    const j =
      Utils.jday(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      ) +
      date.getUTCMilliseconds() * MILLISECONDS_TO_DAYS;
    const gmst = Sgp4.gstime(j);

    const m = satrec ? (j - satrec.jdsatepoch) * MINUTES_PER_DAY : null;

    return { gmst, m, j };
  }
}
