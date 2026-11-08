/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
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

import { ValidationError } from '../../errors';
import { Degrees, Kilometers } from '../../types/types';

/** Offset between the 0 degC isotherm height and the rain height in ITU-R P.839-4 (km). */
export const P839_RAIN_HEIGHT_OFFSET_KM = 0.36;

/**
 * Rain height from the mean annual 0 degC isotherm height, ITU-R P.839-4 (09/2013): h_R = h_0 + 0.36 km.
 *
 * P.839-4 gives h_0 only as a digital map (1.5 degree grid), which this library does not bundle. Read h_0 for the
 * station from that map and pass it here, or use {@link rainHeightFromLatitude} for a rough map-free estimate.
 * @param isothermHeight - Mean annual 0 degC isotherm height above mean sea level, h_0 (km)
 * @returns Rain height above mean sea level, h_R (km)
 * @throws {ValidationError} If the height is non-finite or negative
 */
export const rainHeightFromIsotherm = (isothermHeight: Kilometers): Kilometers => {
  if (!Number.isFinite(isothermHeight) || isothermHeight < 0) {
    throw new ValidationError('0 degC isotherm height must be a non-negative number of km', 'isothermHeight', isothermHeight);
  }

  return (isothermHeight + P839_RAIN_HEIGHT_OFFSET_KM) as Kilometers;
};

/**
 * Map-free rain height estimate from station latitude, the model of ITU-R P.839-2 (10/1999), which was superseded
 * by the map in P.839-3 and P.839-4. With latitude phi in degrees:
 *
 * - phi > 23 (north): h_R = 5.0 - 0.075 (phi - 23)
 * - 0 <= phi <= 23: h_R = 5.0
 * - -21 <= phi < 0: h_R = 5.0
 * - -71 <= phi < -21: h_R = 5.0 + 0.1 (phi + 21)
 * - phi < -71: h_R = 0
 *
 * This is a ROUGH default. Against the P.839-4 map (h_0 + 0.36 km) at the eight sites of the ITU-R SG3 validation
 * spreadsheet it is off by -0.7 to +1.6 km (see the unit tests); that changes rain attenuation a lot in the subtropics
 * and the Mediterranean. Prefer {@link rainHeightFromIsotherm} with a map value whenever one is available.
 * @param latitude - Station latitude (deg), -90 to 90
 * @returns Rain height above mean sea level (km), never negative
 * @throws {ValidationError} If the latitude is outside -90 to 90
 */
export const rainHeightFromLatitude = (latitude: Degrees): Kilometers => {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) {
    throw new ValidationError('Latitude must be between -90 and 90 degrees', 'latitude', latitude);
  }

  let height: number;

  if (latitude > 23) {
    height = 5.0 - 0.075 * (latitude - 23);
  } else if (latitude >= -21) {
    height = 5.0;
  } else if (latitude >= -71) {
    height = 5.0 + 0.1 * (latitude + 21);
  } else {
    height = 0;
  }

  return Math.max(0, height) as Kilometers;
};
