/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
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

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */

import { Interpolator } from './Interpolator.js';

// / Base class for arbitrary field interpolators.
export abstract class FieldInterpolator extends Interpolator {
  Float64List?: Float64Array;

  /**
   * Interpolate field values at the provided [epoch].
   * @param final Final state vector.
   * @param EpochUTC Epoch of the final state vector.
   * @param epoch Epoch to interpolate field values at.
   * @throws [Error] if the interpolator is not initialized.
   */
  interpolate(final: unknown, EpochUTC: unknown, epoch: unknown) {
    throw new Error('Method not implemented.');
  }
}
