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
