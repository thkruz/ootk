/**
 * @author @thkruz Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
 *
 * Many of the classes are based off of the work of @david-rc-dayton and his
 * Pious Squid library (https://github.com/david-rc-dayton/pious_squid) which
 * is licensed under the MIT license.
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
  Celestial,
  Degrees,
  ecf2eci,
  EciVec3,
  GreenwichMeanSiderealTime,
  jday,
  Kilometers,
  LlaVec3,
  MILLISECONDS_TO_DAYS,
  Radians,
  rae2ecf,
  RaeVec3,
  Sgp4,
  SpaceObjectType,
  StarObjectParams,
} from '../main.js';
import { BaseObject } from './BaseObject.js';

export class Star extends BaseObject {
  ra: Radians;
  dec: Radians;
  bf: string;
  h: string;
  pname: string;
  vmag?: number;

  constructor(info: StarObjectParams) {
    super(info);
    this.type = SpaceObjectType.STAR;

    this.ra = info.ra;
    this.dec = info.dec;

    this.pname = info.pname ?? '';
    this.bf = info.bf ?? '';
    this.h = info.h ?? '';
    this.vmag = info.vmag;
  }

  eci(lla: LlaVec3 = { lat: <Degrees>180, lon: <Degrees>0, alt: <Kilometers>0 }, date: Date = new Date()): EciVec3 {
    const rae = this.rae(lla, date);
    const { gmst } = Star.calculateTimeVariables_(date);

    // Arbitrary distance to enable using ECI coordinates
    return ecf2eci(rae2ecf(rae, { lat: <Degrees>0, lon: <Degrees>0, alt: <Kilometers>0 }), gmst);
  }

  rae(
    lla: LlaVec3<Degrees, Kilometers> = { lat: <Degrees>180, lon: <Degrees>0, alt: <Kilometers>0 },
    date: Date = new Date(),
  ): RaeVec3 {
    const starPos = Celestial.azEl(date, lla.lat, lla.lon, this.ra, this.dec);

    return { az: starPos.az, el: starPos.el, rng: <Kilometers>250000 };
  }

  private static calculateTimeVariables_(date: Date): { gmst: GreenwichMeanSiderealTime; j: number } {
    const j =
      jday(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      ) +
      date.getUTCMilliseconds() * MILLISECONDS_TO_DAYS;
    const gmst = Sgp4.gstime(j);

    return { gmst, j };
  }
}
