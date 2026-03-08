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

import { TemeVec3, KilometersPerSecond } from '../types/types';

/**
 * State data that can be recorded in history.
 */
export interface HistoricalState {
  position: TemeVec3;
  velocity: TemeVec3<KilometersPerSecond>;
}

/**
 * Serialized representation of a BaseObject.
 * Used for persistence and data transfer.
 */
export interface SerializedObject {
  /** The class name of the object */
  type: string;
  /** Unique identifier */
  id: number;
  /** Human-readable name */
  name: string;
  /** Additional type-specific data */
  [key: string]: unknown;
}

/**
 * Placeholder interface for sensors (will be defined in Phase 2).
 * This allows SpaceObject and GroundObject to reference sensors
 * without creating circular dependencies.
 */
export interface SensorInterface {
  id: number;
  name: string;
}

/**
 * Placeholder interface for communication devices (will be defined in Phase 3).
 * This allows SpaceObject and GroundObject to reference comm devices
 * without creating circular dependencies.
 */
export interface CommunicationDeviceInterface {
  id: number;
  name: string;
}
