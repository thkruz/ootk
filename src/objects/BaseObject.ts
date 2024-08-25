/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
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

import { BaseObjectParams } from '../interfaces/BaseObjectParams.js';
import { EciVec3, Kilometers, SpaceObjectType } from '../types/types.js';

export class BaseObject {
  id: number;
  name: string;
  type: SpaceObjectType;
  position: EciVec3; // Where is the object
  totalVelocity: number; // How fast is the object moving
  velocity: EciVec3; // How fast is the object moving
  active = true; // Is the object active

  constructor(info: BaseObjectParams) {
    this.type = info.type ?? SpaceObjectType.UNKNOWN;
    this.name = info.name ?? 'Unknown';
    this.id = info.id ?? -1; // Default to -1 if no id is provided
    this.active = info.active ?? true;

    // Default to the center of the earth until position is calculated
    this.position = info.position ?? {
      x: <Kilometers>0,
      y: <Kilometers>0,
      z: <Kilometers>0,
    };

    // Default to 0 velocity until velocity is calculated
    this.velocity = info.velocity ?? {
      x: <Kilometers>0,
      y: <Kilometers>0,
      z: <Kilometers>0,
    };
    this.totalVelocity = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2 + this.velocity.z ** 2);
  }

  /**
   * Checks if the object is a satellite.
   * @returns True if the object is a satellite, false otherwise.
   */
  isSatellite(): boolean {
    return false;
  }

  /**
   * Checks if the object is a ground object.
   * @returns True if the object is a ground object, false otherwise.
   */
  isGroundObject(): boolean {
    return false;
  }

  /**
   * Returns whether the object is a sensor.
   * @returns True if the object is a sensor, false otherwise.
   */
  isSensor(): boolean {
    return false;
  }

  /**
   * Checks if the object is a marker.
   * @returns True if the object is a marker, false otherwise.
   */
  isMarker(): boolean {
    return false;
  }

  /**
   * Returns whether the object's position is static.
   * @returns True if the object is static, false otherwise.
   */
  isStatic(): boolean {
    return this.velocity.x === 0 && this.velocity.y === 0 && this.velocity.z === 0;
  }

  isPayload(): boolean {
    return this.type === SpaceObjectType.PAYLOAD;
  }

  isRocketBody(): boolean {
    return this.type === SpaceObjectType.ROCKET_BODY;
  }

  isDebris(): boolean {
    return this.type === SpaceObjectType.DEBRIS;
  }

  isStar(): boolean {
    return this.type === SpaceObjectType.STAR;
  }

  isMissile(): boolean {
    return this.type === SpaceObjectType.BALLISTIC_MISSILE;
  }

  isNotional(): boolean {
    return this.type === SpaceObjectType.NOTIONAL;
  }

  getTypeString(): string {
    const typeToStringMap: { [key in SpaceObjectType]?: string } = {
      [SpaceObjectType.UNKNOWN]: 'Unknown',
      [SpaceObjectType.PAYLOAD]: 'Payload',
      [SpaceObjectType.ROCKET_BODY]: 'Rocket Body',
      [SpaceObjectType.DEBRIS]: 'Debris',
      [SpaceObjectType.SPECIAL]: 'Special',
      [SpaceObjectType.BALLISTIC_MISSILE]: 'Ballistic Missile',
      [SpaceObjectType.STAR]: 'Star',
      [SpaceObjectType.INTERGOVERNMENTAL_ORGANIZATION]: 'Intergovernmental Organization',
      [SpaceObjectType.SUBORBITAL_PAYLOAD_OPERATOR]: 'Suborbital Payload Operator',
      [SpaceObjectType.PAYLOAD_OWNER]: 'Payload Owner',
      [SpaceObjectType.METEOROLOGICAL_ROCKET_LAUNCH_AGENCY_OR_MANUFACTURER]:
        'Meteorological Rocket Launch Agency or Manufacturer',
      [SpaceObjectType.PAYLOAD_MANUFACTURER]: 'Payload Manufacturer',
      [SpaceObjectType.LAUNCH_AGENCY]: 'Launch Agency',
      [SpaceObjectType.LAUNCH_SITE]: 'Launch Site',
      [SpaceObjectType.LAUNCH_POSITION]: 'Launch Position',
      [SpaceObjectType.LAUNCH_FACILITY]: 'Launch Facility',
      [SpaceObjectType.CONTROL_FACILITY]: 'Control Facility',
      [SpaceObjectType.GROUND_SENSOR_STATION]: 'Ground Sensor Station',
      [SpaceObjectType.OPTICAL]: 'Optical',
      [SpaceObjectType.MECHANICAL]: 'Mechanical',
      [SpaceObjectType.PHASED_ARRAY_RADAR]: 'Phased Array Radar',
      [SpaceObjectType.OBSERVER]: 'Observer',
      [SpaceObjectType.BISTATIC_RADIO_TELESCOPE]: 'Bistatic Radio Telescope',
      [SpaceObjectType.COUNTRY]: 'Country',
      [SpaceObjectType.LAUNCH_VEHICLE_MANUFACTURER]: 'Launch Vehicle Manufacturer',
      [SpaceObjectType.ENGINE_MANUFACTURER]: 'Engine Manufacturer',
    };

    return typeToStringMap[this.type] ?? 'Unknown';
  }

  /**
   * Validates a parameter value against a minimum and maximum value.
   * @param value - The value to be validated.
   * @param minValue - The minimum allowed value.
   * @param maxValue - The maximum allowed value.
   * @param errorMessage - The error message to be thrown if the value is invalid.
   */
  validateParameter<T>(value: T, minValue: T, maxValue: T, errorMessage: string): void {
    if (typeof minValue !== 'undefined' && minValue !== null && (value as number) < (minValue as number)) {
      throw new Error(errorMessage);
    }
    if (typeof maxValue !== 'undefined' && maxValue !== null && (value as number) > (maxValue as number)) {
      throw new Error(errorMessage);
    }
  }
}
