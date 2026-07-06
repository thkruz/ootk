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

import type { J2000 } from '../coordinate/J2000';
import { ValidationError } from '../errors';
import type { CommunicationDeviceInterface } from '../objects/ObjectTypes';
import { CommDeviceType, CommPlatform, SerializedCommDevice } from './CommTypes';

/**
 * Parameters for constructing a CommunicationDevice.
 */
export interface CommunicationDeviceParams {
  /** Unique identifier for the device */
  id: number;
  /** Human-readable name */
  name: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Abstract base class for all communication devices.
 *
 * Communication devices are components that attach to platforms (ground stations
 * or satellites) rather than being location-based objects themselves. Position
 * is delegated to the parent platform.
 *
 * @example
 * ```typescript
 * // Create a transmitter and attach to ground station
 * const tx = new Transmitter({
 *   id: 'gs-uplink',
 *   name: 'Ground Station Uplink',
 *   frequency: 14e9 as Hertz,
 *   power: 1000 as Watts,
 *   antenna: new Antenna({ gain: 45 as Decibels }),
 * });
 *
 * groundStation.addCommDevice(tx);
 * tx.setParent(groundStation);
 * ```
 */
export abstract class CommunicationDevice implements CommunicationDeviceInterface {
  /** Unique identifier */
  readonly id: number;
  /** Human-readable name */
  name: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Parent platform this device is attached to */
  private parent_?: CommPlatform;

  constructor(params: CommunicationDeviceParams) {
    this.id = params.id;
    this.name = params.name;
    this.metadata = params.metadata;
  }

  // ==================== Abstract Properties ====================

  /**
   * Returns the device type classification.
   */
  abstract get deviceType(): CommDeviceType;

  // ==================== Abstract Methods ====================

  /**
   * Creates a deep copy of this communication device.
   * The cloned device will not have a parent assigned.
   * @returns A new CommunicationDevice instance with the same properties
   */
  abstract clone(): CommunicationDevice;

  // ==================== Platform Reference ====================

  /**
   * Gets the parent platform this device is attached to.
   * @throws Error if device has no parent assigned
   */
  get parent(): CommPlatform {
    if (!this.parent_) {
      throw new ValidationError(
        `Communication device "${this.name}" has no parent platform assigned`,
        'parent',
        undefined,
      );
    }

    return this.parent_;
  }

  /**
   * Sets the parent platform for this device.
   * @param platform - The ground object or space object to attach to
   */
  setParent(platform: CommPlatform): void {
    this.parent_ = platform;
  }

  /**
   * Checks if this device has a parent platform assigned.
   */
  hasParent(): boolean {
    return this.parent_ !== undefined;
  }

  // ==================== Position Methods ====================

  /**
   * Gets the device's position in J2000 coordinates.
   * Delegates to the parent platform.
   * @param date - Time for position calculation (defaults to now)
   * @returns J2000 state vector
   * @throws Error if no parent platform assigned
   */
  getJ2000(date: Date = new Date()): J2000 {
    return this.parent.toJ2000(date);
  }

  /**
   * Calculates the distance to another communication device.
   * @param other - The other device
   * @param date - Time for calculation (defaults to now)
   * @returns Distance in kilometers
   */
  getDistanceTo(other: CommunicationDevice, date: Date = new Date()): number {
    const thisPos = this.getJ2000(date).position;
    const otherPos = other.getJ2000(date).position;

    return Math.sqrt(
      (otherPos.x - thisPos.x) ** 2 +
      (otherPos.y - thisPos.y) ** 2 +
      (otherPos.z - thisPos.z) ** 2,
    );
  }

  // ==================== Serialization ====================

  /**
   * Creates a serializable representation of this device.
   */
  serialize(): SerializedCommDevice {
    const base: SerializedCommDevice = {
      type: this.constructor.name,
      id: this.id,
      name: this.name,
      deviceType: this.deviceType,
      parentId: this.parent_?.id,
      metadata: this.metadata,
    };

    // Add device-specific data
    const specific = this.serializeSpecific();

    return { ...base, ...specific };
  }

  /**
   * Returns device-type-specific serialization data.
   * Override in subclasses to add additional fields.
   */
  protected serializeSpecific(): Record<string, unknown> {
    return {};
  }

  /**
   * Returns a string representation of this device.
   */
  toString(): string {
    const lines = [
      `[${this.constructor.name}]`,
      `  ID: ${this.id}`,
      `  Name: ${this.name}`,
      `  Type: ${this.deviceType}`,
    ];

    if (this.hasParent()) {
      lines.push(`  Parent: ${this.parent.name}`);
    }

    return lines.join('\n');
  }
}
