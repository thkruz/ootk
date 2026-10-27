/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
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

import { ValidationError } from '../errors';
import { Antenna } from './Antenna';
import { CommDeviceType, Decibels, Hertz, ModulationType, Watts } from './CommTypes';
import { Transmitter, TransmitterParams } from './Transmitter';

/**
 * Parameters for constructing a Beacon.
 */
export interface BeaconParams extends TransmitterParams {
  /** Interval between transmissions in seconds */
  transmitInterval: number;
  /** Duration of each transmission in seconds */
  transmitDuration: number;
  /** Reference epoch for transmission timing */
  epoch: Date;
  /** Message format identifier (optional) */
  messageFormat?: string;
}

/**
 * Beacon transmitter for periodic satellite telemetry.
 *
 * A beacon is a transmitter that sends signals at regular intervals.
 * It extends Transmitter with timing behavior for periodic transmissions.
 *
 * @example
 * ```typescript
 * // Create a telemetry beacon
 * const beacon = new Beacon({
 *   id: 401,
 *   name: 'Telemetry Beacon',
 *   frequency: 437e6 as Hertz,      // 437 MHz (UHF amateur band)
 *   power: 1 as Watts,
 *   bandwidth: 10e3 as Hertz,       // 10 kHz
 *   antenna: Antenna.omnidirectional(),
 *   transmitInterval: 60,           // Every 60 seconds
 *   transmitDuration: 5,            // 5 second transmission
 *   epoch: new Date('2025-01-01T00:00:00Z'),
 *   modulation: ModulationType.BPSK,
 *   messageFormat: 'AX.25',
 * });
 *
 * satellite.addCommDevice(beacon);
 * beacon.setParent(satellite);
 *
 * // Check if beacon is currently transmitting
 * if (beacon.isTransmitting(new Date())) {
 *   console.log('Beacon is active');
 * }
 *
 * // Get the next transmission window (strictly after now) or the one in progress
 * const nextTx = beacon.getNextTransmission(new Date());
 * const currentTx = beacon.getCurrentTransmission(new Date());
 * console.log(`Next beacon at ${nextTx.start}`);
 * ```
 */
export class Beacon extends Transmitter {
  /** Interval between transmissions in seconds */
  transmitInterval: number;
  /** Duration of each transmission in seconds */
  transmitDuration: number;
  /** Reference epoch for transmission timing */
  epoch: Date;
  /** Message format identifier */
  messageFormat?: string;

  constructor(params: BeaconParams) {
    super(params);

    if (params.transmitInterval <= 0) {
      throw new ValidationError('Beacon transmit interval must be positive', 'transmitInterval', params.transmitInterval);
    }
    if (params.transmitDuration <= 0) {
      throw new ValidationError('Beacon transmit duration must be positive', 'transmitDuration', params.transmitDuration);
    }
    if (params.transmitDuration > params.transmitInterval) {
      throw new ValidationError(
        'Beacon transmit duration cannot exceed transmit interval',
        'transmitDuration',
        params.transmitDuration,
      );
    }

    this.transmitInterval = params.transmitInterval;
    this.transmitDuration = params.transmitDuration;
    this.epoch = params.epoch;
    this.messageFormat = params.messageFormat;
  }

  // ==================== Properties ====================

  override get deviceType(): CommDeviceType {
    return CommDeviceType.BEACON;
  }

  /**
   * Creates a deep copy of this beacon.
   * The cloned beacon will not have a parent assigned.
   * @returns A new Beacon instance with the same properties
   */
  override clone(): Beacon {
    return new Beacon({
      id: this.id,
      name: this.name,
      frequency: this.frequency,
      power: this.power,
      bandwidth: this.bandwidth,
      antenna: this.antenna.clone(),
      modulation: this.modulation,
      lineLoss: this.lineLoss,
      transmitInterval: this.transmitInterval,
      transmitDuration: this.transmitDuration,
      epoch: new Date(this.epoch),
      messageFormat: this.messageFormat,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }

  /**
   * Gets the duty cycle of the beacon (0-1).
   */
  get dutyCycle(): number {
    return this.transmitDuration / this.transmitInterval;
  }

  // ==================== Timing Methods ====================

  /**
   * Checks if the beacon is transmitting at a given time.
   *
   * @param date - Time to check (defaults to now)
   * @returns True if beacon is currently transmitting
   */
  isTransmitting(date: Date = new Date()): boolean {
    const secondsSinceEpoch = (date.getTime() - this.epoch.getTime()) / 1000;

    // Handle times before epoch
    if (secondsSinceEpoch < 0) {
      return false;
    }

    const positionInCycle = secondsSinceEpoch % this.transmitInterval;

    return positionInCycle < this.transmitDuration;
  }

  /**
   * Gets the time remaining in the current transmission.
   * Returns 0 if not currently transmitting.
   *
   * @param date - Time to check (defaults to now)
   * @returns Remaining transmission time in seconds
   */
  getRemainingTransmitTime(date: Date = new Date()): number {
    if (!this.isTransmitting(date)) {
      return 0;
    }

    const secondsSinceEpoch = (date.getTime() - this.epoch.getTime()) / 1000;
    const positionInCycle = secondsSinceEpoch % this.transmitInterval;

    return this.transmitDuration - positionInCycle;
  }

  /**
   * Window k (k = 0, 1, 2, ...) is the half-open interval
   * [epoch + k * transmitInterval, epoch + k * transmitInterval + transmitDuration).
   * @param k Cycle index.
   * @returns The window's start and end.
   */
  private window_(k: number): { start: Date; end: Date } {
    const startMs = this.epoch.getTime() + k * this.transmitInterval * 1000;

    return { start: new Date(startMs), end: new Date(startMs + this.transmitDuration * 1000) };
  }

  /**
   * Gets the transmission window in progress at a given time.
   *
   * @param date - Time to check (defaults to now)
   * @returns The window containing `date` (start <= date < end), or null when the beacon is
   * silent at that time or `date` is before the epoch
   */
  getCurrentTransmission(date: Date = new Date()): { start: Date; end: Date } | null {
    const elapsedMs = date.getTime() - this.epoch.getTime();

    if (elapsedMs < 0) {
      return null;
    }

    const win = this.window_(Math.floor(elapsedMs / (this.transmitInterval * 1000)));

    return date.getTime() < win.end.getTime() ? win : null;
  }

  /**
   * Gets the next transmission window that starts strictly after a given time.
   *
   * A window already in progress at `afterDate`, or starting exactly at it, is not returned;
   * use {@link getCurrentTransmission} for that one.
   *
   * @param afterDate - Find the first transmission starting after this time (defaults to now)
   * @returns Object with start and end times of that transmission
   */
  getNextTransmission(afterDate: Date = new Date()): { start: Date; end: Date } {
    const elapsedMs = afterDate.getTime() - this.epoch.getTime();

    if (elapsedMs < 0) {
      return this.window_(0);
    }

    // Window floor(elapsed / interval) starts at or before afterDate, so the next one is k + 1
    return this.window_(Math.floor(elapsedMs / (this.transmitInterval * 1000)) + 1);
  }

  /**
   * Index range of the windows that overlap [startDate, endDate): window k overlaps when
   * start_k < endDate and end_k > startDate.
   * @param startDate Start of the range (inclusive).
   * @param endDate End of the range (exclusive).
   * @returns First and last overlapping cycle indices (first > last when there are none).
   */
  private overlappingRange_(startDate: Date, endDate: Date): { first: number; last: number } {
    const intervalMs = this.transmitInterval * 1000;
    const durationMs = this.transmitDuration * 1000;
    const startMs = startDate.getTime() - this.epoch.getTime();
    const endMs = endDate.getTime() - this.epoch.getTime();

    if (endMs <= startMs) {
      return { first: 0, last: -1 };
    }

    // k * I + D > startMs  <=>  k > (startMs - D) / I
    const first = Math.max(0, Math.floor((startMs - durationMs) / intervalMs) + 1);
    // k * I < endMs  <=>  k < endMs / I
    const last = Math.ceil(endMs / intervalMs) - 1;

    return { first, last };
  }

  /**
   * Gets every transmission window that overlaps a time range, each clipped to the range.
   *
   * The range is half-open, [startDate, endDate). A window in progress at `startDate` is
   * included with its start clipped to `startDate`; a window running past `endDate` is included
   * with its end clipped to `endDate`. A window starting exactly at `endDate` is not included.
   *
   * @param startDate - Start of time range (inclusive)
   * @param endDate - End of time range (exclusive)
   * @returns Array of transmission windows in time order
   */
  getTransmissionsInRange(
    startDate: Date,
    endDate: Date,
  ): Array<{ start: Date; end: Date }> {
    const { first, last } = this.overlappingRange_(startDate, endDate);
    const windows: Array<{ start: Date; end: Date }> = [];
    // Safety cap so a tiny interval over a long range cannot exhaust memory
    const lastCapped = Math.min(last, first + 10000);

    for (let k = first; k <= lastCapped; k++) {
      const win = this.window_(k);

      windows.push({
        start: new Date(Math.max(win.start.getTime(), startDate.getTime())),
        end: new Date(Math.min(win.end.getTime(), endDate.getTime())),
      });
    }

    return windows;
  }

  /**
   * Gets the number of transmissions that overlap a time range [startDate, endDate).
   *
   * Counts the same windows as {@link getTransmissionsInRange} (without its 10001-window cap),
   * using the epoch phase, so a range that falls entirely between two windows counts 0.
   *
   * @param startDate - Start of time range (inclusive)
   * @param endDate - End of time range (exclusive)
   * @returns Number of transmissions
   */
  getTransmissionCount(startDate: Date, endDate: Date): number {
    const { first, last } = this.overlappingRange_(startDate, endDate);

    return Math.max(0, last - first + 1);
  }

  // ==================== Serialization ====================

  protected override serializeSpecific(): Record<string, unknown> {
    const base = super.serializeSpecific();

    return {
      ...base,
      transmitInterval: this.transmitInterval,
      transmitDuration: this.transmitDuration,
      epoch: this.epoch.toISOString(),
      messageFormat: this.messageFormat,
    };
  }

  /**
   * Creates a Beacon from serialized data.
   * @param data - Serialized beacon data
   * @returns A new Beacon instance
   */
  static override deserialize(data: Record<string, unknown>): Beacon {
    return new Beacon({
      id: data.id as number,
      name: data.name as string,
      frequency: data.frequency as Hertz,
      power: data.power as Watts,
      bandwidth: data.bandwidth as Hertz,
      antenna: Antenna.deserialize(data.antenna as ReturnType<Antenna['serialize']>),
      modulation: data.modulation as ModulationType | undefined,
      lineLoss: data.lineLoss as Decibels | undefined,
      transmitInterval: data.transmitInterval as number,
      transmitDuration: data.transmitDuration as number,
      epoch: new Date(data.epoch as string),
      messageFormat: data.messageFormat as string | undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
    });
  }

  override toString(): string {
    const lines = [
      '[Beacon]',
      `  ID: ${this.id}`,
      `  Name: ${this.name}`,
      `  Frequency: ${(this.frequency / 1e6).toFixed(3)} MHz`,
      `  Power: ${this.power.toFixed(2)} W`,
      `  Interval: ${this.transmitInterval} s`,
      `  Duration: ${this.transmitDuration} s`,
      `  Duty Cycle: ${(this.dutyCycle * 100).toFixed(1)}%`,
      `  Epoch: ${this.epoch.toISOString()}`,
    ];

    if (this.messageFormat) {
      lines.push(`  Format: ${this.messageFormat}`);
    }

    if (this.hasParent()) {
      lines.push(`  Parent: ${this.parent.name}`);
    }

    return lines.join('\n');
  }
}
