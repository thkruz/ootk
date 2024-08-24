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

import { Earth } from '../body/Earth.js';
import { AngularDistanceMethod, Degrees, Kilometers, KilometersPerSecond, Radians } from '../main.js';
import { Vector3D } from '../operations/Vector3D.js';
import { EpochUTC } from '../time/EpochUTC.js';
import { DEG2RAD, RAD2DEG } from '../utils/constants.js';
import { angularDistance } from '../utils/functions.js';
import { ITRF } from './ITRF.js';

/**
 * This Geodetic class represents a geodetic coordinate in three-dimensional
 * space, consisting of latitude, longitude, and altitude. It provides various
 * methods to perform calculations and operations related to geodetic
 * coordinates.
 *
 * This is a class for geodetic coordinates. This is related to the GroundObject
 * class, which is used to represent an object on the surface of the Earth.
 */
export class Geodetic {
  lat: Radians;
  lon: Radians;
  alt: Kilometers;

  constructor(latitude: Radians, longitude: Radians, altitude: Kilometers) {
    if (Math.abs(latitude) > Math.PI / 2) {
      throw new RangeError('Latitude must be between -90° and 90° in Radians.');
    }

    if (Math.abs(longitude) > Math.PI) {
      throw new RangeError('Longitude must be between -180° and 180° in Radians.');
    }

    if (altitude < -Earth.radiusMean) {
      throw new RangeError(`Altitude must be greater than ${-Earth.radiusMean} km. Got ${altitude} km.`);
    }

    this.lat = latitude;
    this.lon = longitude;
    this.alt = altitude;
  }

  /**
   * Creates a Geodetic object from latitude, longitude, and altitude values in
   * degrees.
   * @param latitude The latitude value in degrees.
   * @param longitude The longitude value in degrees.
   * @param altitude The altitude value in kilometers.
   * @returns A Geodetic object representing the specified latitude, longitude,
   * and altitude.
   */
  static fromDegrees(latitude: Degrees, longitude: Degrees, altitude: Kilometers): Geodetic {
    return new Geodetic((latitude * DEG2RAD) as Radians, (longitude * DEG2RAD) as Radians, altitude);
  }

  /**
   * Returns a string representation of the Geodetic object.
   * @returns A string containing the latitude, longitude, and altitude of the Geodetic object.
   */
  toString(): string {
    return [
      'Geodetic',
      `  Latitude:  ${this.latDeg.toFixed(4)}°`,
      `  Longitude: ${this.lonDeg.toFixed(4)}°`,
      `  Altitude:  ${this.alt.toFixed(3)} km`,
    ].join('\n');
  }

  /**
   * Gets the latitude in degrees.
   * @returns The latitude in degrees.
   */
  get latDeg(): number {
    return this.lat * RAD2DEG;
  }

  /**
   * Gets the longitude in degrees.
   * @returns The longitude in degrees.
   */
  get lonDeg(): number {
    return this.lon * RAD2DEG;
  }

  /**
   * Converts the geodetic coordinates to the International Terrestrial
   * Reference Frame (ITRF) coordinates.
   * @param epoch The epoch in UTC.
   * @returns The ITRF coordinates.
   */
  toITRF(epoch: EpochUTC): ITRF {
    const sLat = Math.sin(this.lat);
    const cLat = Math.cos(this.lat);
    const nVal = Earth.radiusEquator / Math.sqrt(1 - Earth.eccentricitySquared * sLat * sLat);
    const r = new Vector3D<Kilometers>(
      ((nVal + this.alt) * cLat * Math.cos(this.lon)) as Kilometers,
      ((nVal + this.alt) * cLat * Math.sin(this.lon)) as Kilometers,
      ((nVal * (1 - Earth.eccentricitySquared) + this.alt) * sLat) as Kilometers,
    );

    return new ITRF(epoch, r, Vector3D.origin as Vector3D<KilometersPerSecond>);
  }

  /**
   * Calculates the angle between two geodetic coordinates.
   * @param g The geodetic coordinate to calculate the angle to.
   * @param method The method to use for calculating the angular distance (optional, default is Haversine).
   * @returns The angle between the two geodetic coordinates in radians.
   */
  angle(g: Geodetic, method: AngularDistanceMethod = AngularDistanceMethod.Haversine): Radians {
    return angularDistance(this.lon, this.lat, g.lon, g.lat, method) as Radians;
  }

  /**
   * Calculates the angle in degrees between two Geodetic coordinates.
   * @param g The Geodetic coordinate to calculate the angle with.
   * @param method The method to use for calculating the angular distance (optional, default is Haversine).
   * @returns The angle in degrees.
   */
  angleDeg(g: Geodetic, method: AngularDistanceMethod = AngularDistanceMethod.Haversine): Degrees {
    return (this.angle(g, method) * RAD2DEG) as Degrees;
  }

  /**
   * Calculates the distance between two geodetic coordinates.
   * @param g The geodetic coordinates to calculate the distance to.
   * @param method The method to use for calculating the angular distance. Default is Haversine.
   * @returns The distance between the two geodetic coordinates in kilometers.
   */
  distance(g: Geodetic, method: AngularDistanceMethod = AngularDistanceMethod.Haversine): Kilometers {
    return (this.angle(g, method) * Earth.radiusMean) as Kilometers;
  }

  /**
   * Calculates the field of view based on the altitude of the Geodetic object.
   * @returns The field of view in radians.
   */
  fieldOfView(): Radians {
    return Math.acos(Earth.radiusMean / (Earth.radiusMean + this.alt)) as Radians;
  }

  /**
   * Determines if the current geodetic coordinate can see another geodetic coordinate.
   * @param g The geodetic coordinate to check for visibility.
   * @param method The method to use for calculating the angular distance (optional, default is Haversine).
   * @returns A boolean indicating if the current coordinate can see the other coordinate.
   */
  isInView(g: Geodetic, method: AngularDistanceMethod = AngularDistanceMethod.Haversine): boolean {
    const fov = Math.max(this.fieldOfView(), g.fieldOfView());

    return this.angle(g, method) <= fov;
  }
}
