import { secondsPerDay } from '../operations/constants';
import { Comparable } from './Comparable';

// / Base class for [Epoch] data.
export class Epoch implements Comparable {
  /*
   * Create a new [Epoch] object given the number of seconds elapsed since the
   * [posix] epoch _(`1970-01-01T00:00:00.000`)_ in the [Epoch] time scale.
   */
  constructor(public posix: number) {
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
  difference(epoch: Epoch): number {
    return this.posix - epoch.posix;
  }

  // / Check if this has the same timestamp as the provided [epoch].
  equals(epoch: Epoch): boolean {
    return this.posix === epoch.posix;
  }

  // / Convert to a [DateTime] object.
  toDateTime(): Date {
    return new Date(this.posix * 1000);
  }

  // / Convert to Julian date.
  toJulianDate(): number {
    return this.posix / secondsPerDay + 2440587.5;
  }

  // / Convert to Julian centuries.
  toJulianCenturies(): number {
    return (this.toJulianDate() - 2451545) / 36525;
  }

  compareTo(other: Epoch): number {
    return this.posix - other.posix;
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
