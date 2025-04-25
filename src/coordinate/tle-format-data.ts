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
