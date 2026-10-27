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

import { StateCovariance } from '../covariance/StateCovariance';
import { J2000 } from '../coordinate/J2000';

// / Batch least squares orbit determination result.
export class BatchLeastSquaresResult {
  /**
   * Create a new [BatchLeastSquaresResult] object, containing the solved
   * [state], [covariance], noise-weighted root-mean-squared residual [rms], and
   * whether the solve [converged].
   * @param state The solved state.
   * @param covariance The solved covariance (inverse of A^T W A at [state]).
   * @param rms The noise-weighted RMS of the residuals at [state] (about 1 for a fit at the noise floor).
   * @param converged True only if the RMS tolerance was met before `maxIter` was exhausted.
   */
  constructor(
    public state: J2000,
    public covariance: StateCovariance,
    public rms: number,
    public converged: boolean = false,
  ) {
    // Nothing to do here.
  }
}
