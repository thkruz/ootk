/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The Utils module.
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

import * as Types from '../types/types';
import { EciVec3, Kilometers } from '../types/types';
import { DAY_TO_MS } from './constants';
import { MoonMath } from './moon-math';
import { SunMath } from './sun-math';

class Utils {
  public static Types = Types;

  public static distance(pos1: EciVec3, pos2: EciVec3): Kilometers {
    return <Kilometers>Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2 + (pos1.z - pos2.z) ** 2);
  }

  private static sign = (value: number) => (value >= 0 ? 1 : -1);

  public static dopplerFactor(location: EciVec3, position: EciVec3, velocity: EciVec3): Kilometers {
    const mfactor = 7.292115e-5;
    const c = 299792.458; // Speed of light in km/s

    const range = <EciVec3>{
      x: position.x - location.x,
      y: position.y - location.y,
      z: position.z - location.z,
    };
    const distance = Math.sqrt(range.x ** 2 + range.y ** 2 + range.z ** 2);

    const rangeVel = <EciVec3>{
      x: velocity.x + mfactor * location.y,
      y: velocity.y - mfactor * location.x,
      z: velocity.z,
    };

    const rangeRate = (range.x * rangeVel.x + range.y * rangeVel.y + range.z * rangeVel.z) / distance;

    return <Kilometers>(1 + (rangeRate / c) * Utils.sign(rangeRate));
  }

  public static createVec(start: number, stop: number, step: number): number[] {
    const array = [];

    for (let i = start; i <= stop; i += step) {
      array.push(i);
    }

    return array;
  }

  // eslint-disable-next-line max-params
  public static jday = (year?: number, mon?: number, day?: number, hr?: number, minute?: number, sec?: number) => {
    if (!year) {
      const now = new Date();
      const jDayStart = new Date(now.getUTCFullYear(), 0, 0);
      const jDayDiff = now.getDate() - jDayStart.getDate();

      return Math.floor(jDayDiff / DAY_TO_MS);
    }

    return (
      367.0 * year -
      Math.floor(7 * (year + Math.floor((mon + 9) / 12.0)) * 0.25) +
      Math.floor((275 * mon) / 9.0) +
      day +
      1721013.5 +
      ((sec / 60.0 + minute) / 60.0 + hr) / 24.0
    );
  };

  public static getDayOfYear(date: Date): number {
    date = date || new Date();

    const dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const mn = date.getMonth();
    const dn = date.getUTCDate();
    let dayOfYear = dayCount[mn] + dn;

    if (mn > 1 && Utils.isLeapYear(date)) {
      dayOfYear++;
    }

    return dayOfYear;
  }

  private static isLeapYear(dateIn: Date) {
    const year = dateIn.getUTCFullYear();

    // eslint-disable-next-line no-bitwise
    if ((year & 3) !== 0) {
      return false;
    }

    return year % 100 !== 0 || year % 400 === 0;
  }

  public static roundToNDecimalPlaces(value: number, places: number): number {
    return Math.round(value * 10 ** places) / 10 ** places;
  }

  public static SunMath = SunMath;
  public static MoonMath = MoonMath;
}

export { Utils };
