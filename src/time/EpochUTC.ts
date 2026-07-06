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

import { Seconds } from '../types/types';
import { DEG2RAD, MS_PER_DAY, RAD2DEG, secondsPerWeek, TAU } from '../utils/constants';
import { evalPoly } from '../utils/functions';
import { DataHandler } from './../data/DataHandler';
import { Epoch } from './Epoch';
import { EpochGPS } from './EpochGPS';
import { EpochTAI } from './EpochTAI';
import { EpochTDB } from './EpochTDB';
import { EpochTT } from './EpochTT';

/** Parameters for creating an EpochUTC from date components. */
type FromDateParams = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
};

/** Internal parameters for POSIX conversion. */
type DateToPosixParams = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * Represents an epoch in Coordinated Universal Time (UTC).
 *
 * EpochUTC is the **primary time class** for ootk and should be used as the
 * default choice for most operations. It represents civil time with leap
 * second corrections and serves as the entry point for conversions to other
 * astronomical time scales.
 *
 * ## When to Use EpochUTC
 * - Parsing and working with TLE (Two-Line Element) epochs
 * - User-facing timestamps and I/O operations
 * - General satellite tracking and pass predictions
 * - Any operation where civil time is the natural choice
 *
 * ## Creating Instances
 * ```typescript
 * // Current time
 * const now = EpochUTC.now();
 *
 * // From date components
 * const epoch = EpochUTC.fromDate({ year: 2024, month: 6, day: 15, hour: 12 });
 *
 * // From JavaScript Date
 * const epoch = EpochUTC.fromDateTime(new Date());
 *
 * // From ISO 8601 string
 * const epoch = EpochUTC.fromDateTimeString('2024-06-15T12:00:00Z');
 *
 * // From definitive orbit format ("DDD/YYYY HH:MM:SS.sss")
 * const epoch = EpochUTC.fromDefinitiveString('166/2024 12:00:00.000');
 * ```
 *
 * ## Converting to Other Time Scales
 * ```typescript
 * const utc = EpochUTC.now();
 *
 * const tai = utc.toTAI();   // International Atomic Time
 * const tt  = utc.toTT();    // Terrestrial Time
 * const tdb = utc.toTDB();   // Barycentric Dynamical Time
 * const gps = utc.toGPS();   // GPS Time (week/seconds)
 * ```
 *
 * ## Time Arithmetic
 * ```typescript
 * const epoch = EpochUTC.now();
 * const oneHourLater = epoch.roll(3600 as Seconds);
 * const difference = oneHourLater.difference(epoch); // 3600 seconds
 * ```
 *
 * ## Sidereal Time
 * EpochUTC provides Greenwich Mean Sidereal Time (GMST) calculations,
 * essential for converting between Earth-fixed and inertial reference frames:
 * ```typescript
 * const gmstRadians = epoch.gmstAngle();
 * const gmstDegrees = epoch.gmstAngleDegrees();
 * ```
 *
 * @see Epoch - Base class with common functionality
 * @see EpochTAI - For continuous timekeeping without leap seconds
 * @see EpochTT - For Earth-based astronomical observations
 * @see EpochTDB - For planetary ephemerides
 * @see EpochGPS - For GPS/GNSS applications
 */
export class EpochUTC extends Epoch {
  static now() {
    return new EpochUTC(Date.now() / 1000 as Seconds);
  }

  static fromDate({ year, month, day, hour = 0, minute = 0, second = 0 }: FromDateParams) {
    return new EpochUTC(EpochUTC.dateToPosix_({ year, month, day, hour, minute, second }));
  }

  static fromDateTime(dt: Date) {
    return new EpochUTC(dt.getTime() / 1000 as Seconds);
  }

  static fromDateTimeString(dateTimeString: string): EpochUTC {
    const dts = dateTimeString.trim().toUpperCase().endsWith('Z') ? dateTimeString : `${dateTimeString}Z`;

    return new EpochUTC(new Date(dts).getTime() / 1000 as Seconds);
  }

  static fromJ2000TTSeconds(seconds: Seconds): EpochUTC {
    const tInit = new EpochUTC(seconds + 946728000 as Seconds);
    const ls = DataHandler.getInstance().getLeapSeconds(tInit.toJulianDate());

    return tInit.roll(-32.184 - ls as Seconds);
  }

  static fromDefinitiveString(definitiveString: string): EpochUTC {
    const fields = definitiveString.trim().split(' ') as [string, string];
    const dateFields = fields[0].split('/') as [string, string];
    const day = parseInt(dateFields[0]);
    const year = parseInt(dateFields[1]);

    const timeField = fields[1];
    // Add day - 1 days in milliseconds to the epoch.
    const dts = new Date(`${year}-01-01T${timeField}Z`).getTime() + (day - 1) * MS_PER_DAY;

    return new EpochUTC(dts / 1000 as Seconds);
  }

  roll(seconds: Seconds): EpochUTC {
    return new EpochUTC(this.posix + seconds as Seconds);
  }

  toMjd(): number {
    return this.toJulianDate() - 2400000.5;
  }

  toMjdGsfc(): number {
    return this.toMjd() - 29999.5;
  }

  toTAI(): EpochTAI {
    const ls = DataHandler.getInstance().getLeapSeconds(this.toJulianDate());

    return new EpochTAI(this.posix + ls as Seconds);
  }

  toTT(): EpochTT {
    return new EpochTT(this.toTAI().posix + 32.184 as Seconds);
  }

  toTDB(): EpochTDB {
    const tt = this.toTT();
    const tTT = tt.toJulianCenturies();
    const mEarth = (357.5277233 + 35999.05034 * tTT) * DEG2RAD;
    const seconds = 0.001658 * Math.sin(mEarth) + 0.00001385 * Math.sin(2 * mEarth) as Seconds;

    return new EpochTDB(tt.posix + seconds as Seconds);
  }

  toGPS(): EpochGPS {
    const referenceTime = EpochGPS.getReference();
    const ls = DataHandler.getInstance().getLeapSeconds(this.toJulianDate());
    const delta = this.roll(ls - EpochGPS.offset as Seconds).difference(referenceTime);
    const week = delta / secondsPerWeek;
    const weekFloor = Math.floor(week);
    const seconds = (week - weekFloor) * secondsPerWeek;

    return new EpochGPS(weekFloor, seconds);
  }

  gmstAngle(): number {
    const t = this.toJulianCenturies();
    const seconds = evalPoly(t, EpochUTC.gmstPoly_);
    let result = ((seconds / 240) * DEG2RAD) % TAU;

    if (result < 0) {
      result += TAU;
    }

    return result;
  }

  gmstAngleDegrees(): number {
    return this.gmstAngle() * RAD2DEG;
  }

  private static readonly gmstPoly_: Float64Array = new Float64Array([
    -6.2e-6,
    0.093104,
    876600 * 3600 + 8640184.812866,
    67310.54841,
  ]);

  private static readonly dayOfYearLookup_: number[][] = [
    [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
    [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335],
  ] as const;

  private static isLeapYear_(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  private static dayOfYear_(year: number, month: number, day: number): number {
    const dex = EpochUTC.isLeapYear_(year) ? 1 : 0;
    const dayOfYearArray = EpochUTC.dayOfYearLookup_[dex];
    const daysBeforeCurrentMonth = dayOfYearArray[month - 1];

    return daysBeforeCurrentMonth + day - 1;
  }

  private static dateToPosix_({ year, month, day, hour, minute, second }: DateToPosixParams): Seconds {
    const days = EpochUTC.dayOfYear_(year, month, day);
    const yearMod = year - 1900;

    return (
      minute * 60 +
      hour * 3600 +
      days * 86400 +
      (yearMod - 70) * 31536000 +
      Math.floor((yearMod - 69) / 4) * 86400 -
      Math.floor((yearMod - 1) / 100) * 86400 +
      Math.floor((yearMod + 299) / 400) * 86400 +
      second
    ) as Seconds;
  }
}
