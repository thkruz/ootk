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

import { Degrees, Geodetic, GroundObject } from '../../main.js';

export class MarkerAdv extends GroundObject {
  /**
   * Creates a Facility object from a Geodetic position.
   * @param name The name of the Facility.
   * @param geodetic The geodetic coordinates.
   * @returns A new Facility object.
   */
  static fromGeodetic(name: string, geodetic: Geodetic): GroundObject {
    return new MarkerAdv({
      name,
      lat: geodetic.latDeg as Degrees,
      lon: geodetic.lonDeg as Degrees,
      alt: geodetic.alt,
    });
  }

  // Static fromJSON method
  static fromJSON(json: string): GroundObject {
    const data = JSON.parse(json);


    return new MarkerAdv({
      id: data.id,
      name: data.name,
      shortDescription: data.shortDescription,
      longDescription: data.longDescription,
      lat: data.latitude,
      lon: data.longitude,
      alt: data.altitude,
      altRef: data.altitudeReference,
    });
  }
}
