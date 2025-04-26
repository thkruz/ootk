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

import { LeapSecond } from './LeapSecond.js';
// / Leap second value tuples.
const leapSeconds: Array<[number, number]> = [
  [2441317.5, 10],
  [2441499.5, 11],
  [2441683.5, 12],
  [2442048.5, 13],
  [2442413.5, 14],
  [2442778.5, 15],
  [2443144.5, 16],
  [2443509.5, 17],
  [2443874.5, 18],
  [2444239.5, 19],
  [2444786.5, 20],
  [2445151.5, 21],
  [2445516.5, 22],
  [2446247.5, 23],
  [2447161.5, 24],
  [2447892.5, 25],
  [2448257.5, 26],
  [2448804.5, 27],
  [2449169.5, 28],
  [2449534.5, 29],
  [2450083.5, 30],
  [2450630.5, 31],
  [2451179.5, 32],
  [2453736.5, 33],
  [2454832.5, 34],
  [2456109.5, 35],
  [2457204.5, 36],
  [2457754.5, 37],
] as const;

// / Leap second data container.
class LeapSecondData {
  private readonly offsets_: LeapSecond[];
  private readonly jdFirst_: number;
  private readonly jdLast_: number;
  private readonly offsetFirst_: number;
  private readonly offsetLast_: number;

  constructor(offsets: LeapSecond[]) {
    this.offsets_ = offsets;
    this.jdFirst_ = (this.offsets_[0] as LeapSecond).jd;
    this.jdLast_ = (this.offsets_[this.offsets_.length - 1] as LeapSecond).jd;
    this.offsetFirst_ = (this.offsets_[0] as LeapSecond).offset;
    this.offsetLast_ = (this.offsets_[this.offsets_.length - 1] as LeapSecond).offset;
  }

  /**
   * Create a new [LeapSecondData] container given a list of leap second
   * value tuples [vals].
   * @param vals Leap second value tuples.
   * @returns A new [LeapSecondData] container.
   */
  static fromVals(vals: [number, number][]): LeapSecondData {
    const output: LeapSecond[] = [];

    for (const v of vals) {
      const [jd, offset] = v;

      output.push(new LeapSecond(jd, offset));
    }

    return new LeapSecondData(output);
  }

  // / Return the number of leap seconds for a given Julian date [jd].
  getLeapSeconds(jd: number): number {
    if (jd >= this.jdLast_) {
      return this.offsetLast_;
    }
    if (jd <= this.jdFirst_) {
      return this.offsetFirst_;
    }
    for (let i = 0; i < this.offsets_.length - 2; i++) {
      const currentLeapSecond = this.offsets_[i] as LeapSecond;
      const nextLeapSecond = this.offsets_[i + 1] as LeapSecond;

      if (jd >= currentLeapSecond.jd && jd < nextLeapSecond.jd) {
        return currentLeapSecond.offset;
      }
    }

    return 0;
  }
}

// / Leap second data container.
export const leapSecondData: LeapSecondData = LeapSecondData.fromVals(leapSeconds);
