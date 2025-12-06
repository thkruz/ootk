/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
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

import type { ClassicalElements } from '../coordinate/ClassicalElements';
import type { ITRF } from '../coordinate/ITRF';
import type { J2000 } from '../coordinate/J2000';
import {
  Degrees,
  EcefVec3,
  Kilometers,
  KilometersPerSecond,
  LlaVec3,
  PosVel,
  TemeVec3,
} from '../types/types';
import { BaseObject, BaseObjectParams } from './BaseObject';
import { CommunicationDeviceInterface, SensorInterface } from './ObjectTypes';

/**
 * Parameters for constructing a SpaceObject.
 */
export interface SpaceObjectParams extends BaseObjectParams {
  /** Initial position in TEME frame */
  position?: TemeVec3;
  /** Initial velocity in TEME frame */
  velocity?: TemeVec3<KilometersPerSecond>;
}

/**
 * Abstract base class for all objects in space (satellites, debris, etc.).
 * Provides position/velocity state, coordinate conversion methods,
 * and component attachment capabilities.
 */
export abstract class SpaceObject extends BaseObject {
  /**
   * Current position in TEME (True Equator Mean Equinox) frame.
   * This is a cache of the last computed state.
   */
  position: TemeVec3;
  /**
   * Current velocity in TEME (True Equator Mean Equinox) frame.
   * This is a cache of the last computed state.
   */
  velocity: TemeVec3<KilometersPerSecond>;

  /** Sensors attached to this space object */
  sensors: SensorInterface[] = [];
  /** Communication devices attached to this space object */
  commDevices: CommunicationDeviceInterface[] = [];

  constructor(info: SpaceObjectParams) {
    super(info);

    // Default to origin until position is calculated
    this.position = info.position ?? {
      x: 0 as Kilometers,
      y: 0 as Kilometers,
      z: 0 as Kilometers,
    };

    // Default to zero velocity until calculated
    this.velocity = info.velocity ?? {
      x: 0 as KilometersPerSecond,
      y: 0 as KilometersPerSecond,
      z: 0 as KilometersPerSecond,
    };
  }

  // ==================== Computed Properties ====================

  /**
   * Returns the total velocity magnitude in km/s.
   */
  get totalVelocity(): number {
    return Math.hypot(
      this.velocity.x,
      this.velocity.y,
      this.velocity.z,
    );
  }

  // ==================== Abstract Position Methods ====================

  /**
   * Returns the position and velocity in TEME (True Equator Mean Equinox) frame at the given time.
   * TEME is the native output frame of SGP4/SDP4 propagation.
   * @param date - The time to calculate position for (defaults to now)
   * @returns Position and velocity in TEME frame, or null if propagation fails
   */
  abstract eci(date?: Date): PosVel | null;

  /**
   * Returns the ECEF (Earth-Centered Earth Fixed) position at the given time.
   * @param date - The time to calculate position for (defaults to now)
   */
  abstract ecef(date?: Date): EcefVec3<Kilometers> | null;

  /**
   * Returns the geodetic position (lat/lon/alt) at the given time.
   * @param date - The time to calculate position for (defaults to now)
   */
  abstract lla(date?: Date): LlaVec3<Degrees, Kilometers> | null;

  // ==================== Abstract Coordinate Conversions ====================

  /**
   * Returns J2000 coordinates at the given time.
   * @param date - The time to calculate for (defaults to now)
   */
  abstract toJ2000(date?: Date): J2000;

  /**
   * Returns ITRF coordinates at the given time.
   * @param date - The time to calculate for (defaults to now)
   */
  abstract toITRF(date?: Date): ITRF;

  /**
   * Returns classical orbital elements at the given time.
   * @param date - The time to calculate for (defaults to now)
   */
  abstract toClassicalElements(date?: Date): ClassicalElements;

  // ==================== Abstract Clone ====================

  /**
   * Creates a deep copy of this object.
   */
  abstract clone(): SpaceObject;

  // ==================== Component Management ====================

  /**
   * Adds a sensor to this space object.
   * @param sensor - The sensor to add
   */
  addSensor(sensor: SensorInterface): void {
    if (!this.sensors.some((s) => s.id === sensor.id)) {
      this.sensors.push(sensor);
    }
  }

  /**
   * Removes a sensor from this space object.
   * @param sensorId - The ID of the sensor to remove
   */
  removeSensor(sensorId: string): void {
    this.sensors = this.sensors.filter((s) => s.id !== sensorId);
  }

  /**
   * Adds a communication device to this space object.
   * @param device - The device to add
   */
  addCommDevice(device: CommunicationDeviceInterface): void {
    if (!this.commDevices.some((d) => d.id === device.id)) {
      this.commDevices.push(device);
    }
  }

  /**
   * Removes a communication device from this space object.
   * @param deviceId - The ID of the device to remove
   */
  removeCommDevice(deviceId: string): void {
    this.commDevices = this.commDevices.filter((d) => d.id !== deviceId);
  }

  // ==================== Type Checking Overrides ====================

  /**
   * Space objects are satellites by default.
   */
  override isSatellite(): boolean {
    return true;
  }

  /**
   * Space objects are never static.
   */
  override isStatic(): boolean {
    return false;
  }
}
