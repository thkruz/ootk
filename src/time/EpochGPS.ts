/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2025 Theodore Kruczek Permission is
 * hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Seconds } from '../main.js';
import { DataHandler } from '../data/DataHandler.js';
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
