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

import { Matrix, Vector } from '../main.js';

/** Covariance Frame */
export enum CovarianceFrame {
  /** Earth-centered inertial */
  ECI = 'eci',
  /** Radial-Intrack-Crosstrack */
  RIC = 'ric',
}

// / State covariance.
export class StateCovariance {
  /**
   * Create a new [StateCovariance] object given its covariance [matrix] and
   * [CovarianceFrame].
   * @param matrix The covariance matrix.
   * @param frame The covariance frame.
   * @returns A new [StateCovariance] object.
   */
  constructor(public matrix: Matrix, public frame: CovarianceFrame) {
    // Nothing to do here.
  }

  // / Create a new [StateCovariance] object from 1-sigma values.
  static fromSigmas(sigmas: number[], frame: CovarianceFrame): StateCovariance {
    const n = sigmas.length;
    const output = Matrix.zero(n, n);

    for (let i = 0; i < n; i++) {
      output.elements[i][i] = Math.max(sigmas[i] * sigmas[i], 1e-32);
    }

    return new StateCovariance(output, frame);
  }

  /**
   * Calculates the standard deviations (sigmas) of each element in the covariance matrix.
   * @returns A vector containing the standard deviations of each element in the covariance matrix.
   */
  sigmas(): Vector {
    const c = this.matrix.columns;
    const result = new Float64Array(c);

    for (let i = 0; i < c; i++) {
      const variance = this.matrix.elements[i][i];

      result[i] = Math.sqrt(variance);
    }

    return new Vector(result);
  }
}
