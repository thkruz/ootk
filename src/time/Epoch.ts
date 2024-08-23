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

import { Seconds } from '../main.js';
import { secondsPerDay } from '../utils/constants.js';

// / Base class for [Epoch] data.
export class Epoch {
  /*
   * Create a new [Epoch] object given the number of seconds elapsed since the
   * [posix] epoch _(`1970-01-01T00:00:00.000`)_ in the [Epoch] time scale.
   */
  constructor(public posix: Seconds) {
    if (posix < 0) {
      throw new Error('Epoch cannot be negative');
    }
  }

  toString(): string {
    return this.toDateTime().toISOString();
  }

  // / Convert this to an Excel spreadsheet string.
  toExcelString(): string {
    return this.toString().substring(0, 19);
  }

  // / Return the difference _(s)_ between this and another [epoch]/
  difference(epoch: Epoch): Seconds {
    return this.posix - epoch.posix as Seconds;
  }

  // / Check if this has the same timestamp as the provided [epoch].
  equals(epoch: Epoch): boolean {
    return this.posix === epoch.posix;
  }

  // / Convert to a [DateTime] object.
  toDateTime(): Date {
    return new Date(this.posix * 1000);
  }

  toEpochYearAndDay(): { epochYr: string; epochDay: string } {
    const currentDateObj = this.toDateTime();
    const epochYear = currentDateObj.getUTCFullYear().toString().slice(2, 4);
    const epochDay = this.getDayOfYear_(currentDateObj);
    const timeOfDay = (currentDateObj.getUTCHours() * 60 + currentDateObj.getUTCMinutes()) / 1440;
    const epochDayStr = (epochDay + timeOfDay).toFixed(8).padStart(12, '0');

    return {
      epochYr: epochYear,
      epochDay: epochDayStr,
    };
  }

  private getDayOfYear_(date: Date): number {
    const dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const mn = date.getUTCMonth();
    const dn = date.getUTCDate();
    let dayOfYear = dayCount[mn] + dn;

    if (mn > 1 && this.isLeapYear_(date)) {
      dayOfYear++;
    }

    return dayOfYear;
  }

  private isLeapYear_(dateIn: Date) {
    const year = dateIn.getUTCFullYear();

    if ((year & 3) !== 0) {
      return false;
    }

    return year % 100 !== 0 || year % 400 === 0;
  }

  // / Convert to Julian date.
  toJulianDate(): number {
    return this.posix / secondsPerDay + 2440587.5;
  }

  // / Convert to Julian centuries.
  toJulianCenturies(): number {
    return (this.toJulianDate() - 2451545) / 36525;
  }

  // / Check if this is later than the [other] epoch.
  operatorGreaterThan(other: Epoch): boolean {
    return this.posix > other.posix;
  }

  // / Check if this is later or the same as the [other] epoch.
  operatorGreaterThanOrEqual(other: Epoch): boolean {
    return this.posix >= other.posix;
  }

  // / Check if this is earlier than the [other] epoch.
  operatorLessThan(other: Epoch): boolean {
    return this.posix < other.posix;
  }

  // / Check if this is earlier or the same as the [other] epoch.
  operatorLessThanOrEqual(other: Epoch): boolean {
    return this.posix <= other.posix;
  }
}
