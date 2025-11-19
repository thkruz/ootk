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

import { RfSensorParams } from './RfSensorParams.js';
import { TransmitterParams } from './TransmitterParams.js';
import { ReceiverParams } from './ReceiverParams.js';

/**
 * Parameters for defining ground station characteristics.
 * Extends RfSensorParams to include transmitter and receiver capabilities.
 */
export interface GroundStationParams extends RfSensorParams {
  /** Transmitter configuration (optional, receive-only stations don't need this) */
  transmitter?: TransmitterParams;
  /** Receiver configuration (optional, transmit-only stations don't need this) */
  receiver?: ReceiverParams;
  /** Minimum elevation angle for operations in degrees */
  minOperatingElevation?: number;
  /** Maximum range in kilometers */
  maxRange?: number;
}
