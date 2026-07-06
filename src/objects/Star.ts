/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
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

import { Horizon, MakeTime, Observer } from 'astronomy-engine';
import { Degrees, GreenwichMeanSiderealTime, Kilometers, LlaVec3, Radians, RaeVec3, SpaceObjectType, TemeVec3 } from '../types/types';
import { MILLISECONDS_TO_DAYS, RAD2DEG } from '../utils/constants';
import { Sgp4 } from '../sgp4/sgp4';
import { StarObjectParams } from '../interfaces/StarObjectParams';
import { ecef2eci, jday, rae2ecef } from '../transforms/transforms';
import { BaseObject } from './BaseObject';

export class Star extends BaseObject {
  ra: Radians;
  dec: Radians;
  bf: string;
  h: string;
  pname: string;
  vmag?: number;
  constellation?: string;
  colorTemp?: number;
  hr?: number;
  flamsteed?: string;
  bayer?: string;

  constructor(info: StarObjectParams) {
    super(info);
    this.type = SpaceObjectType.STAR;

    this.ra = info.ra;
    this.dec = info.dec;

    this.pname = info.pname ?? '';
    this.bf = info.bf ?? '';
    this.h = info.h ?? '';
    this.vmag = info.vmag;
    this.constellation = info.constellation;
    this.colorTemp = info.colorTemp;
    this.hr = info.hr;
    this.flamsteed = info.flamsteed;
    this.bayer = info.bayer;
  }

  eci(lla: LlaVec3 = { lat: <Degrees>180, lon: <Degrees>0, alt: <Kilometers>0 }, date: Date = new Date()): TemeVec3 {
    const rae = this.rae(lla, date);
    const { gmst } = Star.calculateTimeVariables_(date);

    // Arbitrary distance to enable using ECI coordinates
    return ecef2eci(rae2ecef(rae, { lat: <Degrees>0, lon: <Degrees>0, alt: <Kilometers>0 }), gmst);
  }

  rae(
    lla: LlaVec3<Degrees, Kilometers> = { lat: <Degrees>180, lon: <Degrees>0, alt: <Kilometers>0 },
    date: Date = new Date(),
  ): RaeVec3 {
    // Convert RA from radians to sidereal hours (RA is in radians, need hours for astronomy-engine)
    const raHours = (this.ra * RAD2DEG) / 15; // degrees / 15 = hours
    const decDegrees = this.dec * RAD2DEG;

    const time = MakeTime(date);
    const observer = new Observer(lla.lat, lla.lon, lla.alt * 1000); // Convert km to meters
    const horizontal = Horizon(time, observer, raHours, decDegrees, 'normal');

    return { az: horizontal.azimuth as Degrees, el: horizontal.altitude as Degrees, rng: <Kilometers>250000 };
  }

  /**
   * Creates a deep copy of this star.
   */
  clone(): Star {
    return new Star({
      id: this.id,
      name: this.name,
      ra: this.ra,
      dec: this.dec,
      bf: this.bf,
      h: this.h,
      pname: this.pname,
      vmag: this.vmag,
      constellation: this.constellation,
      colorTemp: this.colorTemp,
      hr: this.hr,
      flamsteed: this.flamsteed,
      bayer: this.bayer,
      active: this.active,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }

  /**
   * Returns type-specific serialization data.
   */
  protected serializeSpecific(): Record<string, unknown> {
    return {
      ra: this.ra,
      dec: this.dec,
      bf: this.bf,
      h: this.h,
      pname: this.pname,
      vmag: this.vmag,
      constellation: this.constellation,
      colorTemp: this.colorTemp,
      hr: this.hr,
      flamsteed: this.flamsteed,
      bayer: this.bayer,
    };
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
