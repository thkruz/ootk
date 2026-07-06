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

import { DataHandler } from '../data/DataHandler';
import { ValidationError } from '../errors';
import { Seconds } from '../types/types';
import { secondsPerWeek } from '../utils/constants';
import { EpochUTC } from './EpochUTC';

/**
 * Represents an epoch in GPS Time format.
 *
 * GPS Time uses a week number and seconds-into-week format, referenced to
 * the GPS epoch of January 6, 1980, 00:00:00 UTC. Unlike UTC, GPS Time does
 * **not** include leap seconds, so it runs ahead of UTC by the accumulated
 * leap seconds since 1980 minus 19 seconds.
 *
 * ## GPS Time Structure
 * GPS time is expressed as two components:
 * - **Week number**: Weeks since January 6, 1980
 * - **Seconds of week**: Seconds elapsed in the current week (0 to 604799)
 *
 * ## Relationship to Other Time Scales
 * ```
 * GPS = UTC + leap_seconds - 19
 * GPS = TAI - 19
 * ```
 *
 * The 19-second offset exists because GPS Time was synchronized with UTC
 * when there were 19 leap seconds, and GPS Time has not added leap seconds
 * since then.
 *
 * ## Week Number Rollover
 * GPS receivers transmit week numbers with limited bits, causing rollover:
 * - **10-bit rollover**: Every 1024 weeks (~19.7 years)
 * - **13-bit rollover**: Every 8192 weeks (~157 years)
 *
 * Use `week10Bit` or `week13Bit` getters when interfacing with receivers
 * that use these formats.
 *
 * ## When to Use EpochGPS
 * - **GPS receiver data**: Parsing timestamps from GPS/GNSS receivers
 * - **Navigation messages**: Working with GPS broadcast ephemerides
 * - **GNSS applications**: Any Global Navigation Satellite System work
 * - **Precise timing**: GPS provides nanosecond-level timing
 *
 * ## When NOT to Use EpochGPS
 * - For general satellite tracking (use EpochUTC)
 * - For astronomical calculations (use EpochTT or EpochTDB)
 * - For user-facing timestamps (use EpochUTC)
 *
 * ## Creating and Converting Instances
 * ```typescript
 * // Convert from UTC to GPS
 * const utc = EpochUTC.now();
 * const gps = utc.toGPS();
 *
 * console.log(gps.week);      // Full week number
 * console.log(gps.seconds);   // Seconds into week
 * console.log(gps.week10Bit); // 10-bit week (for legacy receivers)
 *
 * // Convert back to UTC
 * const utcAgain = gps.toUTC();
 * ```
 *
 * @see EpochUTC - Primary time class, use toGPS() to convert
 */
export class EpochGPS {
  /**
   * Create a new GPS epoch given the [week] since reference epoch, and number
   * of [seconds] into the [week].
   * @param week Number of weeks since the GPS reference epoch.
   * @param seconds Number of seconds into the week.
   */
  constructor(public week: number, public seconds: number) {
    if (week < 0) {
      throw new ValidationError('GPS week must be non-negative', 'week', week);
    }
    if (seconds < 0 || seconds >= secondsPerWeek) {
      throw new ValidationError('GPS seconds must be between 0 and 604799', 'seconds', seconds);
    }
  }

  /** Cached GPS reference epoch (1980-01-06T00:00:00.000Z) */
  private static reference_: EpochUTC | null = null;

  /**
   * Gets the GPS reference epoch (1980-01-06T00:00:00.000Z).
   * Uses lazy initialization to avoid circular dependency issues.
   */
  static getReference(): EpochUTC {
    EpochGPS.reference_ ??= EpochUTC.fromDateTimeString('1980-01-06T00:00:00.000Z');

    return EpochGPS.reference_;
  }

  // / GPS leap second difference from TAI/UTC offsets.
  static readonly offset = 19 as Seconds;

  // / Get GPS week accounting for 10-bit rollover.
  get week10Bit(): number {
    return this.week % 2 ** 10;
  }

  // / Get GPS week accounting for 13-bit rollover.
  get week13Bit(): number {
    return this.week % 2 ** 13;
  }

  toString(): string {
    return `${this.week}:${this.seconds.toFixed(3)}`;
  }

  /** Convert this to a UTC epoch. */
  toUTC(): EpochUTC {
    const init = EpochGPS.getReference().roll((this.week * secondsPerWeek + this.seconds) as Seconds);
    const ls = DataHandler.getInstance().getLeapSeconds(init.toJulianDate());

    return init.roll(-(ls - EpochGPS.offset) as Seconds);
  }
}
