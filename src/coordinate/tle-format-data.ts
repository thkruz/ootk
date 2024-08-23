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

/**
 * Represents the format data of a TLE (Two-Line Element) set. This is used to
 * make it easier to remember the starting and ending positions of the columns
 * containing the TLE data.
 */
export class TleFormatData {
  /** The starting position of the TLE data in the source string. */
  start: number;
  /** The ending position of the TLE data in the source string. */
  stop: number;
  /** The length of the TLE data in the source string. */
  length: number;

  /**
   * Creates a new instance of TleFormatData.
   * @param start The starting position of the TLE data in the source string.
   * @param end The ending position of the TLE data in the source string.
   */
  constructor(start: number, end: number) {
    this.start = start - 1;
    this.stop = end;
    this.length = this.stop - this.start;
  }
}
