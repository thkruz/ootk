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
 * Enum representing available propagator implementations.
 */
export enum PropagatorType {
  /** SGP4/SDP4 analytical propagator (TLE-based). */
  SGP4 = 'SGP4',
  /** Kepler analytical two-body propagator. */
  KEPLER = 'KEPLER',
  /** Runge-Kutta 4th order fixed-step numerical propagator. */
  RK4 = 'RK4',
  /** Dormand-Prince 5(4) adaptive numerical propagator. */
  DP54 = 'DP54',
  /** @deprecated Use DP54 instead. */
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values -- intentional deprecated alias of DP54
  DORMAND_PRINCE = 'DP54',
  /** Runge-Kutta 8(9) adaptive numerical propagator. */
  RK89 = 'RK89',
}
