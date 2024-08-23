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

import { DEG2RAD, Degrees, PI, RAD2DEG, Radians } from '../main.js';

/**
 * Converts radians to degrees.
 * @param radians The value in radians to be converted.
 * @returns The value in degrees.
 */
export function rad2deg(radians: Radians): Degrees {
  return <Degrees>((radians * 180) / PI);
}

/**
 * Converts degrees to radians.
 * @param degrees The value in degrees to be converted.
 * @returns The value in radians.
 */
export function deg2rad(degrees: Degrees): Radians {
  return <Radians>((degrees * PI) / 180.0);
}

/**
 * Converts radians to degrees latitude.
 * @param radians The radians value to convert.
 * @returns The corresponding degrees latitude.
 * @throws RangeError if the radians value is outside the range [-PI/2; PI/2].
 */
export function getDegLat(radians: Radians): Degrees {
  if (radians < -PI / 2 || radians > PI / 2) {
    throw new RangeError('Latitude radians must be in range [-PI/2; PI/2].');
  }

  return (radians * RAD2DEG) as Degrees;
}

/**
 * Converts radians to degrees for longitude.
 * @param radians The value in radians to be converted.
 * @returns The converted value in degrees.
 * @throws {RangeError} If the input radians is not within the range [-PI; PI].
 */
export function getDegLon(radians: Radians): Degrees {
  if (radians < -PI || radians > PI) {
    throw new RangeError('Longitude radians must be in range [-PI; PI].');
  }

  return (radians * RAD2DEG) as Degrees;
}

/**
 * Converts degrees to radians for latitude.
 * @param degrees The degrees value to convert.
 * @returns The equivalent radians value.
 * @throws {RangeError} If the degrees value is not within the range [-90, 90].
 */
export function getRadLat(degrees: Degrees): Radians {
  if (degrees < -90 || degrees > 90) {
    throw new RangeError('Latitude degrees must be in range [-90; 90].');
  }

  return (degrees * DEG2RAD) as Radians;
}

/**
 * Converts degrees to radians.
 * @param degrees The value in degrees to be converted.
 * @returns The value in radians.
 * @throws {RangeError} If the input degrees are not within the range [-180; 180].
 */
export function getRadLon(degrees: Degrees): Radians {
  if (degrees < -180 || degrees > 180) {
    throw new RangeError('Longitude degrees must be in range [-180; 180].');
  }

  return (degrees * DEG2RAD) as Radians;
}
