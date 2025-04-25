/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
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

import { J2000 } from '../main.js';
import { StateCovariance } from './../covariance/StateCovariance.js';

// / Batch least squares orbit determination result.
export class BatchLeastSquaresResult {
  /**
   * Create a new [BatchLeastSquaresResult] object, containing the solved
   * [state], [covariance], and root-mean-squared error [rms].
   * @param state The solved state.
   * @param covariance The solved covariance.
   * @param rms The root-mean-squared error.
   */
  constructor(public state: J2000, public covariance: StateCovariance, public rms: number) {
    // Nothing to do here.
  }
}
