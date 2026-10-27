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
import { Matrix } from '../operations/Matrix';
import { Vector } from '../operations/Vector';
import { Vector3D } from '../operations/Vector3D';
import { Propagator } from '../propagator/Propagator';
import { RandomGaussianSource } from './../operations/RandomGaussianSource';
import { PropagatorPairs } from './PropagatorPairs';


/**
 * Observation data.
 */
export abstract class Observation {
  /** Observation epoch. */
  abstract get epoch(): EpochUTC;

  /** Inertial observer location. */
  abstract get site(): J2000;

  /**
   * Observation noise matrix: the weight (information) matrix, the inverse of the measurement
   * noise covariance. For independent measurements it is diag(1 / sigma_i^2).
   */
  abstract get noise(): Matrix;

  /**
   * Cross line-of-sight residual (km): the chord 2 rho sin(theta / 2) between the observed line
   * of sight and the line of sight to the propagated state, where theta is the angle between
   * them and rho the predicted slant range. Range errors along the line of sight do not count.
   * @param propagator Propagator to compare against.
   * @returns The cross line-of-sight distance in km.
   */
  abstract clos(propagator: Propagator): number;

  /**
   * Return relative state residual for the observation when compared against
   * a nominal state propagator.
   * @param propagator Propagator to compare against.
   * @throws Not implemented.
   */
  abstract ricDiff(propagator: Propagator): Vector3D;

  /**
   * Convert this observation to vector form.
   * @throws Not implemented.
   */
  abstract toVector(): Vector;

  /**
   * Compute the state derivative matrix for this observation.
   * @param propPairs Propagator pairs to compare against.
   * @throws Not implemented.
   */
  abstract jacobian(propPairs: PropagatorPairs): Matrix;

  /**
   * Compute the state residual matrix for this observation.
   * @param propagator Propagator to compare against.
   * @throws Not implemented.
   */
  abstract residual(propagator: Propagator): Matrix;

  /**
   * Measurement noise covariance: the matrix inverse of {@link noise}. (The element-wise
   * reciprocal used before v8 is only right for a diagonal matrix.)
   * @returns A matrix representing the noise covariance.
   * @throws {SingularMatrixError} If the noise matrix is singular.
   */
  noiseCovariance(): Matrix {
    return this.noise.inverse();
  }

  /**
   * Lower-triangular square root of the noise covariance scaled to `sigma` standard
   * deviations: L = sigma * chol(C), so L L^T = sigma^2 C and L g with g ~ N(0, I) has
   * covariance sigma^2 C (per-component standard deviation sigma * sigma_i).
   * @param sigma - Number of standard deviations (1 gives the stated noise).
   * @returns The scaled Cholesky factor.
   */
  noiseSample_(sigma: number): Matrix {
    return this.noiseCovariance().cholesky().scale(sigma);
  }

  /**
   * Randomly sample this observation in vector form within the observation noise:
   * measurement + L g with L from {@link noiseSample_} and g a standard normal vector.
   * @param random Random number generator.
   * @param sigma Number of standard deviations to scale the noise by (1 gives the stated noise).
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
   * the provided sigma value (see {@link sampleVector}).
   * @param random Random number generator.
   * @param sigma Number of standard deviations to scale the noise by (1 gives the stated noise).
   * @returns The sampled observation.
   */
  abstract sample(random: RandomGaussianSource, sigma: number): Observation;
}
