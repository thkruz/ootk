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
  public name: string;
  public type: SpaceObjectType;
  public position: EciVec3; // Where is the object
  public time: Date; // When is the object

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

  public getName(): string {
    return this.name;
  }

  public getType(): SpaceObjectType {
    return this.type;
  }

  // eslint-disable-next-line complexity
  public getTypeString(): string {
    switch (this.type) {
      case SpaceObjectType.UNKNOWN:
        return 'Unknown';
      case SpaceObjectType.PAYLOAD:
        return 'Payload';
      case SpaceObjectType.ROCKET_BODY:
        return 'Rocket Body';
      case SpaceObjectType.DEBRIS:
        return 'Debris';
      case SpaceObjectType.SPECIAL:
        return 'Special';
      case SpaceObjectType.RADAR_MEASUREMENT:
        return 'Radar Measurement';
      case SpaceObjectType.RADAR_TRACK:
        return 'Radar Track';
      case SpaceObjectType.RADAR_OBJECT:
        return 'Radar Object';
      case SpaceObjectType.BALLISTIC_MISSILE:
        return 'Ballistic Missile';
      case SpaceObjectType.STAR:
        return 'Star';
      case SpaceObjectType.INTERGOVERNMENTAL_ORGANIZATION:
        return 'Intergovernmental Organization';
      case SpaceObjectType.SUBORBITAL_PAYLOAD_OPERATOR:
        return 'Suborbital Payload Operator';
      case SpaceObjectType.PAYLOAD_OWNER:
        return 'Payload Owner';
      case SpaceObjectType.METEOROLOGICAL_ROCKET_LAUNCH_AGENCY_OR_MANUFACTURER:
        return 'Meteorological Rocket Launch Agency or Manufacturer';
      case SpaceObjectType.PAYLOAD_MANUFACTURER:
        return 'Payload Manufacturer';
      case SpaceObjectType.LAUNCH_AGENCY:
        return 'Launch Agency';
      case SpaceObjectType.LAUNCH_SITE:
        return 'Launch Site';
      case SpaceObjectType.LAUNCH_POSITION:
        return 'Launch Position';
      case SpaceObjectType.LAUNCH_FACILITY:
        return 'Launch Facility';
      case SpaceObjectType.CONTROL_FACILITY:
        return 'Control Facility';
      case SpaceObjectType.GROUND_SENSOR_STATION:
        return 'Ground Sensor Station';
      case SpaceObjectType.OPTICAL:
        return 'Optical';
      case SpaceObjectType.MECHANICAL:
        return 'Mechanical';
      case SpaceObjectType.PHASED_ARRAY_RADAR:
        return 'Phased Array Radar';
      case SpaceObjectType.OBSERVER:
        return 'Observer';
      case SpaceObjectType.BISTATIC_RADIO_TELESCOPE:
        return 'Bistatic Radio Telescope';
      case SpaceObjectType.COUNTRY:
        return 'Country';
      case SpaceObjectType.LAUNCH_VEHICLE_MANUFACTURER:
        return 'Launch Vehicle Manufacturer';
      case SpaceObjectType.ENGINE_MANUFACTURER:
        return 'Engine Manufacturer';
      default:
        return 'Unknown';
    }
  }
}
