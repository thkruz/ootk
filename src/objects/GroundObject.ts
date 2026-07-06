/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Many of the classes are based off of the work of @david-rc-dayton and his
 * Pious Squid library (https://github.com/david-rc-dayton/pious_squid) which
 * is licensed under the MIT license.
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

import { Geodetic } from '../coordinate/Geodetic';
import { J2000 } from '../coordinate/J2000';
import { DEG2RAD } from '../utils/constants';
import { Degrees, EcefVec3, Kilometers, KilometersPerSecond, LlaVec3, Radians, RaeVec3, SpaceObjectType, TemeVec3 } from '../types/types';
import { calcGmst, lla2eci, llaRad2ecef } from '../transforms/transforms';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { BaseObject, BaseObjectParams } from './BaseObject';
import { CommunicationDeviceInterface, SensorInterface } from './ObjectTypes';
import type { Satellite } from './Satellite';

/**
 * Parameters for constructing a GroundObject.
 */
export interface GroundObjectParams extends BaseObjectParams {
  lat: Degrees;
  lon: Degrees;
  alt: Kilometers;
}

/**
 * Abstract base class for all objects on Earth's surface.
 * Provides coordinate conversion methods and component attachment capabilities.
 */
export abstract class GroundObject extends BaseObject {
  override name = 'Unknown Ground Object';
  readonly lat: Degrees;
  readonly lon: Degrees;
  readonly alt: Kilometers;

  /** Sensors attached to this ground object */
  sensors: SensorInterface[] = [];
  /** Communication devices attached to this ground object */
  commDevices: CommunicationDeviceInterface[] = [];

  constructor(info: GroundObjectParams) {
    super(info);

    this.validateGroundObjectInputData_(info);
    this.name = info.name ?? this.name;
    this.lat = info.lat;
    this.lon = info.lon;
    this.alt = info.alt;
  }

  // ==================== Coordinate Methods ====================

  /**
   * Calculates the relative azimuth, elevation, and range between this GroundObject and a Satellite.
   * @param satellite The Satellite object.
   * @param date The date for which to calculate the RAE values. Defaults to the current date.
   * @returns The relative azimuth, elevation, and range values in kilometers and degrees.
   */
  rae(satellite: Satellite, date: Date = new Date()): RaeVec3<Kilometers, Degrees> | null {
    return satellite.rae(this, date);
  }

  /**
   * Calculates ECEF position at a given time.
   * @variation optimized version of this.toGeodetic().toITRF().position;
   * @returns The ECEF position vector of the ground object.
   */
  ecef(): EcefVec3<Kilometers> {
    return llaRad2ecef(this.toGeodetic());
  }

  /**
   * Calculates the Earth-Centered Inertial (ECI) position vector of the ground object at a given date.
   * @variation optimized version of this.toGeodetic().toITRF().toJ2000().position;
   * @param date The date for which to calculate the ECI position vector. Defaults to the current date.
   * @returns The ECI position vector of the ground object.
   */
  eci(date: Date = new Date()): TemeVec3<Kilometers> {
    const { gmst } = calcGmst(date);

    return lla2eci(this.toGeodetic(), gmst);
  }

  /**
   * Returns the latitude, longitude, and altitude of the GroundObject.
   * @returns The latitude, longitude, and altitude as an LlaVec3 object.
   */
  lla(): LlaVec3<Degrees, Kilometers> {
    return {
      lat: this.lat,
      lon: this.lon,
      alt: this.alt,
    };
  }

  /**
   * Converts the latitude, longitude, and altitude of the GroundObject to radians and kilometers.
   * @variation optimized version of this.toGeodetic() without class instantiation for better performance and
   * serialization.
   * @returns An object containing the latitude, longitude, and altitude in radians and kilometers.
   */
  llaRad(): LlaVec3<Radians, Kilometers> {
    return {
      lat: (this.lat * DEG2RAD) as Radians,
      lon: (this.lon * DEG2RAD) as Radians,
      alt: this.alt,
    };
  }

  get latRad(): Radians {
    return (this.lat * DEG2RAD) as Radians;
  }

  get lonRad(): Radians {
    return (this.lon * DEG2RAD) as Radians;
  }

  /**
   * Converts the ground position to geodetic coordinates.
   * @returns The geodetic coordinates.
   */
  toGeodetic(): Geodetic {
    return Geodetic.fromDegrees(this.lat, this.lon, this.alt);
  }

  /**
   * Converts the ground position to J2000 inertial coordinates.
   * Ground objects have zero velocity in the inertial frame (ignoring Earth rotation).
   * @param date - The date for the conversion (defaults to now)
   * @returns J2000 state vector
   */
  toJ2000(date: Date = new Date()): J2000 {
    const { gmst } = calcGmst(date);
    const position = lla2eci(this.llaRad(), gmst);

    return new J2000(
      EpochUTC.fromDateTime(date),
      new Vector3D(position.x, position.y, position.z),
      new Vector3D(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond),
    );
  }

  // ==================== Component Management ====================

  /**
   * Adds a sensor to this ground object.
   * @param sensor - The sensor to add
   */
  addSensor(sensor: SensorInterface): void {
    if (!this.sensors.some((s) => s.id === sensor.id)) {
      this.sensors.push(sensor);
    }
  }

  /**
   * Removes a sensor from this ground object.
   * @param sensorId - The ID of the sensor to remove
   */
  removeSensor(sensorId: number): void {
    this.sensors = this.sensors.filter((s) => s.id !== sensorId);
  }

  /**
   * Adds a communication device to this ground object.
   * @param device - The device to add
   */
  addCommDevice(device: CommunicationDeviceInterface): void {
    if (!this.commDevices.some((d) => d.id === device.id)) {
      this.commDevices.push(device);
    }
  }

  /**
   * Removes a communication device from this ground object.
   * @param deviceId - The ID of the device to remove
   */
  removeCommDevice(deviceId: number): void {
    this.commDevices = this.commDevices.filter((d) => d.id !== deviceId);
  }

  // ==================== Type Checking ====================

  override isGroundObject(): boolean {
    switch (this.type) {
      case SpaceObjectType.GROUND_SENSOR_STATION:
      case SpaceObjectType.INTERGOVERNMENTAL_ORGANIZATION:
      case SpaceObjectType.SUBORBITAL_PAYLOAD_OPERATOR:
      case SpaceObjectType.PAYLOAD_OWNER:
      case SpaceObjectType.METEOROLOGICAL_ROCKET_LAUNCH_AGENCY_OR_MANUFACTURER:
      case SpaceObjectType.PAYLOAD_MANUFACTURER:
      case SpaceObjectType.LAUNCH_VEHICLE_MANUFACTURER:
      case SpaceObjectType.ENGINE_MANUFACTURER:
      case SpaceObjectType.LAUNCH_AGENCY:
      case SpaceObjectType.LAUNCH_SITE:
      case SpaceObjectType.LAUNCH_POSITION:
      case SpaceObjectType.CONTROL_FACILITY:
      case SpaceObjectType.OBSERVER:
        return true;
      default:
        return false;
    }
  }

  // ==================== Validation ====================

  /**
   * Validates the input data for the GroundObject.
   * @param info - The GroundPositionParams object containing the latitude,
   * longitude, and altitude.
   */
  private validateGroundObjectInputData_(info: GroundObjectParams): void {
    this.validateParameter(info.lat, -90, 90, 'Invalid latitude - must be between -90 and 90');
    this.validateParameter(info.lon, -180, 180, 'Invalid longitude - must be between -180 and 180');
    this.validateParameter(info.alt, 0, null, 'Invalid altitude - must be greater than 0');
  }
}
