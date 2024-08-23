/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2024 Theodore Kruczek Permission is
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

import { PassType } from '../enums/PassType.js';
import { SensorParams } from '../interfaces/SensorParams.js';
import { Degrees, Kilometers, KilometersPerSecond, Lookangle, RaeVec3, SpaceObjectType } from '../types/types.js';
import { GroundObject } from './GroundObject.js';
import { Satellite } from './Satellite.js';
import { calcGmst, lla2eci, J2000, Vector3D, EpochUTC } from '../main.js';

export class Sensor extends GroundObject {
  minRng: Kilometers;
  minAz: Degrees;
  minEl: Degrees;
  maxRng: Kilometers;
  maxAz: Degrees;
  maxEl: Degrees;
  minRng2?: Kilometers;
  minAz2?: Degrees;
  minEl2?: Degrees;
  maxRng2?: Kilometers;
  maxAz2?: Degrees;
  maxEl2?: Degrees;

  constructor(info: SensorParams) {
    // If there is a sensor type verify it is valid
    if (info.type) {
      switch (info.type) {
        case SpaceObjectType.OPTICAL:
        case SpaceObjectType.MECHANICAL:
        case SpaceObjectType.PHASED_ARRAY_RADAR:
        case SpaceObjectType.OBSERVER:
        case SpaceObjectType.BISTATIC_RADIO_TELESCOPE:
        case SpaceObjectType.SHORT_TERM_FENCE:
          break;
        default:
          throw new Error('Invalid sensor type');
      }
    }

    super(info);

    this.validateSensorInputData_(info);

    this.minRng = info.minRng;
    this.minAz = info.minAz;
    this.minEl = info.minEl;
    this.maxRng = info.maxRng;
    this.maxAz = info.maxAz;
    this.maxEl = info.maxEl;
    this.minRng2 = info.minRng2;
    this.minAz2 = info.minAz2;
    this.minEl2 = info.minEl2;
    this.maxRng2 = info.maxRng2;
    this.maxAz2 = info.maxAz2;
    this.maxEl2 = info.maxEl2;
  }

  /**
   * Checks if the object is a sensor.
   * @returns True if the object is a sensor, false otherwise.
   */
  isSensor(): boolean {
    return true;
  }

  calculatePasses(planningInterval: number, sat: Satellite, date: Date = new Date()) {
    let isInViewLast = false;
    let maxElThisPass = <Degrees>0;
    const msnPlanPasses: Lookangle[] = [];
    const startTime = date.getTime();

    for (let timeOffset = 0; timeOffset < planningInterval; timeOffset++) {
      const curTime = new Date(startTime + timeOffset * 1000);
      const rae = this.rae(sat, curTime);

      const isInView = this.isRaeInFov(rae);

      if (timeOffset === 0) {
        // Propagate Backwards to get the previous pass
        const oldRae = this.rae(sat, new Date(date.getTime() - 1 * 1000));

        isInViewLast = this.isRaeInFov(oldRae);
      }

      const type = Sensor.getPassType_(isInView, isInViewLast);

      maxElThisPass = <Degrees>Math.max(maxElThisPass, rae.el);

      if (type === PassType.ENTER || type === PassType.EXIT) {
        const pass = <Lookangle>{
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

  /**
   * Checks if the given RAE vector is within the field of view of the sensor.
   * TODO: #8 This doesn't account for secondary sensor FOV
   * @param rae - The RAE vector to check.
   * @returns True if the RAE vector is within the field of view, false otherwise.
   */
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

  /**
   * Checks if a satellite is in the field of view (FOV) of the sensor.
   * @param sat - The satellite to check.
   * @param date - The date to use for the calculation. Defaults to the current date.
   * @returns A boolean indicating whether the satellite is in the FOV.
   */
  isSatInFov(sat: Satellite, date: Date = new Date()): boolean {
    return this.isRaeInFov(this.rae(sat, date));
  }

  /**
   * Checks if the sensor is in deep space.
   * @returns True if the sensor is in deep space, false otherwise.
   */
  isDeepSpace(): boolean {
    return this.maxRng > 6000;
  }

  /**
   * Checks if the sensor is near Earth.
   * @returns True if the sensor is near Earth, false otherwise.
   */
  isNearEarth(): boolean {
    return this.maxRng <= 6000;
  }

  toJ2000(date: Date = new Date()): J2000 {
    const gmst = calcGmst(date).gmst;
    const position = lla2eci(this.llaRad(), gmst);

    return new J2000(
      EpochUTC.fromDateTime(date),
      new Vector3D(position.x, position.y, position.z),
      new Vector3D(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
    );
  }

  /**
   * Returns the pass type based on the current and previous visibility states.
   * @param isInView - Indicates if the object is currently in view.
   * @param isInViewLast - Indicates if the object was in view in the previous state.
   * @returns The pass type.
   */
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

  /**
   * Validates the field of view (FOV) parameters of the sensor.
   * @param info - The sensor parameters.
   */
  private validateFov_(info: SensorParams) {
    this.validateParameter(info.maxAz, 0, 360, 'Invalid maximum azimuth - must be between 0 and 360');
    this.validateParameter(info.minAz, 0, 360, 'Invalid maximum azimuth - must be between 0 and 360');
    this.validateParameter(info.maxEl, -15, 180, 'Invalid maximum elevation - must be between 0 and 180');
    this.validateParameter(info.minEl, -15, 90, 'Invalid minimum elevation - must be between 0 and 90');
    this.validateParameter(info.maxRng, 0, null, 'Invalid maximum range - must be greater than 0');
    this.validateParameter(info.minRng, 0, null, 'Invalid minimum range - must be greater than 0');
  }

  /**
   * Validates the field of view parameters for the sensor.
   * @param info - The sensor parameters.
   */
  private validateFov2_(info: SensorParams) {
    this.validateParameter(info.maxAz2, 0, 360, 'Invalid maximum azimuth2 - must be between 0 and 360');
    this.validateParameter(info.minAz2, 0, 360, 'Invalid maximum azimuth2 - must be between 0 and 360');
    this.validateParameter(info.maxEl2, -15, 180, 'Invalid maximum elevation2 - must be between 0 and 180');
    this.validateParameter(info.minEl2, -15, 90, 'Invalid minimum elevation2 - must be between 0 and 90');
    this.validateParameter(info.maxRng2, 0, null, 'Invalid maximum range2 - must be greater than 0');
    this.validateParameter(info.minRng2, 0, null, 'Invalid minimum range2 - must be greater than 0');
  }

  /**
   * Validates the input data for the sensor.
   * @param info - The sensor parameters.
   */
  private validateSensorInputData_(info: SensorParams) {
    this.validateLla_(info);
    this.validateFov_(info);
    if (info.minAz2 || info.maxAz2 || info.minEl2 || info.maxEl2 || info.minRng2 || info.maxRng2) {
      this.validateFov2_(info);
    }
  }

  /**
   * Validates the latitude, longitude, and altitude of a sensor.
   * @param info - The sensor parameters containing the latitude, longitude, and altitude.
   */
  private validateLla_(info: SensorParams) {
    this.validateParameter(info.lat, -90, 90, 'Invalid latitude - must be between -90 and 90');
    this.validateParameter(info.lon, -180, 180, 'Invalid longitude - must be between -180 and 180');
    this.validateParameter(info.alt, 0, null, 'Invalid altitude - must be greater than 0');
  }
}
