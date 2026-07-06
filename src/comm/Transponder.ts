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
import {
  calculatePropagationDelay,
  CommDeviceType,
  CommPlatform,
  Decibels,
  Hertz,
  RelayLinkBudget,
  Watts,
} from './CommTypes';
import { CommunicationDevice, CommunicationDeviceParams } from './CommunicationDevice';
import { Receiver } from './Receiver';
import { Transmitter } from './Transmitter';

/**
 * Parameters for constructing a Transponder.
 */
export interface TransponderParams extends CommunicationDeviceParams {
  /** Uplink (receive) frequency in Hz */
  uplinkFrequency: Hertz;
  /** Downlink (transmit) frequency in Hz */
  downlinkFrequency: Hertz;
  /** Transmit power in Watts */
  power: Watts;
  /** Transponder bandwidth in Hz */
  bandwidth: Hertz;
  /** Uplink antenna */
  uplinkAntenna: Antenna;
  /** Downlink antenna */
  downlinkAntenna: Antenna;
  /** Receiver noise figure in dB */
  noiseFigure?: Decibels;
  /** Processing delay in seconds (default 0) */
  delay?: number;
  /** Transponder gain (output power / input power) in dB */
  transponderGain?: Decibels;
}

/**
 * Satellite transponder for relay communications.
 *
 * A transponder receives signals on one frequency (uplink) and retransmits
 * them on another frequency (downlink). This is the core component for
 * satellite communication relay.
 *
 * @example
 * ```typescript
 * // Create a Ku-band transponder
 * const xponder = new Transponder({
 *   id: 'sat-xponder-1',
 *   name: 'Ku-band Transponder',
 *   uplinkFrequency: 14e9 as Hertz,     // 14 GHz uplink
 *   downlinkFrequency: 12e9 as Hertz,   // 12 GHz downlink
 *   power: 50 as Watts,
 *   bandwidth: 36e6 as Hertz,
 *   uplinkAntenna: new Antenna({ gain: 30 as Decibels }),
 *   downlinkAntenna: new Antenna({ gain: 30 as Decibels }),
 *   delay: 0.01,  // 10ms processing delay
 * });
 *
 * satellite.addCommDevice(xponder);
 * xponder.setParent(satellite);
 *
 * // Check if relay is possible
 * if (xponder.canRelay(groundUplink, groundDownlink, date)) {
 *   const budget = xponder.calculateRelayLink(groundUplink, groundDownlink, date);
 *   console.log(`End-to-end SNR: ${budget.endToEndSnr.toFixed(1)} dB`);
 * }
 * ```
 */
export class Transponder extends CommunicationDevice {
  /** Internal receiver component */
  readonly receiver: Receiver;
  /** Internal transmitter component */
  readonly transmitter: Transmitter;
  /** Processing delay in seconds */
  delay: number;
  /** Transponder gain in dB */
  transponderGain: Decibels;

  constructor(params: TransponderParams) {
    super(params);

    if (params.power <= 0) {
      throw new ValidationError('Transponder power must be positive', 'power', params.power);
    }
    if (params.uplinkFrequency <= 0 || params.downlinkFrequency <= 0) {
      throw new ValidationError(
        'Transponder frequencies must be positive',
        'frequency',
        { uplink: params.uplinkFrequency, downlink: params.downlinkFrequency },
      );
    }
    if (params.bandwidth <= 0) {
      throw new ValidationError('Transponder bandwidth must be positive', 'bandwidth', params.bandwidth);
    }

    // Create internal receiver
    this.receiver = new Receiver({
      id: params.id * 1000 + 1,
      name: `${params.name} Receiver`,
      frequency: params.uplinkFrequency,
      bandwidth: params.bandwidth,
      noiseFigure: params.noiseFigure ?? (3 as Decibels),
      minimumSnr: 0 as Decibels, // Transponder will relay whatever it receives
      antenna: params.uplinkAntenna,
    });

    // Create internal transmitter
    this.transmitter = new Transmitter({
      id: params.id * 1000 + 2,
      name: `${params.name} Transmitter`,
      frequency: params.downlinkFrequency,
      power: params.power,
      bandwidth: params.bandwidth,
      antenna: params.downlinkAntenna,
    });

    this.delay = params.delay ?? 0;
    this.transponderGain = params.transponderGain ?? (100 as Decibels);
  }

  // ==================== Properties ====================

  override get deviceType(): CommDeviceType {
    return CommDeviceType.TRANSPONDER;
  }

  /**
   * Creates a deep copy of this transponder.
   * The cloned transponder will not have a parent assigned.
   * @returns A new Transponder instance with the same properties
   */
  clone(): Transponder {
    return new Transponder({
      id: this.id,
      name: this.name,
      uplinkFrequency: this.receiver.frequency,
      downlinkFrequency: this.transmitter.frequency,
      power: this.transmitter.power,
      bandwidth: this.receiver.bandwidth,
      uplinkAntenna: this.receiver.antenna.clone(),
      downlinkAntenna: this.transmitter.antenna.clone(),
      noiseFigure: this.receiver.noiseFigure,
      delay: this.delay,
      transponderGain: this.transponderGain,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }

  /**
   * Gets the uplink frequency in Hz.
   */
  get uplinkFrequency(): Hertz {
    return this.receiver.frequency;
  }

  /**
   * Gets the downlink frequency in Hz.
   */
  get downlinkFrequency(): Hertz {
    return this.transmitter.frequency;
  }

  /**
   * Gets the frequency offset (downlink - uplink) in Hz.
   */
  get frequencyOffset(): Hertz {
    return (this.transmitter.frequency - this.receiver.frequency) as Hertz;
  }

  /**
   * Gets the transponder bandwidth in Hz.
   */
  get bandwidth(): Hertz {
    return this.receiver.bandwidth;
  }

  /**
   * Gets the transmit power in Watts.
   */
  get power(): Watts {
    return this.transmitter.power;
  }

  // ==================== Platform Override ====================

  /**
   * Override setParent to also set parent on internal components.
   */
  override setParent(platform: CommPlatform): void {
    super.setParent(platform);
    this.receiver.setParent(platform);
    this.transmitter.setParent(platform);
  }

  // ==================== Relay Methods ====================

  /**
   * Checks if this transponder can relay between an uplink transmitter
   * and a downlink receiver.
   *
   * @param uplink - The ground station uplink transmitter
   * @param downlink - The ground station downlink receiver
   * @param date - Time for calculation (defaults to now)
   * @returns True if relay is possible
   */
  canRelay(uplink: Transmitter, downlink: Receiver, date: Date = new Date()): boolean {
    // Check if we can receive the uplink
    if (!this.receiver.canReceive(uplink, date)) {
      return false;
    }

    // Check if downlink can receive from our transmitter
    if (!downlink.canReceive(this.transmitter, date)) {
      return false;
    }

    return true;
  }

  /**
   * Calculates the complete relay link budget.
   *
   * @param uplink - The ground station uplink transmitter
   * @param downlink - The ground station downlink receiver
   * @param date - Time for calculation (defaults to now)
   * @returns Complete relay link budget
   */
  calculateRelayLink(
    uplink: Transmitter,
    downlink: Receiver,
    date: Date = new Date(),
  ): RelayLinkBudget {
    // Calculate uplink budget
    const uplinkBudget = uplink.calculateLinkBudget(this.receiver, date);

    // Calculate downlink budget
    const downlinkBudget = this.transmitter.calculateLinkBudget(downlink, date);

    // Calculate end-to-end SNR
    // For a bent-pipe transponder, the end-to-end SNR is limited by the
    // weaker of the two links. More precisely:
    // 1/(SNR_total) = 1/(SNR_up) + 1/(SNR_down)
    const snrUpLinear = 10 ** (uplinkBudget.snr / 10);
    const snrDownLinear = 10 ** (downlinkBudget.snr / 10);
    const snrTotalLinear = 1 / (1 / snrUpLinear + 1 / snrDownLinear);
    const endToEndSnr = (10 * Math.log10(snrTotalLinear)) as Decibels;

    // Calculate total delay
    const uplinkDelay = calculatePropagationDelay(uplinkBudget.distance);
    const downlinkDelay = calculatePropagationDelay(downlinkBudget.distance);
    const totalDelay = uplinkDelay + this.delay + downlinkDelay;

    return {
      uplink: uplinkBudget,
      downlink: downlinkBudget,
      endToEndSnr,
      totalDelay,
    };
  }

  /**
   * Gets the total propagation delay for a relay path.
   *
   * @param uplink - The ground station uplink transmitter
   * @param downlink - The ground station downlink receiver
   * @param date - Time for calculation (defaults to now)
   * @returns Total delay in seconds
   */
  getTotalDelay(
    uplink: Transmitter,
    downlink: Receiver,
    date: Date = new Date(),
  ): number {
    const uplinkDistance = uplink.getDistanceTo(this.receiver, date);
    const downlinkDistance = this.transmitter.getDistanceTo(downlink, date);

    return (
      calculatePropagationDelay(uplinkDistance) +
      this.delay +
      calculatePropagationDelay(downlinkDistance)
    );
  }

  // ==================== Serialization ====================

  protected override serializeSpecific(): Record<string, unknown> {
    return {
      uplinkFrequency: this.receiver.frequency,
      downlinkFrequency: this.transmitter.frequency,
      power: this.transmitter.power,
      bandwidth: this.receiver.bandwidth,
      uplinkAntenna: this.receiver.antenna.serialize(),
      downlinkAntenna: this.transmitter.antenna.serialize(),
      noiseFigure: this.receiver.noiseFigure,
      delay: this.delay,
      transponderGain: this.transponderGain,
    };
  }

  /**
   * Creates a Transponder from serialized data.
   * @param data - Serialized transponder data
   * @returns A new Transponder instance
   */
  static deserialize(data: Record<string, unknown>): Transponder {
    return new Transponder({
      id: data.id as number,
      name: data.name as string,
      uplinkFrequency: data.uplinkFrequency as Hertz,
      downlinkFrequency: data.downlinkFrequency as Hertz,
      power: data.power as Watts,
      bandwidth: data.bandwidth as Hertz,
      uplinkAntenna: Antenna.deserialize(data.uplinkAntenna as ReturnType<Antenna['serialize']>),
      downlinkAntenna: Antenna.deserialize(data.downlinkAntenna as ReturnType<Antenna['serialize']>),
      noiseFigure: data.noiseFigure as Decibels | undefined,
      delay: data.delay as number | undefined,
      transponderGain: data.transponderGain as Decibels | undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
    });
  }

  override toString(): string {
    const lines = [
      '[Transponder]',
      `  ID: ${this.id}`,
      `  Name: ${this.name}`,
      `  Uplink: ${(this.uplinkFrequency / 1e9).toFixed(3)} GHz`,
      `  Downlink: ${(this.downlinkFrequency / 1e9).toFixed(3)} GHz`,
      `  Bandwidth: ${(this.bandwidth / 1e6).toFixed(1)} MHz`,
      `  Power: ${this.power.toFixed(1)} W`,
      `  Delay: ${(this.delay * 1000).toFixed(1)} ms`,
    ];

    if (this.hasParent()) {
      lines.push(`  Parent: ${this.parent.name}`);
    }

    return lines.join('\n');
  }
}
