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

import { EpochUTC, J2000, Matrix, Vector, Vector3D } from 'ootk-core';
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
import { Propagator } from '../propagator/Propagator';
import { RandomGaussianSource } from './../operations/RandomGaussianSource';
import { PropagatorPairs } from './PropagatorPairs';

// / Base class for observation types.
export abstract class Observation {
  // / Observation epoch.
  abstract get epoch(): EpochUTC;

  // / Inertial observer location.
  abstract get site(): J2000;

  // / Observation noise matrix.
  abstract get noise(): Matrix;

  /**
   * Return range-normalized cross line-of-sight residual for the observation
   * when compared against a nominal state propagator.
   */
  clos(propagator: Propagator): number {
    throw new Error('Not implemented');
  }

  /**
   * Return relative state residual for the observation when compared against
   * a nominal state propagator.
   */
  ricDiff(propagator: Propagator): Vector3D {
    throw new Error('Not implemented');
  }

  // / Convert this observation to vector form.
  toVector(): Vector {
    throw new Error('Not implemented');
  }

  // / Compute the state derivative matrix for this observation.
  jacobian(propPairs: PropagatorPairs): Matrix {
    throw new Error('Not implemented');
  }

  // / Compute the state residual matrix for this observation.
  residual(propagator: Propagator): Matrix {
    throw new Error('Not implemented');
  }

  // / Convert this observation's noise matrix into a covariance matrix.
  noiseCovariance(): Matrix {
    return this.noise.reciprocal();
  }

  _noiseSample(sigma: number): Matrix {
    return this.noiseCovariance().scale(sigma).cholesky();
  }

  /**
   * Randomly sample this observation in vector form within the
   * observation noise.
   */
  sampleVector(random: RandomGaussianSource, sigma: number): Vector {
    const chol = this._noiseSample(sigma);
    const gauss = random.gaussVector(this.noise.columns);
    const meas = this.toVector();

    return meas.add(chol.multiplyVector(gauss));
  }

  /**
   * Randomly sample this observation within the observation noise, scaled to
   * the provided [sigma] value.
   */
  sample(random: RandomGaussianSource, sigma = 1.0): Observation {
    throw new Error('Not implemented');
  }
}
