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

import {
  BaseObjectParams,
  DEG2RAD,
  Degrees,
  EcfVec3,
  EciVec3,
  Geodetic,
  GroundPositionParams,
  Kilometers,
  LlaVec3,
  Radians,
  RaeVec3,
  SpaceObjectType,
  calcGmst,
  lla2eci,
  llaRad2ecf,
} from '../main.js';

import { BaseObject } from './BaseObject.js';
import { Satellite } from './Satellite.js';

export class GroundObject extends BaseObject {
  name = 'Unknown Ground Object';
  lat: Degrees;
  lon: Degrees;
  alt: Kilometers;

  constructor(info: GroundPositionParams & BaseObjectParams) {
    super(info);

    this.validateGroundObjectInputData_(info);
    this.name = info.name ?? this.name;
    this.lat = info.lat;
    this.lon = info.lon;
    this.alt = info.alt;
  }

  /**
   * Calculates the relative azimuth, elevation, and range between this GroundObject and a Satellite.
   * @param satellite The Satellite object.
   * @param date The date for which to calculate the RAE values. Defaults to the current date.
   * @returns The relative azimuth, elevation, and range values in kilometers and degrees.
   */
  rae(satellite: Satellite, date: Date = new Date()): RaeVec3<Kilometers, Degrees> {
    return satellite.rae(this, date);
  }

  /**
   * Calculates ECF position at a given time.
   * @variation optimized version of this.toGeodetic().toITRF().position;
   * @returns The ECF position vector of the ground object.
   */
  ecf(): EcfVec3<Kilometers> {
    return llaRad2ecf(this.toGeodetic());
  }

  /**
   * Calculates the Earth-Centered Inertial (ECI) position vector of the ground object at a given date.
   * @variation optimzed version of this.toGeodetic().toITRF().toJ2000().position;
   * @param date The date for which to calculate the ECI position vector. Defaults to the current date.
   * @returns The ECI position vector of the ground object.
   */
  eci(date: Date = new Date()): EciVec3<Kilometers> {
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
   * @returns An object containing the latitude, longitude, and altitude in
   * radians and kilometers.
   */
  llaRad(): LlaVec3<Radians, Kilometers> {
    return {
      lat: (this.lat * DEG2RAD) as Radians,
      lon: (this.lon * DEG2RAD) as Radians,
      alt: this.alt,
    };
  }

  get latRad(): Radians {
    return this.lat * DEG2RAD as Radians;
  }

  get lonRad(): Radians {
    return this.lon * DEG2RAD as Radians;
  }

  /**
   * Creates a GroundObject object from a Geodetic position.
   * @param geodetic The geodetic coordinates.
   * @returns A new GroundObject object.
   */
  static fromGeodetic(geodetic: Geodetic): GroundObject {
    return new GroundObject({
      lat: geodetic.latDeg as Degrees,
      lon: geodetic.lonDeg as Degrees,
      alt: geodetic.alt,
    });
  }

  /**
   * Converts the ground position to geodetic coordinates.
   * @returns The geodetic coordinates.
   */
  toGeodetic(): Geodetic {
    return Geodetic.fromDegrees(this.lat, this.lon, this.alt);
  }

  /**
   * Validates the input data for the GroundObject.
   * @param info - The GroundPositionParams object containing the latitude,
   * longitude, and altitude. @returns void
   */
  private validateGroundObjectInputData_(info: GroundPositionParams) {
    this.validateParameter(info.lat, -90, 90, 'Invalid latitude - must be between -90 and 90');
    this.validateParameter(info.lon, -180, 180, 'Invalid longitude - must be between -180 and 180');
    this.validateParameter(info.alt, 0, null, 'Invalid altitude - must be greater than 0');
  }

  isGroundObject(): boolean {
    switch (this.type) {
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
        return true;
      default:
        return false;
    }
  }
}
