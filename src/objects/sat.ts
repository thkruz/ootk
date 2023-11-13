/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The Sat class provides functions for calculating satellites positions relative
 * to earth based sensors and other orbital objects.
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2023 Theodore Kruczek
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General License for more details.
 *
 * You should have received a copy of the GNU Affero General License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

import {
  EcfVec3,
  EciVec3,
  GreenwichMeanSiderealTime,
  Kilometers,
  LlaVec3,
  RaeVec3,
  SatelliteRecord,
  SpaceObjectType,
  StateVector,
  TleLine1,
  TleLine2,
} from '../types/types';
import { DAY_TO_MS, MINUTES_PER_DAY } from '../utils/constants';

import { Sgp4 } from '../sgp4/sgp4';
import { Tle } from '../tle/tle';
import { Transforms } from '../transforms/transforms';
import { Utils } from '../utils/utils';
import { Sensor } from './sensor';
import { SpaceObject } from './space-object';

/**
 * Information about a space object.
 */
interface ObjectInfo {
  name?: string;
  rcs?: number;
  tle1: TleLine1;
  tle2: TleLine2;
  type?: SpaceObjectType;
  vmag?: number;
}

export interface OptionsParams {
  notes: string;
}

/**
 * Represents a satellite object with orbital information and methods for calculating its position and other properties.
 */
export class Sat extends SpaceObject {
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
  satNum: number;
  satrec: SatelliteRecord;

  constructor(info: ObjectInfo, options?: OptionsParams) {
    super(info);

    const tleData = Tle.parseTle(info.tle1, info.tle2);

    this.satNum = tleData.satNum;
    this.intlDes = tleData.intlDes;
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
   * @param sensor The sensor observing the satellite.
   * @param date The date at which to calculate the azimuth angle.
   * @returns The azimuth angle in degrees.
   */
  getAzimuth(sensor: Sensor, date: Date = this.time): number {
    const rae = this.getRae(sensor, date);

    return rae.az;
  }

  /**
   * Calculates ECF position at a given time.
   * @param {Date} date Date to calculate
   * @returns {EcfVec3} ECF position vector
   */
  getEcf(date: Date = this.time): EcfVec3 {
    const { m, gmst } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = (Sgp4.propagate(this.satrec, m).position as EciVec3) || {
      x: <Kilometers>0,
      y: <Kilometers>0,
      z: <Kilometers>0,
    };

    return Transforms.eci2ecf(eci, gmst);
  }

  /**
   * Calculates ECI position at a given time.
   * @param {Date} date Date to calculate
   * @returns {EciVec3} ECI position vector
   */
  getEci(date: Date = this.time): EciVec3 {
    const { m } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = (Sgp4.propagate(this.satrec, m).position as EciVec3) || {
      x: <Kilometers>0,
      y: <Kilometers>0,
      z: <Kilometers>0,
    };

    return eci;
  }

  /**
   * Returns the elevation angle of the satellite as seen by the given sensor at the specified time.
   * @param sensor - The sensor observing the satellite.
   * @param date - The time at which to calculate the elevation angle. Defaults to the current time of the satellite.
   * @returns The elevation angle of the satellite in degrees.
   */
  getElevation(sensor: Sensor, date: Date = this.time): number {
    const rae = this.getRae(sensor, date);

    return rae.el;
  }

  /**
   * Calculates LLA position at a given time.
   * @param {Date} date Date to calculate
   * @returns {LlaVec3} LLA position vector
   */
  getLla(date: Date = this.time): LlaVec3 {
    const { m, gmst } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = (Sgp4.propagate(this.satrec, m).position as EciVec3) || {
      x: <Kilometers>0,
      y: <Kilometers>0,
      z: <Kilometers>0,
    };

    return Transforms.eci2lla(eci, gmst);
  }

  /**
   * Calculates the RAE (Range, Azimuth, Elevation) vector for a given sensor and time.
   * @param sensor - The sensor for which to calculate the RAE vector.
   * @param date - The date and time for which to calculate the RAE vector. Defaults to the current time.
   * @returns The RAE vector for the given sensor and time.
   */
  getRae(sensor: Sensor, date: Date = this.time): RaeVec3 {
    const { m, gmst } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = (Sgp4.propagate(this.satrec, m).position as EciVec3) || {
      x: <Kilometers>0,
      y: <Kilometers>0,
      z: <Kilometers>0,
    };
    const ecf = Transforms.eci2ecf(eci, gmst);

    return Transforms.ecf2rae({ lat: sensor.lat, lon: sensor.lon, alt: sensor.alt }, ecf);
  }

  /**
   * Returns the range of the satellite from the given sensor at the specified time.
   * @param sensor The sensor observing the satellite.
   * @param date The time at which to calculate the range. Defaults to the current time of the satellite.
   * @returns The range of the satellite from the sensor, in kilometers.
   */
  getRange(sensor: Sensor, date: Date = this.time): number {
    const rae = this.getRae(sensor, date);

    return rae.rng;
  }

  /**
   * Calculates position and velocity in ECI coordinates at a given time.
   * @param {Date} date Date to calculate the state vector for
   * @returns {StateVector} State vector for the given date
   */
  getStateVec(date: Date = this.time): StateVector {
    const { m } = Sat.calculateTimeVariables(date, this.satrec);

    return Sgp4.propagate(this.satrec, m);
  }

  /**
   * Propagates the satellite position to the given date using the SGP4 model.
   * @param date The date to propagate the satellite position to.
   * @returns This satellite object with updated position and time properties.
   */
  propagateTo(date: Date): this {
    const { m } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = (Sgp4.propagate(this.satrec, m).position as EciVec3) || {
      x: <Kilometers>0,
      y: <Kilometers>0,
      z: <Kilometers>0,
    };

    this.position = eci;
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
      date.getUTCMilliseconds() * DAY_TO_MS;
    const gmst = Sgp4.gstime(j);

    const m = satrec ? (j - satrec.jdsatepoch) * MINUTES_PER_DAY : null;

    return { gmst, m, j };
  }
}
