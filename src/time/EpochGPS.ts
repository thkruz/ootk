import { DataHandler } from '../data/DataHandler';
import { secondsPerWeek } from '../utils/constants';
import type { EpochUTC } from './EpochUTC';
// / Global Positioning System _(GPS)_ formatted epoch.
export class EpochGPS {
  /**
   * Create a new GPS epoch given the [week] since reference epoch, and number
   * of [seconds] into the [week].
   */
  constructor(public week: number, public seconds: number, reference: EpochUTC) {
    if (week < 0) {
      throw new Error('GPS week must be non-negative.');
    }
    if (seconds < 0 || seconds >= secondsPerWeek) {
      throw new Error('GPS seconds must be within a week.');
    }

    EpochGPS.reference = reference;
  }

  // / Number of weeks since the GPS reference epoch.
  static reference: EpochUTC;

  // / GPS leap second difference from TAI/UTC offsets.
  static offset = 19;

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
    const init = EpochGPS.reference.roll(this.week * secondsPerWeek + this.seconds);
    const ls = DataHandler.getInstance().getLeapSeconds(init.toJulianDate());

    return init.roll(-(ls - EpochGPS.offset));
  }
}
