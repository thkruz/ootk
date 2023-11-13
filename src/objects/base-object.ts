/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The BaseObject class is used for creating core properties and methods applicable
 * to ground and space based objects.
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2023 Theodore Kruczek
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

import { EciVec3, Kilometers, SpaceObjectType } from '../types/types';

interface ObjectInfo {
  name?: string;
  type?: SpaceObjectType;
  position?: EciVec3;
  time?: Date;
}

export class BaseObject {
  name: string;
  type: SpaceObjectType;
  position: EciVec3; // Where is the object
  time: Date; // When is the object

  constructor(info: ObjectInfo) {
    this.type = info.type || SpaceObjectType.UNKNOWN;
    this.name = info.name || 'Unknown';

    this.position = info.position || {
      x: <Kilometers>0,
      y: <Kilometers>0,
      z: <Kilometers>0,
    }; // Default to the center of the earth until position is calculated

    this.time = info.time || new Date();
  }

  getTypeString(): string {
    const typeToStringMap: { [key in SpaceObjectType]?: string } = {
      [SpaceObjectType.UNKNOWN]: 'Unknown',
      [SpaceObjectType.PAYLOAD]: 'Payload',
      [SpaceObjectType.ROCKET_BODY]: 'Rocket Body',
      [SpaceObjectType.DEBRIS]: 'Debris',
      [SpaceObjectType.SPECIAL]: 'Special',
      [SpaceObjectType.RADAR_MEASUREMENT]: 'Radar Measurement',
      [SpaceObjectType.RADAR_TRACK]: 'Radar Track',
      [SpaceObjectType.RADAR_OBJECT]: 'Radar Object',
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

    return typeToStringMap[this.type] || 'Unknown';
  }
}
