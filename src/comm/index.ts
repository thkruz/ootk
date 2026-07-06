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

// Types and enums
export {
  calculateFspl,
  calculatePropagationDelay,
  CommDeviceType,
  dbmToDbw,
  dbwToDbm,
  dbwToWatts,
  ModulationType,
  SPEED_OF_LIGHT_KM_S,
  wattsToDbw,
} from './CommTypes';
export type {
  CommPlatform,
  Dbm,
  Dbw,
  Decibels,
  Hertz,
  LinkBudget,
  RelayLinkBudget,
  SerializedAntenna,
  SerializedCommDevice,
  Watts,
} from './CommTypes';

// Classes
export { Antenna } from './Antenna';
export type { AntennaParams } from './Antenna';

export { CommunicationDevice } from './CommunicationDevice';
export type { CommunicationDeviceParams } from './CommunicationDevice';

export { Transmitter } from './Transmitter';
export type { TransmitterParams } from './Transmitter';

export { Receiver } from './Receiver';
export type { ReceiverParams } from './Receiver';

export { Transponder } from './Transponder';
export type { TransponderParams } from './Transponder';

export { Beacon } from './Beacon';
export type { BeaconParams } from './Beacon';
