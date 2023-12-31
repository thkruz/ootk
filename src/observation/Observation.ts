/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
import { EpochUTC } from '@src/time/EpochUTC';
import { Matrix } from '../operations/Matrix';
import { Vector } from '../operations/Vector';
import { Vector3D } from '../operations/Vector3D';
import { Propagator } from '../propagator/Propagator';
import { J2000 } from './../coordinate/J2000';
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
