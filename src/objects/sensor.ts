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
