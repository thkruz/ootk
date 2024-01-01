import type { EpochUTC } from './EpochUTC';

/**
 * Time stamped value container.
 */
export class TimeStamped<T> {
  /**
   * Create a new time stamped value container at the provided epoch.
   * @param epoch The timestamp epoch.
   * @param value The timestamped value.
   */
  constructor(epoch: EpochUTC, value: T) {
    this.epoch = epoch;
    this.value = value;
  }

  /**
   * Timestamp epoch.
   */
  readonly epoch: EpochUTC;

  /**
   * Timestamped value.
   */
  readonly value: T;
}
