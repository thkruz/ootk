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

import { EpochUTC } from '../time/EpochUTC';
import { J2000 } from '../coordinate/J2000';


import { Interpolator } from './Interpolator';

// / Base class for state vector interpolators.
export abstract class StateInterpolator extends Interpolator {
  /**
   * Interpolates the state at the given epoch.
   * @param epoch The epoch in UTC format.
   * @throws If the interpolator has not been initialized.
   */
  abstract interpolate(epoch: EpochUTC): J2000 | null;

  // / Return the size _(bytes)_ of this interpolator's cached data.
  get sizeBytes(): number {
    throw new Error('Not implemented.');
  }
}
