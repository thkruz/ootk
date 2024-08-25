/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
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
  KilometersPerSecond,
  LlaVec3,
  MILLISECONDS_TO_DAYS,
  PosVel,
  Radians,
  rae2ecf,
  RaeVec3,
  Sgp4,
  SpaceObjectType,
  StarObjectParams,
} from '../main.js';
import { BaseObjectAdv } from './base/BaseObject.js';

export class Star extends BaseObjectAdv {
  static readonly earthCenterLla = {
    lat: 0 as Degrees,
    lon: 0 as Degrees,
    alt: 0 as Kilometers,
  } as unknown as BaseObjectAdv;
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

  eci(date: Date = new Date()): PosVel<Kilometers, KilometersPerSecond> {
    const rae = this.rae(Star.earthCenterLla, date);
    const { gmst } = Star.calculateTimeVariables_(date);

    // Arbitrary distance to enable using ECI coordinates
    const pos = ecf2eci(rae2ecf(rae, { lat: <Degrees>0, lon: <Degrees>0, alt: <Kilometers>0 }), gmst);

    return {
      position: pos,
      velocity: { x: 0 as KilometersPerSecond, y: 0 as KilometersPerSecond, z: 0 as KilometersPerSecond },
    };
  }

  ecf(date: Date = new Date()): EciVec3 {
    return ecf2eci(rae2ecf(this.rae(Star.earthCenterLla, date), Star.earthCenterLla.lla(date)), 0);
  }

  /**
   * @deprecated Lla is not currently supported for stars
   * @param date The date to calculate the LLA at
   * @returns The LLA of the star
   */
  lla(date: Date = new Date()): LlaVec3 {
    return Star.earthCenterLla.lla(date);
  }

  llaRad(date?: Date): LlaVec3<Radians, Kilometers> {
    return this.lla(date) as unknown as LlaVec3<Radians, Kilometers>;
  }

  rae(baseObject: BaseObjectAdv, date: Date = new Date()): RaeVec3 {
    const raeFrom = this.raeFrom(baseObject, date);

    // Retrun the inverse azimuth and elevation to get the direction from the star to the object
    let iAz = raeFrom.az + 180 as Degrees;
    let iEl = raeFrom.el + 180 as Degrees;

    if (iAz >= 360) {
      iAz = iAz - 360 as Degrees;
    }

    if (iEl >= 360) {
      iEl = iEl - 360 as Degrees;
    }

    return {
      az: iAz,
      el: iEl,
      rng: <Kilometers>250000,
    };
  }

  raeFrom(
    originObject: BaseObjectAdv,
    date: Date = new Date(),
  ): RaeVec3 {
    const lla = originObject.lla();
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
