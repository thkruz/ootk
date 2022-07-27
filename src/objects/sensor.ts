import { RaeVec3, SpaceObjectType } from '../types/types';

import { BaseObject } from './base-object';
import { Sat } from './sat';

interface ObjectInfo {
  name?: string;
  type?: SpaceObjectType;
  lat: number;
  lon: number;
  alt: number;
}

export class Sensor extends BaseObject {
  public lat: number;
  public lon: number;
  public alt: number;

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
}
