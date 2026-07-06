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

import { Earth } from '../body/Earth';
import { ValidationError } from '../errors';
import { GroundObject } from '../objects/GroundObject';
import { SpaceObject } from '../objects/SpaceObject';
import { ecef2rae } from '../transforms/transforms';
import { Kilometers } from '../types/types';
import { Antenna } from './Antenna';
import {
  calculateFspl,
  calculatePropagationDelay,
  CommDeviceType,
  Dbw,
  Decibels,
  Hertz,
  LinkBudget,
  ModulationType,
  wattsToDbw,
  Watts,
} from './CommTypes';
import { CommunicationDevice, CommunicationDeviceParams } from './CommunicationDevice';
import type { Receiver } from './Receiver';

/**
 * Parameters for constructing a Transmitter.
 */
export interface TransmitterParams extends CommunicationDeviceParams {
  /** Transmit frequency in Hz */
  frequency: Hertz;
  /** Transmit power in Watts */
  power: Watts;
  /** Signal bandwidth in Hz */
  bandwidth: Hertz;
  /** Antenna for transmission */
  antenna: Antenna;
  /** Modulation type (optional) */
  modulation?: ModulationType;
  /** Line losses in dB (cables, connectors, etc.) */
  lineLoss?: Decibels;
}

/**
 * Transmitter communication device.
 *
 * Represents a device that transmits RF signals, such as a ground station
 * uplink or satellite downlink transmitter.
 *
 * @example
 * ```typescript
 * // Ground station uplink transmitter
 * const uplink = new Transmitter({
 *   id: 'gs-uplink',
 *   name: 'Ground Station Uplink',
 *   frequency: 14e9 as Hertz,   // 14 GHz (Ku-band uplink)
 *   power: 1000 as Watts,       // 1 kW
 *   bandwidth: 36e6 as Hertz,   // 36 MHz
 *   antenna: new Antenna({ gain: 45 as Decibels }),
 *   modulation: ModulationType.QPSK,
 * });
 *
 * groundStation.addCommDevice(uplink);
 * uplink.setParent(groundStation);
 *
 * // Calculate link to satellite receiver
 * const linkBudget = uplink.calculateLinkBudget(satelliteReceiver, date);
 * console.log(`SNR: ${linkBudget.snr.toFixed(1)} dB`);
 * ```
 */
export class Transmitter extends CommunicationDevice {
  /** Transmit frequency in Hz */
  frequency: Hertz;
  /** Transmit power in Watts */
  power: Watts;
  /** Signal bandwidth in Hz */
  bandwidth: Hertz;
  /** Antenna for transmission */
  antenna: Antenna;
  /** Modulation type */
  modulation?: ModulationType;
  /** Line losses in dB */
  lineLoss: Decibels;

  constructor(params: TransmitterParams) {
    super(params);

    if (params.power <= 0) {
      throw new ValidationError('Transmitter power must be positive', 'power', params.power);
    }
    if (params.frequency <= 0) {
      throw new ValidationError('Transmitter frequency must be positive', 'frequency', params.frequency);
    }
    if (params.bandwidth <= 0) {
      throw new ValidationError('Transmitter bandwidth must be positive', 'bandwidth', params.bandwidth);
    }

    this.frequency = params.frequency;
    this.power = params.power;
    this.bandwidth = params.bandwidth;
    this.antenna = params.antenna;
    this.modulation = params.modulation;
    this.lineLoss = params.lineLoss ?? (0 as Decibels);
  }

  // ==================== Properties ====================

  override get deviceType(): CommDeviceType {
    return CommDeviceType.TRANSMITTER;
  }

  /**
   * Creates a deep copy of this transmitter.
   * The cloned transmitter will not have a parent assigned.
   * @returns A new Transmitter instance with the same properties
   */
  clone(): Transmitter {
    return new Transmitter({
      id: this.id,
      name: this.name,
      frequency: this.frequency,
      power: this.power,
      bandwidth: this.bandwidth,
      antenna: this.antenna.clone(),
      modulation: this.modulation,
      lineLoss: this.lineLoss,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }

  /**
   * Gets the Effective Isotropic Radiated Power (EIRP) in dBW.
   * EIRP = Power(dBW) + Antenna Gain(dB) - Line Loss(dB)
   */
  get eirp(): Dbw {
    const powerDbw = wattsToDbw(this.power);

    return (powerDbw + this.antenna.gain - this.lineLoss) as Dbw;
  }

  /**
   * Gets the wavelength in meters.
   */
  get wavelength(): number {
    return 299792458 / this.frequency;
  }

  // ==================== Link Budget Methods ====================

  /**
   * Calculates the link budget to a receiver.
   *
   * @param receiver - The target receiver
   * @param date - Time for calculation (defaults to now)
   * @returns Link budget with EIRP, FSPL, received power, and SNR
   */
  calculateLinkBudget(receiver: Receiver, date: Date = new Date()): LinkBudget {
    const distance = this.getDistanceTo(receiver, date);
    const fspl = calculateFspl(distance, this.frequency);

    // Received power = EIRP - FSPL + Rx Antenna Gain - Rx Line Loss
    const receivedPower = (
      this.eirp - fspl + receiver.antenna.gain - receiver.lineLoss
    ) as Dbw;

    // Noise power = k * T * B (in dBW)
    // k = -228.6 dBW/K/Hz (Boltzmann constant)
    // For simplicity, we use the receiver's noise figure directly
    // SNR = Received Power - Noise Floor
    // Noise Floor = -174 dBm/Hz + 10*log10(BW) + Noise Figure
    // In dBW: Noise Floor = -204 dBW/Hz + 10*log10(BW) + Noise Figure
    const noiseFloorDbw = -204 + 10 * Math.log10(this.bandwidth) + receiver.noiseFigure;
    const snr = (receivedPower - noiseFloorDbw) as Decibels;

    return {
      eirp: this.eirp,
      fspl,
      receivedPower,
      snr,
      distance,
      frequency: this.frequency,
    };
  }

  /**
   * Gets the propagation delay to a receiver.
   * @param receiver - The target receiver
   * @param date - Time for calculation (defaults to now)
   * @returns Propagation delay in seconds
   */
  getPropagationDelay(receiver: Receiver, date: Date = new Date()): number {
    const distance = this.getDistanceTo(receiver, date);

    return calculatePropagationDelay(distance);
  }

  /**
   * Checks if this transmitter has line of sight to a receiver.
   * Checks for Earth obstruction between ground-space and space-space links.
   *
   * @param receiver - The target receiver
   * @param date - Time for calculation (defaults to now)
   * @returns True if line of sight exists (Earth does not block the path)
   */
  isVisible(receiver: Receiver, date: Date = new Date()): boolean {
    // Basic check: both must have parents
    if (!this.hasParent() || !receiver.hasParent()) {
      return false;
    }

    const txParent = this.parent;
    const rxParent = receiver.parent;

    // Ground-to-Space or Space-to-Ground: check elevation above horizon
    if (txParent instanceof GroundObject || rxParent instanceof GroundObject) {
      const ground = (txParent instanceof GroundObject ? txParent : rxParent) as GroundObject;
      const space = (txParent instanceof SpaceObject ? txParent : rxParent) as SpaceObject;

      const spaceEcef = space.ecef(date);

      if (!spaceEcef) {
        return false;
      }

      const rae = ecef2rae(ground.lla(), spaceEcef);

      // Visible if elevation is above horizon (0 degrees)
      return rae.el > 0;
    }

    // Space-to-Space: check if line segment intersects Earth
    const pos1 = this.getJ2000(date).position;
    const pos2 = receiver.getJ2000(date).position;

    return !this.lineIntersectsEarth_(pos1, pos2);
  }

  /**
   * Checks if a line segment between two points intersects Earth.
   * Uses ray-sphere intersection test with Earth's mean radius.
   *
   * @param pos1 - First position in km (J2000/ECI)
   * @param pos2 - Second position in km (J2000/ECI)
   * @returns True if the line segment passes through Earth
   */
  private lineIntersectsEarth_(
    pos1: { x: Kilometers; y: Kilometers; z: Kilometers },
    pos2: { x: Kilometers; y: Kilometers; z: Kilometers },
  ): boolean {
    // Direction vector from pos1 to pos2
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;

    // Coefficients for quadratic equation: |pos1 + t*d|^2 = R^2
    // a*t^2 + b*t + c = 0
    const a = dx * dx + dy * dy + dz * dz;
    const b = 2 * (pos1.x * dx + pos1.y * dy + pos1.z * dz);
    const c = pos1.x * pos1.x + pos1.y * pos1.y + pos1.z * pos1.z - Earth.radiusMean * Earth.radiusMean;

    const discriminant = b * b - 4 * a * c;

    // No intersection with Earth sphere
    if (discriminant < 0) {
      return false;
    }

    // Check if intersection points are within the line segment [0, 1]
    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    // Line intersects Earth if either intersection point is within segment
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
  }

  // ==================== Serialization ====================

  protected override serializeSpecific(): Record<string, unknown> {
    return {
      frequency: this.frequency,
      power: this.power,
      bandwidth: this.bandwidth,
      antenna: this.antenna.serialize(),
      modulation: this.modulation,
      lineLoss: this.lineLoss,
    };
  }

  /**
   * Creates a Transmitter from serialized data.
   * @param data - Serialized transmitter data
   * @returns A new Transmitter instance
   */
  static deserialize(data: Record<string, unknown>): Transmitter {
    return new Transmitter({
      id: data.id as number,
      name: data.name as string,
      frequency: data.frequency as Hertz,
      power: data.power as Watts,
      bandwidth: data.bandwidth as Hertz,
      antenna: Antenna.deserialize(data.antenna as ReturnType<Antenna['serialize']>),
      modulation: data.modulation as ModulationType | undefined,
      lineLoss: data.lineLoss as Decibels | undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
    });
  }

  override toString(): string {
    const lines = [
      '[Transmitter]',
      `  ID: ${this.id}`,
      `  Name: ${this.name}`,
      `  Frequency: ${(this.frequency / 1e9).toFixed(3)} GHz`,
      `  Power: ${this.power.toFixed(1)} W (${wattsToDbw(this.power).toFixed(1)} dBW)`,
      `  Bandwidth: ${(this.bandwidth / 1e6).toFixed(1)} MHz`,
      `  EIRP: ${this.eirp.toFixed(1)} dBW`,
      `  Antenna Gain: ${this.antenna.gain.toFixed(1)} dB`,
    ];

    if (this.modulation) {
      lines.push(`  Modulation: ${this.modulation}`);
    }

    if (this.lineLoss > 0) {
      lines.push(`  Line Loss: ${this.lineLoss.toFixed(1)} dB`);
    }

    if (this.hasParent()) {
      lines.push(`  Parent: ${this.parent.name}`);
    }

    return lines.join('\n');
  }
}
