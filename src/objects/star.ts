/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The Star class is meant to help with cacluating star positions relative to
 * satellites and earth based sensors.
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2023 Theodore Kruczek
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

import {
  Degrees,
  EciVec3,
  GreenwichMeanSiderealTime,
  Kilometers,
  LlaVec3,
  Radians,
  RaeVec3,
  SpaceObjectType,
} from '../types/types';
import { DAY_TO_MS } from '../utils/constants';

import { Celestial } from '@src/body/Celestial';
import { Utils } from '@src/ootk';
import { ecf2eci, rae2ecf } from '@src/transforms/transforms';
import { Sgp4 } from '../sgp4/sgp4';
import { SpaceObject } from './space-object';
interface ObjectInfo {
  bf?: string;
  dec: Radians;
  h?: string;
  name?: string;
  pname?: string;
  ra: Radians;
  type?: SpaceObjectType;
  vmag?: number;
}

export class Star extends SpaceObject {
  bf: string;
  dec: Radians;
  h: string;
  pname: string;
  ra: Radians;

  constructor(info: ObjectInfo) {
    if (info.type && info.type !== SpaceObjectType.STAR) {
      throw new Error('Invalid object type');
    } else {
      info.type = SpaceObjectType.STAR;
    }

    super(info);

    this.ra = info.ra;
    this.dec = info.dec;

    if (info.pname) {
      this.pname = info.pname;
    }

    if (info.bf) {
      this.bf = info.bf;
    }

    if (info.h) {
      this.h = info.h;
    }
  }

  getEci(lla: LlaVec3 = { lat: <Degrees>180, lon: <Degrees>0, alt: <Kilometers>0 }, date: Date = this.time): EciVec3 {
    const rae = this.getRae(lla, date);
    const { gmst } = Star.calculateTimeVariables_(date);

    // Arbitrary distance to enable using ECI coordinates
    return ecf2eci(rae2ecf(rae, { lat: <Degrees>0, lon: <Degrees>0, alt: <Kilometers>0 }), gmst);
  }

  getRae(
    lla: LlaVec3<Degrees, Kilometers> = { lat: <Degrees>180, lon: <Degrees>0, alt: <Kilometers>0 },
    date: Date = this.time,
  ): RaeVec3 {
    const starPos = Celestial.getStarAzEl(date, lla.lat, lla.lon, this.ra, this.dec);

    return { az: starPos.az, el: starPos.el, rng: <Kilometers>250000 };
  }

  private static calculateTimeVariables_(date: Date): { gmst: GreenwichMeanSiderealTime; j: number } {
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

    return { gmst, j };
  }
}
