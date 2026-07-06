/**
 * @author @thkruz Theodore Kruczek
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
 * Represents the illumination status of a satellite relative to the Sun.
 *
 * This enum is used to indicate whether a satellite is in sunlight, in Earth's
 * shadow (eclipse), or in an unknown state.
 */
export enum SunStatus {
  /** Unknown illumination state - typically when position data is unavailable */
  UNKNOWN = -1,
  /** Satellite is in Earth's umbral shadow (full eclipse - no direct sunlight) */
  UMBRAL = 0,
  /** Satellite is in Earth's penumbral shadow (partial eclipse - partial sunlight) */
  PENUMBRAL = 1,
  /** Satellite is fully illuminated by the Sun */
  SUN = 2,
}
