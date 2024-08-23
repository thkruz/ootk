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

import { DataHandler } from '../data/DataHandler.js';
import { Seconds } from '../main.js';
import { secondsPerWeek } from '../utils/constants.js';
import type { EpochUTC } from './EpochUTC.js';
// / Global Positioning System _(GPS)_ formatted epoch.
export class EpochGPS {
  /**
   * Create a new GPS epoch given the [week] since reference epoch, and number
   * of [seconds] into the [week].
   * @param week Number of weeks since the GPS reference epoch.
   * @param seconds Number of seconds into the week.
   * @param reference Reference should always be EpochUTC.fromDateTimeString('1980-01-06T00:00:00.000Z').
   */
  constructor(public week: number, public seconds: number, reference: EpochUTC) {
    if (week < 0) {
      throw new Error('GPS week must be non-negative.');
    }
    if (seconds < 0 || seconds >= secondsPerWeek) {
      throw new Error('GPS seconds must be within a week.');
    }

    // TODO: #9 Set EpochGPS.reference statically without circular dependency.
    EpochGPS.reference = reference;
  }

  // / Number of weeks since the GPS reference epoch.
  static reference: EpochUTC;

  // / GPS leap second difference from TAI/UTC offsets.
  static offset = 19 as Seconds;

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

  // / Convert this to a UTC epoch.
  toUTC(): EpochUTC {
    const init = EpochGPS.reference.roll((this.week * secondsPerWeek + this.seconds) as Seconds);
    const ls = DataHandler.getInstance().getLeapSeconds(init.toJulianDate());

    return init.roll(-(ls - EpochGPS.offset) as Seconds);
  }
}
