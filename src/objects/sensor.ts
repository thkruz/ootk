/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The Sensor class is used for creating ground based observers.
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

import { Degrees, Kilometers, RaeVec3, SpaceObjectType } from '../types/types';

import { BaseObject } from './base-object';
import { Satellite } from './Satellite';

interface SensorParams {
  alt: Kilometers;
  lat: Degrees;
  lon: Degrees;
  maxAz?: Degrees;
  maxEl?: Degrees;
  maxRng?: Kilometers;
  minAz?: Degrees;
  minEl?: Degrees;
  minRng?: Kilometers;
  name?: string;
  type?: SpaceObjectType;
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
  az: Degrees;
  el: Degrees;
  rng: Kilometers;
  maxElPass?: Degrees;
};

export class Sensor extends BaseObject {
  alt: Kilometers;
  lat: Degrees;
  lon: Degrees;
  maxAz: Degrees;
  maxEl: Degrees;
  maxRng: Kilometers;
  minAz: Degrees;
  minEl: Degrees;
  minRng: Kilometers;

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
   * @param {SensorParams} info SensorParams object containing the object's information
   */
  constructor(info: SensorParams) {
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

  calculatePasses(planningInterval: number, sat: Satellite, date: Date = this.time) {
    let isInViewLast = false;
    let maxElThisPass = <Degrees>0;
    const msnPlanPasses: Lookangles[] = [];
    const startTime = date.getTime();

    for (let timeOffset = 0; timeOffset < planningInterval; timeOffset++) {
      const curTime = new Date(startTime + timeOffset * 1000);
      const rae = this.getRae(sat, curTime);

      const isInView = this.isRaeInFov(rae);

      if (timeOffset === 0) {
        // Propagate Backwards to get the previous pass
        const oldRae = this.getRae(sat, new Date(Date.now() - 1 * 1000));

        isInViewLast = this.isRaeInFov(oldRae);
      }

      const type = Sensor.getPassType_(isInView, isInViewLast);

      maxElThisPass = <Degrees>Math.max(maxElThisPass, rae.el);

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
        maxElThisPass = <Degrees>0;
      }

      isInViewLast = isInView;
    }

    return msnPlanPasses;
  }

  getRae(sat: Satellite, date: Date = this.time): RaeVec3<Kilometers, Degrees> {
    return sat.raeOpt(this, date);
  }

  isRaeInFov(rae: RaeVec3<Kilometers, Degrees>): boolean {
    if (rae.el < this.minEl || rae.el > this.maxEl) {
      return false;
    }

    if (rae.rng < this.minRng || rae.rng > this.maxRng) {
      return false;
    }

    if (this.minAz > this.maxAz) {
      // North Facing Sensors
      if (rae.az < this.minAz && rae.az > this.maxAz) {
        return false;
      }
      // Normal Facing Sensors
    } else if (rae.az < this.minAz || rae.az > this.maxAz) {
      return false;
    }

    return true;
  }

  isSatInFov(sat: Satellite, date: Date = this.time): boolean {
    return this.isRaeInFov(this.getRae(sat, date));
  }

  setTime(date: Date): this {
    this.time = date;

    return this;
  }

  private static getPassType_(isInView: boolean, isInViewLast: boolean) {
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

  private validateFov(info: SensorParams) {
    this.validateMinAz(info);
    this.validateMaxAz(info);
    this.validateMinEl(info);
    this.validateMaxEl(info);
    this.validateMinRng(info);
    this.validateMaxRng(info);
  }

  private validateInputData(info: SensorParams) {
    this.validateLla(info);
    this.validateFov(info);
  }

  private validateLla(info: SensorParams) {
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

  private validateMaxAz(info: SensorParams) {
    if (info.maxAz >= 0 && info.maxAz <= 360) {
      this.maxAz = info.maxAz;
    } else if (typeof info.maxAz === 'undefined') {
      // Default is a telescope
      this.maxAz = <Degrees>360;
    } else {
      throw new Error('Invalid maximum azimuth - must be between 0 and 360');
    }
  }

  private validateMaxEl(info: SensorParams) {
    if (info.maxEl >= 0 && info.maxEl <= 180) {
      this.maxEl = info.maxEl;
    } else if (typeof info.maxEl === 'undefined') {
      // Default is a telescope
      this.maxEl = <Degrees>90;
    } else {
      throw new Error('Invalid maximum elevation - must be between 0 and 180');
    }
  }

  private validateMaxRng(info: SensorParams) {
    if (info.maxRng >= 0) {
      this.maxRng = info.maxRng;
    } else if (typeof info.maxRng === 'undefined') {
      // Default is a telescope
      this.maxRng = <Kilometers>50000; // arbitrary large number
    } else {
      throw new Error('Invalid maximum range - must be greater than 0');
    }
  }

  private validateMinAz(info: SensorParams) {
    if (info.minAz >= 0 && info.minAz <= 360) {
      this.minAz = info.minAz;
    } else if (typeof info.minAz === 'undefined') {
      // Default is a telescope
      this.minAz = <Degrees>0;
    } else {
      throw new Error('Invalid minimum azimuth - must be between 0 and 360');
    }
  }

  private validateMinEl(info: SensorParams) {
    if (info.minEl >= 0 && info.minEl <= 90) {
      this.minEl = info.minEl;
    } else if (typeof info.minEl === 'undefined') {
      // Default is a telescope
      this.minEl = <Degrees>0;
    } else {
      throw new Error('Invalid minimum elevation - must be between 0 and 90');
    }
  }

  private validateMinRng(info: SensorParams) {
    if (info.minRng >= 0) {
      this.minRng = info.minRng;
    } else if (typeof info.minRng === 'undefined') {
      // Default is a telescope
      this.minRng = <Kilometers>0;
    } else {
      throw new Error('Invalid minimum range - must be greater than 0');
    }
  }
}
