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
 *   id: 'sat-beacon',
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
 * // Get next transmission window
 * const nextTx = beacon.getNextTransmission(new Date());
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
   * Gets the next transmission window.
   *
   * @param afterDate - Find transmission after this time (defaults to now)
   * @returns Object with start and end times of next transmission
   */
  getNextTransmission(afterDate: Date = new Date()): { start: Date; end: Date } {
    const secondsSinceEpoch = (afterDate.getTime() - this.epoch.getTime()) / 1000;

    // Handle times before epoch
    if (secondsSinceEpoch < 0) {
      return {
        start: this.epoch,
        end: new Date(this.epoch.getTime() + this.transmitDuration * 1000),
      };
    }

    const positionInCycle = secondsSinceEpoch % this.transmitInterval;

    let nextStartOffset: number;

    if (positionInCycle < this.transmitDuration) {
      // Currently transmitting - return current transmission window
      nextStartOffset = -positionInCycle;
    } else {
      // Not transmitting - return next transmission
      nextStartOffset = this.transmitInterval - positionInCycle;
    }

    const startTime = new Date(afterDate.getTime() + nextStartOffset * 1000);
    const endTime = new Date(startTime.getTime() + this.transmitDuration * 1000);

    return { start: startTime, end: endTime };
  }

  /**
   * Gets all transmission windows within a time range.
   *
   * @param startDate - Start of time range
   * @param endDate - End of time range
   * @returns Array of transmission windows
   */
  getTransmissionsInRange(
    startDate: Date,
    endDate: Date,
  ): Array<{ start: Date; end: Date }> {
    const windows: Array<{ start: Date; end: Date }> = [];

    let current = this.getNextTransmission(startDate);

    while (current.start.getTime() < endDate.getTime()) {
      // Only include if transmission starts within range
      if (current.start.getTime() >= startDate.getTime()) {
        windows.push({
          start: current.start,
          end: new Date(Math.min(current.end.getTime(), endDate.getTime())),
        });
      }

      // Move to next cycle
      const nextSearch = new Date(current.end.getTime() + 1);

      current = this.getNextTransmission(nextSearch);

      // Safety check to prevent infinite loops
      if (windows.length > 10000) {
        break;
      }
    }

    return windows;
  }

  /**
   * Gets the number of transmissions in a time range.
   *
   * @param startDate - Start of time range
   * @param endDate - End of time range
   * @returns Number of transmissions
   */
  getTransmissionCount(startDate: Date, endDate: Date): number {
    const durationSeconds = (endDate.getTime() - startDate.getTime()) / 1000;

    // Approximate count based on interval
    return Math.floor(durationSeconds / this.transmitInterval) + 1;
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
