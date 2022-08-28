/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The Sensor class is used for creating ground based observers.
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

import { Degrees, Kilometer, RaeVec3, SpaceObjectType } from '../types/types';

import { BaseObject } from './base-object';
import { RAD2DEG } from '../utils/constants';
import { Sat } from './sat';

interface ObjectInfo {
  name?: string;
  type?: SpaceObjectType;
  lat: number;
  lon: number;
  alt: number;
  minAz: Degrees;
  maxAz: Degrees;
  minEl: Degrees;
  maxEl: Degrees;
  minRng: Kilometer;
  maxRng: Kilometer;
}

export enum PassType {
  OUT_OF_VIEW = -1,
  ENTER = 0,
  IN_VIEW = 1,
  EXIT = 2,
}

type Lookangles = {
  type: PassType;
  time: Date;
  az: number;
  el: number;
  rng: number;
  maxElPass?: number;
};

const TAU = Math.PI * 2;

export class Sensor extends BaseObject {
  public lat: number;
  public lon: number;
  public alt: number;
  public minAz: Degrees;
  public maxAz: Degrees;
  public minEl: Degrees;
  public maxEl: Degrees;
  public minRng: Kilometer;
  public maxRng: Kilometer;

  /**
   * * name: Name as a string - OPTIONAL
   * * type: SpaceObjectType - OPTIONAL
   * * lat: Latitude in Radians
   * * lon: Longitude in Radians
   * * alt: Altitude in Kilometers
   * * minAz: Minimum Azimuth in Degrees
   * * maxAz: Maximum Azimuth in Degrees
   * * minEl: Minimum Elevation in Degrees
   * * maxEl: Maximum Elevation in Degrees
   * * minRng: Minimum Range in Kilometers
   * * maxRng: Maximum Range in Kilometers
   * @param {ObjectInfo} info ObjectInfo object containing the object's information
   */
  constructor(info: ObjectInfo) {
    // If there is a sensor type verify it is valid
    if (info.type) {
      switch (info.type) {
        case SpaceObjectType.OPTICAL:
        case SpaceObjectType.MECHANICAL:
        case SpaceObjectType.PHASED_ARRAY_RADAR:
        case SpaceObjectType.OBSERVER:
        case SpaceObjectType.BISTATIC_RADIO_TELESCOPE:
          break;
        default:
          throw new Error('Invalid sensor type');
      }
    }

    super(info);

    this.validateInputData(info);
  }

  private validateInputData(info: ObjectInfo) {
    this.validateLla(info);
    this.validateFov(info);
  }

  private validateFov(info: ObjectInfo) {
    if (info.minAz >= 0 && info.minAz <= 360) {
      this.minAz = info.minAz;
    } else if (typeof info.minAz === 'undefined') {
      // Default is a telescope
      this.minAz = 0;
    } else {
      throw new Error('Invalid minimum azimuth - must be between 0 and 360');
    }

    if (info.maxAz >= 0 && info.maxAz <= 360) {
      this.maxAz = info.maxAz;
    } else if (typeof info.maxAz === 'undefined') {
      // Default is a telescope
      this.maxAz = 360;
    } else {
      throw new Error('Invalid maximum azimuth - must be between 0 and 360');
    }

    if (info.minEl >= 0 && info.minEl <= 90) {
      this.minEl = info.minEl;
    } else if (typeof info.minEl === 'undefined') {
      // Default is a telescope
      this.minEl = 0;
    } else {
      throw new Error('Invalid minimum elevation - must be between 0 and 90');
    }

    if (info.maxEl >= 0 && info.maxEl <= 180) {
      this.maxEl = info.maxEl;
    } else if (typeof info.maxEl === 'undefined') {
      // Default is a telescope
      this.maxEl = 90;
    } else {
      throw new Error('Invalid maximum elevation - must be between 0 and 180');
    }

    if (info.minRng >= 0) {
      this.minRng = info.minRng;
    } else if (typeof info.minRng === 'undefined') {
      // Default is a telescope
      this.minRng = 0;
    } else {
      throw new Error('Invalid minimum range - must be greater than 0');
    }
    if (info.maxRng >= 0) {
      this.maxRng = info.maxRng;
    } else if (typeof info.maxRng === 'undefined') {
      // Default is a telescope
      this.maxRng = 50000; // arbitrary large number
    } else {
      throw new Error('Invalid maximum range - must be greater than 0');
    }
  }

  private validateLla(info: ObjectInfo) {
    if (info.lat >= -90 && info.lat <= 90) {
      this.lat = info.lat;
    } else {
      throw new Error('Invalid latitude');
    }

    if (info.lon >= -180 && info.lon <= 180) {
      this.lon = info.lon;
    } else {
      throw new Error('Invalid longitude');
    }

    if (info.alt >= 0) {
      this.alt = info.alt;
    } else {
      throw new Error('Invalid altitude');
    }
  }

  public setTime(date: Date): Sensor {
    this.time = date;

    return this;
  }

  public getRae(sat: Sat, date: Date = this.time): RaeVec3 {
    return sat.getRae(this, date);
  }

  public isRaeInFov(rae: RaeVec3): boolean {
    if (rae.el * RAD2DEG < this.minEl || rae.el * RAD2DEG > this.maxEl) {
      return false;
    }

    if (rae.rng < this.minRng || rae.rng > this.maxRng) {
      return false;
    }

    if (this.minAz * RAD2DEG > this.maxAz) {
      // North Facing Sensors
      if (rae.az * RAD2DEG < this.minAz && rae.az * RAD2DEG > this.maxAz) {
        return false;
      }
      // Normal Facing Sensors
    } else if (rae.az * RAD2DEG < this.minAz || rae.az * RAD2DEG > this.maxAz) {
      return false;
    }

    return true;
  }

  public isSatInFov(sat: Sat, date: Date = this.time): boolean {
    return this.isRaeInFov(this.getRae(sat, date));
  }

  public calculatePasses(planningInterval: number, sat: Sat, date: Date = this.time) {
    let isInViewLast = false;
    let maxElThisPass = 0;
    const msnPlanPasses: Lookangles[] = [];
    const startTime = date.getTime();

    for (let timeOffset = 0; timeOffset < planningInterval; timeOffset++) {
      const curTime = new Date(startTime + timeOffset * 1000);
      const rae = this.getRae(sat, curTime);

      // Radians to Degrees
      rae.az *= 360 / TAU;
      rae.el *= 360 / TAU;

      const isInView = this.isRaeInFov(rae);

      if (timeOffset === 0) {
        // Propagate Backwards to get the previous pass
        const oldRae = this.getRae(sat, new Date(Date.now() - 1 * 1000));

        isInViewLast = this.isRaeInFov(oldRae);
      }

      const type = Sensor.getPassType(isInView, isInViewLast);

      maxElThisPass = Math.max(maxElThisPass, rae.el);

      if (type === PassType.ENTER || type === PassType.EXIT) {
        const pass = <Lookangles>{
          type,
          time: curTime,
          az: rae.az,
          el: rae.el,
          rng: rae.rng,
        };

        // Only set maxEl for EXIT passes
        if (type === PassType.EXIT) {
          pass.maxElPass = maxElThisPass;
        }

        msnPlanPasses.push(pass);
        maxElThisPass = 0;
      }

      isInViewLast = isInView;
    }

    return msnPlanPasses;
  }

  private static getPassType(isInView: boolean, isInViewLast: boolean) {
    let type = PassType.OUT_OF_VIEW;

    if (isInView && !isInViewLast) {
      type = PassType.ENTER;
    } else if (!isInView && isInViewLast) {
      type = PassType.EXIT;
    } else if (isInView && isInViewLast) {
      type = PassType.IN_VIEW;
    }

    return type;
  }
}
