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

import { BitsPerSecond, Decibels, Gigahertz, Kilometers } from '../types/types.js';
import { TransmitterParams } from './TransmitterParams.js';
import { ReceiverParams } from './ReceiverParams.js';

/**
 * Parameters for link budget calculations.
 */
export interface LinkBudgetParams {
  /** Transmitter configuration */
  transmitter: TransmitterParams;
  /** Receiver configuration */
  receiver: ReceiverParams;
  /** Link range/distance in kilometers */
  range: Kilometers;
  /** Operating frequency in GHz */
  frequency: Gigahertz;
  /** Data rate in bits per second */
  dataRate?: BitsPerSecond;
  /** Required energy per bit to noise density ratio (Eb/N0) in dB */
  requiredEbN0?: Decibels;
  /** Atmospheric losses in dB */
  atmosphericLoss?: Decibels;
  /** Rain attenuation in dB */
  rainLoss?: Decibels;
  /** Ionospheric losses in dB */
  ionosphericLoss?: Decibels;
  /** Polarization mismatch loss in dB */
  polarizationLoss?: Decibels;
  /** Additional margin in dB */
  additionalMargin?: Decibels;
}
