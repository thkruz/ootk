/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2024 Theodore Kruczek Permission is
 * hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {
  GroundPositionParams,
  Degrees,
  EcfVec3,
  EciVec3,
  Kilometers,
  LlaVec3,
  Radians,
  RaeVec3,
  calcGmst,
  lla2eci,
  llaRad2ecf,
  DEG2RAD,
  Geodetic,
  BaseObjectParams,
  SpaceObjectType,
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
