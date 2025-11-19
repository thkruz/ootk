/**
 * @author @thkruz/ootk
 * @license AGPL-3.0-or-later
 * @copyright (c) 2024 Theodore Kruczek
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

import { Decibels, Degrees, Gigahertz } from '../types/types.js';
import { FrequencyBand } from '../enums/FrequencyBand.js';
import { PolarizationType } from '../enums/PolarizationType.js';

/**
 * Parameters for defining antenna characteristics.
 */
export interface AntennaParams {
  /** Antenna gain in dBi (decibels relative to isotropic) */
  gain: Decibels;
  /** Antenna diameter in meters (optional, for parabolic antennas) */
  diameter?: number;
  /** Operating frequency in GHz */
  frequency: Gigahertz;
  /** Frequency band */
  band?: FrequencyBand;
  /** Polarization type */
  polarization?: PolarizationType;
  /** Antenna efficiency (0-1) */
  efficiency?: number;
  /** Beamwidth in degrees (3dB beamwidth) */
  beamwidth?: Degrees;
  /** Pointing loss in dB */
  pointingLoss?: Decibels;
}
