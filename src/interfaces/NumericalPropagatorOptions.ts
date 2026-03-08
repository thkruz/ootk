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

import type { ForceModel } from '../force/ForceModel';
import type { PropagatorType } from '../enums/PropagatorType';

/**
 * Options for creating a propagator from a Satellite via `createPropagator()`.
 */
export interface NumericalPropagatorOptions {
  /**
   * The propagator type to create. Defaults to PropagatorType.RK89.
   */
  type?: PropagatorType;

  /**
   * The force model for numerical propagators (RK4, DP54, RK89).
   * If not provided, defaults to point-mass gravity.
   * Ignored for SGP4 and KEPLER types.
   */
  forceModel?: ForceModel;

  /**
   * Tolerance for adaptive propagators (DP54, RK89).
   * Smaller values = more accurate but slower.
   * Defaults to 1e-9.
   * Ignored for SGP4, KEPLER, and RK4.
   */
  tolerance?: number;

  /**
   * Fixed step size in seconds for RK4 propagator.
   * Defaults to 15.0 seconds.
   * Ignored for other propagator types.
   */
  stepSize?: number;
}
