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

import { EpochUTC, J2000, Matrix, Vector, Vector3D } from '../main.js';
import { Propagator } from '../propagator/Propagator.js';
import { RandomGaussianSource } from './../operations/RandomGaussianSource.js';
import { PropagatorPairs } from './PropagatorPairs.js';

/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Observation data.
 */
export abstract class Observation {
  /** Observation epoch. */
  abstract get epoch(): EpochUTC;

  /** Inertial observer location. */
  abstract get site(): J2000;

  /** Observation noise matrix. */
  abstract get noise(): Matrix;

  /**
   * Return range-normalized cross line-of-sight residual for the observation
   * when compared against a nominal state propagator.
   * @param propagator Propagator to compare against.
   * @throws Not implemented.
   */
  clos(propagator: Propagator): number {
    throw new Error('Not implemented');
  }

  /**
   * Return relative state residual for the observation when compared against
   * a nominal state propagator.
   * @param propagator Propagator to compare against.
   * @throws Not implemented.
   */
  ricDiff(propagator: Propagator): Vector3D {
    throw new Error('Not implemented');
  }

  /**
   * Convert this observation to vector form.
   * @throws Not implemented.
   */
  toVector(): Vector {
    throw new Error('Not implemented');
  }

  /**
   * Compute the state derivative matrix for this observation.
   * @param propPairs Propagator pairs to compare against.
   * @throws Not implemented.
   */
  jacobian(propPairs: PropagatorPairs): Matrix {
    throw new Error('Not implemented');
  }

  /**
   * Compute the state residual matrix for this observation.
   * @param propagator Propagator to compare against.
   * @throws Not implemented.
   */
  residual(propagator: Propagator): Matrix {
    throw new Error('Not implemented');
  }

  /**
   * Convert this observation's noise matrix into a covariance matrix.
   * @returns A matrix representing the noise covariance.
   */
  noiseCovariance(): Matrix {
    return this.noise.reciprocal();
  }

  /**
   * Generates a noise sample from the noise covariance matrix.
   * @param sigma - The scaling factor for the noise covariance matrix.
   * @returns A matrix representing the noise sample.
   */
  noiseSample_(sigma: number): Matrix {
    return this.noiseCovariance().scale(sigma).cholesky();
  }

  /**
   * Randomly sample this observation in vector form within the
   * observation noise.
   * @param random Random number generator.
   * @param sigma Sigma value to scale the noise by.
   * @returns Sampled observation.
   */
  sampleVector(random: RandomGaussianSource, sigma: number): Vector {
    const chol = this.noiseSample_(sigma);
    const gauss = random.gaussVector(this.noise.columns);
    const meas = this.toVector();

    return meas.add(chol.multiplyVector(gauss));
  }

  /**
   * Randomly sample this observation within the observation noise, scaled to
   * the provided sigma value.
   * @param random Random number generator.
   * @param sigma Sigma value to scale the noise by.
   * @throws Not implemented.
   */
  sample(random: RandomGaussianSource, sigma = 1.0): Observation {
    throw new Error('Not implemented');
  }
}
