/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The Sat class provides functions for calculating satellites positions relative
 * to earth based sensors and other orbital objects.
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2022 Theodore Kruczek
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

import { DAY_TO_MS, MINUTES_PER_DAY } from '../utils/constants';
import {
  EcfVec3,
  EciVec3,
  GreenwichMeanSiderealTime,
  LlaVec3,
  RaeVec3,
  SatelliteRecord,
  SpaceObjectType,
  StateVector,
} from '../types/types';

import { Sensor } from './sensor';
import { Sgp4 } from '../sgp4/sgp4';
import { SpaceObject } from './space-object';
import { Tle } from '../tle/tle';
import { Transforms } from '../transforms/transforms';
import { Utils } from '../utils/utils';

interface ObjectInfo {
  name?: string;
  type?: SpaceObjectType;
  rcs?: number;
  vmag?: number;
  tle1: string;
  tle2: string;
}

export class Sat extends SpaceObject {
  public satNum: number;
  public satrec: SatelliteRecord;
  public intlDes: string;
  public epochYear: number;
  public epochDay: number;
  public meanMoDev1: number;
  public meanMoDev2: number;
  public bstar: number;
  public inclination: number;
  public raan: number;
  public eccentricity: number;
  public argOfPerigee: number;
  public meanAnomaly: number;
  public meanMotion: number;
  public period: number;
  public apogee: number;
  public perigee: number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public options: any;

  constructor(info: ObjectInfo, options) {
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
    this.options = options;
  }

  public propagateTo(date: Date): Sat {
    const { m } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = (Sgp4.propagate(this.satrec, m).position as EciVec3) || { x: 0, y: 0, z: 0 };

    this.position = eci;
    this.time = date;

    return this;
  }

  /**
   * Calculates position and velocity in ECI coordinates at a given time.
   * @param {Date} date Date to calculate the state vector for
   * @returns {StateVector} State vector for the given date
   */
  public getStateVec(date: Date = this.time): StateVector {
    const { m } = Sat.calculateTimeVariables(date, this.satrec);

    return Sgp4.propagate(this.satrec, m);
  }

  /**
   * Calculates ECI position at a given time.
   * @param {Date} date Date to calculate
   * @returns {EciVec3} ECI position vector
   */
  public getEci(date: Date = this.time): EciVec3 {
    const { m } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = Sgp4.propagate(this.satrec, m).position;

    return eci ? (eci as EciVec3) : { x: 0, y: 0, z: 0 };
  }

  /**
   * Calculates ECF position at a given time.
   * @param {Date} date Date to calculate
   * @returns {EcfVec3} ECF position vector
   */
  public getEcf(date: Date = this.time): EcfVec3 {
    const { m, gmst } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = (Sgp4.propagate(this.satrec, m).position as EciVec3) || { x: 0, y: 0, z: 0 };

    return Transforms.eci2ecf(eci, gmst);
  }

  /**
   * Calculates LLA position at a given time.
   * @param {Date} date Date to calculate
   * @returns {LlaVec3} LLA position vector
   */
  public getLla(date: Date = this.time): LlaVec3 {
    const { m, gmst } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = (Sgp4.propagate(this.satrec, m).position as EciVec3) || { x: 0, y: 0, z: 0 };

    return Transforms.eci2lla(eci, gmst);
  }

  public getRae(sensor: Sensor, date: Date = this.time): RaeVec3 {
    const { m, gmst } = Sat.calculateTimeVariables(date, this.satrec);
    const eci = (Sgp4.propagate(this.satrec, m).position as EciVec3) || { x: 0, y: 0, z: 0 };
    const ecf = Transforms.eci2ecf(eci, gmst);

    return Transforms.ecf2rae({ lat: sensor.lat, lon: sensor.lon, alt: sensor.alt }, ecf);
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
