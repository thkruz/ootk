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
];

// / Leap second data container.
class LeapSecondData {
  private _offsets: LeapSecond[];
  private _jdFirst: number;
  private _jdLast: number;
  private _offsetFirst: number;
  private _offsetLast: number;

  constructor(offsets: LeapSecond[]) {
    this._offsets = offsets;
    this._jdFirst = this._offsets[0].jd;
    this._jdLast = this._offsets[this._offsets.length - 1].jd;
    this._offsetFirst = this._offsets[0].offset;
    this._offsetLast = this._offsets[this._offsets.length - 1].offset;
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
    if (jd >= this._jdLast) {
      return this._offsetLast;
    }
    if (jd <= this._jdFirst) {
      return this._offsetFirst;
    }
    for (let i = 0; i < this._offsets.length - 2; i++) {
      if (jd >= this._offsets[i].jd && jd < this._offsets[i + 1].jd) {
        return this._offsets[i].offset;
      }
    }

    return 0;
  }
}

// / Leap second data container.
export const leapSecondData: LeapSecondData = LeapSecondData.fromVals(leapSeconds);
