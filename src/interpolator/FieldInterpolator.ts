/**
 * @author @thkruz Theodore Kruczek
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2024 Theodore Kruczek
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

import { Interpolator } from './Interpolator';

// / Base class for arbitrary field interpolators.
export abstract class FieldInterpolator extends Interpolator {
  Float64List?;

  /**
   * Interpolate field values at the provided [epoch].
   * @returns Returns `null` if the epoch is outside the cached field range.
   */
  interpolate(final, EpochUTC, epoch) {
    throw new Error('Method not implemented.');
  }
}
