import {
  Degrees,
  Kilometers,
  LlaVec3,
  Lookangle,
  PassType,
  Radians,
  RaeVec3,
  SensorParams,
  SpaceObjectType,
} from '../types/types';
import { DEG2RAD } from '../utils/constants';

import { BaseObject } from './BaseObject';
import { Satellite } from './Satellite';

export class Sensor extends BaseObject {
  name: string;
  type: SpaceObjectType;
  lat: Degrees;
  lon: Degrees;
  alt: Kilometers;
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
        case SpaceObjectType.SHORT_TERM_FENCE:
          break;
        default:
          throw new Error('Invalid sensor type');
      }
    }

    super(info);

    this.validateInputData(info);
    Object.keys(info).forEach((key) => {
      this[key] = info[key];
    });
  }

  isSensor(): boolean {
    return true;
  }

  calculatePasses(planningInterval: number, sat: Satellite, date: Date = this.time) {
    let isInViewLast = false;
    let maxElThisPass = <Degrees>0;
    const msnPlanPasses: Lookangle[] = [];
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

  getLlaRad(): LlaVec3<Radians, Kilometers> {
    return {
      lat: (this.lat * DEG2RAD) as Radians,
      lon: (this.lon * DEG2RAD) as Radians,
      alt: this.alt,
    };
  }

  isDeepSpace(): boolean {
    return this.maxRng > 6000;
  }

  isNearEarth(): boolean {
    return this.maxRng <= 6000;
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
    this.validateParameter(info.maxAz, 0, 360, 'Invalid maximum azimuth - must be between 0 and 360');
    this.validateParameter(info.minAz, 0, 360, 'Invalid maximum azimuth - must be between 0 and 360');
    this.validateParameter(info.maxEl, -15, 180, 'Invalid maximum elevation - must be between 0 and 180');
    this.validateParameter(info.minEl, -15, 90, 'Invalid minimum elevation - must be between 0 and 90');
    this.validateParameter(info.maxRng, 0, null, 'Invalid maximum range - must be greater than 0');
    this.validateParameter(info.minRng, 0, null, 'Invalid minimum range - must be greater than 0');
  }

  private validateFov2(info: SensorParams) {
    this.validateParameter(info.maxAz2, 0, 360, 'Invalid maximum azimuth2 - must be between 0 and 360');
    this.validateParameter(info.minAz2, 0, 360, 'Invalid maximum azimuth2 - must be between 0 and 360');
    this.validateParameter(info.maxEl2, -15, 180, 'Invalid maximum elevation2 - must be between 0 and 180');
    this.validateParameter(info.minEl2, -15, 90, 'Invalid minimum elevation2 - must be between 0 and 90');
    this.validateParameter(info.maxRng2, 0, null, 'Invalid maximum range2 - must be greater than 0');
    this.validateParameter(info.minRng2, 0, null, 'Invalid minimum range2 - must be greater than 0');
  }

  private validateInputData(info: SensorParams) {
    this.validateLla(info);
    this.validateFov(info);
    if (info.minAz2 || info.maxAz2 || info.minEl2 || info.maxEl2 || info.minRng2 || info.maxRng2) {
      this.validateFov2(info);
    }
  }

  private validateLla(info: SensorParams) {
    this.validateParameter(info.lat, -90, 90, 'Invalid latitude - must be between -90 and 90');
    this.validateParameter(info.lon, -180, 180, 'Invalid longitude - must be between -180 and 180');
    this.validateParameter(info.alt, 0, null, 'Invalid altitude - must be greater than 0');
  }

  private validateParameter<T>(value: T, minValue: T, maxValue: T, errorMessage: string): void {
    if (minValue !== null && value < minValue) {
      throw new Error(errorMessage);
    }
    if (maxValue !== null && value > maxValue) {
      throw new Error(errorMessage);
    }
  }
}
