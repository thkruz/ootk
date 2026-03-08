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

/**
 * Enum representing different types of sensors.
 */
export enum SensorType {
  /** Optical/visual sensor (telescope, camera) */
  OPTICAL = 'OPTICAL',
  /** Mechanical tracking radar (dish-based) */
  MECHANICAL_RADAR = 'MECHANICAL_RADAR',
  /** Phased array radar (electronic beam steering) */
  PHASED_ARRAY_RADAR = 'PHASED_ARRAY_RADAR',
  /** Laser ranging sensor (SLR - Satellite Laser Ranging) */
  LASER_RANGING = 'LASER_RANGING',
  /** Passive RF sensor (SIGINT, no transmission) */
  PASSIVE_RF = 'PASSIVE_RF',
  /** Bistatic radio telescope */
  BISTATIC_RADIO_TELESCOPE = 'BISTATIC_RADIO_TELESCOPE',
}
