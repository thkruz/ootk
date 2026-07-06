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
import { CommDeviceType, Decibels, Hertz } from './CommTypes';
import { CommunicationDevice, CommunicationDeviceParams } from './CommunicationDevice';
import type { Transmitter } from './Transmitter';

/**
 * Parameters for constructing a Receiver.
 */
export interface ReceiverParams extends CommunicationDeviceParams {
  /** Receive frequency in Hz */
  frequency: Hertz;
  /** Receiver bandwidth in Hz */
  bandwidth: Hertz;
  /** Receiver noise figure in dB */
  noiseFigure: Decibels;
  /** Minimum required SNR for successful reception in dB */
  minimumSnr: Decibels;
  /** Antenna for reception */
  antenna: Antenna;
  /** Line losses in dB (cables, connectors, etc.) */
  lineLoss?: Decibels;
}

/**
 * Receiver communication device.
 *
 * Represents a device that receives RF signals, such as a ground station
 * downlink receiver or satellite command receiver.
 *
 * @example
 * ```typescript
 * // Ground station downlink receiver
 * const downlink = new Receiver({
 *   id: 'gs-downlink',
 *   name: 'Ground Station Downlink',
 *   frequency: 12e9 as Hertz,    // 12 GHz (Ku-band downlink)
 *   bandwidth: 36e6 as Hertz,    // 36 MHz
 *   noiseFigure: 1.5 as Decibels,
 *   minimumSnr: 10 as Decibels,
 *   antenna: new Antenna({ gain: 45 as Decibels }),
 * });
 *
 * groundStation.addCommDevice(downlink);
 * downlink.setParent(groundStation);
 *
 * // Check if we can receive from satellite transmitter
 * if (downlink.canReceive(satelliteTransmitter, date)) {
 *   console.log('Link closed successfully');
 * }
 * ```
 */
export class Receiver extends CommunicationDevice {
  /** Receive frequency in Hz */
  frequency: Hertz;
  /** Receiver bandwidth in Hz */
  bandwidth: Hertz;
  /** Receiver noise figure in dB */
  noiseFigure: Decibels;
  /** Minimum required SNR for successful reception in dB */
  minimumSnr: Decibels;
  /** Antenna for reception */
  antenna: Antenna;
  /** Line losses in dB */
  lineLoss: Decibels;

  constructor(params: ReceiverParams) {
    super(params);

    if (params.frequency <= 0) {
      throw new ValidationError('Receiver frequency must be positive', 'frequency', params.frequency);
    }
    if (params.bandwidth <= 0) {
      throw new ValidationError('Receiver bandwidth must be positive', 'bandwidth', params.bandwidth);
    }
    if (params.noiseFigure < 0) {
      throw new ValidationError('Receiver noise figure must be non-negative', 'noiseFigure', params.noiseFigure);
    }

    this.frequency = params.frequency;
    this.bandwidth = params.bandwidth;
    this.noiseFigure = params.noiseFigure;
    this.minimumSnr = params.minimumSnr;
    this.antenna = params.antenna;
    this.lineLoss = params.lineLoss ?? (0 as Decibels);
  }

  // ==================== Properties ====================

  override get deviceType(): CommDeviceType {
    return CommDeviceType.RECEIVER;
  }

  /**
   * Creates a deep copy of this receiver.
   * The cloned receiver will not have a parent assigned.
   * @returns A new Receiver instance with the same properties
   */
  clone(): Receiver {
    return new Receiver({
      id: this.id,
      name: this.name,
      frequency: this.frequency,
      bandwidth: this.bandwidth,
      noiseFigure: this.noiseFigure,
      minimumSnr: this.minimumSnr,
      antenna: this.antenna.clone(),
      lineLoss: this.lineLoss,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }

  /**
   * Gets the noise floor in dBW.
   * Noise Floor = kTB + Noise Figure
   * = -228.6 dBW/K/Hz + 10*log10(290K) + 10*log10(BW) + NF
   * = -204 dBW/Hz + 10*log10(BW) + NF (at 290K)
   */
  get noiseFloor(): number {
    return -204 + 10 * Math.log10(this.bandwidth) + this.noiseFigure;
  }

  /**
   * Gets the system temperature in Kelvin (assuming 290K reference).
   * T_sys = T_ref * (10^(NF/10) - 1) + T_ref
   * Simplified: T_sys = T_ref * 10^(NF/10)
   */
  get systemTemperature(): number {
    return 290 * 10 ** (this.noiseFigure / 10);
  }

  /**
   * Gets the G/T (gain over system temperature) in dB/K.
   * This is a figure of merit for receive systems.
   */
  get gOverT(): number {
    return this.antenna.gain - 10 * Math.log10(this.systemTemperature);
  }

  // ==================== Reception Methods ====================

  /**
   * Checks if this receiver can receive from a transmitter.
   * Returns true if the calculated SNR exceeds the minimum required SNR.
   *
   * @param transmitter - The transmitter to check
   * @param date - Time for calculation (defaults to now)
   * @returns True if link closes successfully
   */
  canReceive(transmitter: Transmitter, date: Date = new Date()): boolean {
    // Check visibility first
    if (!transmitter.isVisible(this, date)) {
      return false;
    }

    // Calculate link budget
    const linkBudget = transmitter.calculateLinkBudget(this, date);

    // Check if SNR exceeds minimum
    return linkBudget.snr >= this.minimumSnr;
  }

  /**
   * Gets the link margin for a given transmitter.
   * Link margin = Actual SNR - Minimum required SNR
   *
   * @param transmitter - The transmitter to check
   * @param date - Time for calculation (defaults to now)
   * @returns Link margin in dB (positive = link closes)
   */
  getLinkMargin(transmitter: Transmitter, date: Date = new Date()): Decibels {
    const linkBudget = transmitter.calculateLinkBudget(this, date);

    return (linkBudget.snr - this.minimumSnr) as Decibels;
  }

  /**
   * Checks if the receiver's frequency is compatible with a transmitter.
   * Allows for small frequency differences (within bandwidth).
   *
   * @param transmitter - The transmitter to check
   * @returns True if frequencies are compatible
   */
  isFrequencyCompatible(transmitter: Transmitter): boolean {
    const freqDiff = Math.abs(this.frequency - transmitter.frequency);

    // Allow reception if transmitter is within our bandwidth
    return freqDiff <= this.bandwidth / 2;
  }

  // ==================== Serialization ====================

  protected override serializeSpecific(): Record<string, unknown> {
    return {
      frequency: this.frequency,
      bandwidth: this.bandwidth,
      noiseFigure: this.noiseFigure,
      minimumSnr: this.minimumSnr,
      antenna: this.antenna.serialize(),
      lineLoss: this.lineLoss,
    };
  }

  /**
   * Creates a Receiver from serialized data.
   * @param data - Serialized receiver data
   * @returns A new Receiver instance
   */
  static deserialize(data: Record<string, unknown>): Receiver {
    return new Receiver({
      id: data.id as number,
      name: data.name as string,
      frequency: data.frequency as Hertz,
      bandwidth: data.bandwidth as Hertz,
      noiseFigure: data.noiseFigure as Decibels,
      minimumSnr: data.minimumSnr as Decibels,
      antenna: Antenna.deserialize(data.antenna as ReturnType<Antenna['serialize']>),
      lineLoss: data.lineLoss as Decibels | undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
    });
  }

  override toString(): string {
    const lines = [
      '[Receiver]',
      `  ID: ${this.id}`,
      `  Name: ${this.name}`,
      `  Frequency: ${(this.frequency / 1e9).toFixed(3)} GHz`,
      `  Bandwidth: ${(this.bandwidth / 1e6).toFixed(1)} MHz`,
      `  Noise Figure: ${this.noiseFigure.toFixed(1)} dB`,
      `  Minimum SNR: ${this.minimumSnr.toFixed(1)} dB`,
      `  Antenna Gain: ${this.antenna.gain.toFixed(1)} dB`,
      `  G/T: ${this.gOverT.toFixed(1)} dB/K`,
    ];

    if (this.lineLoss > 0) {
      lines.push(`  Line Loss: ${this.lineLoss.toFixed(1)} dB`);
    }

    if (this.hasParent()) {
      lines.push(`  Parent: ${this.parent.name}`);
    }

    return lines.join('\n');
  }
}
