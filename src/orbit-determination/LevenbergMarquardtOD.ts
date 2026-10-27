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

import { CovarianceFrame, StateCovariance } from '../covariance/StateCovariance';
import { ForceModel } from '../force/ForceModel';
import { EpochUTC } from '../time/EpochUTC';
import { J2000 } from '../coordinate/J2000';
import { Kilometers, KilometersPerSecond } from '../types/types';
import { Matrix } from '../operations/Matrix';
import { SingularMatrixError } from '../operations/SingularMatrixError';
import { Vector } from '../operations/Vector';
import { Vector3D } from '../operations/Vector3D';
import { concat } from '../utils/functions';
import { Observation } from '../observation/Observation';
import { PropagatorPairs } from '../observation/PropagatorPairs';
import { KeplerPropagator } from '../propagator/KeplerPropagator';
import { Propagator } from '../propagator/Propagator';
import { RungeKutta89Propagator } from '../propagator/RungeKutta89Propagator';
import { LevenbergMarquardtResult } from './LevenbergMarquardtResult';

/**
 * Levenberg-Marquardt orbit determination.
 */
export class LevenbergMarquardtOD {
  /** Propagator pair cache, for generating observation Jacobians. */
  private readonly propPairs_: PropagatorPairs;
  /**  State estimate during solve. */
  private readonly nominal_: J2000;
  /**  Solve start epoch. */
  private readonly start_: EpochUTC;
  /** Observations sorted by epoch (a copy; the caller's array is not modified). */
  private readonly observations_: Observation[];

  /**
   * Create a new [LevenbergMarquardtOD] object from a list of [Observation]
   * objects, an [apriori] state estimate, and an optional
   * spacecraft [forceModel].
   *
   * The observations are copied and sorted by epoch; the caller's array is left unchanged.
   * @param observations List of observations.
   * @param apriori_ Apriori state estimate.
   * @param forceModel_ Spacecraft force model.
   * @param posStep_ Position step size.
   * @param velStep_ Velocity step size.
   * @param fastDerivatives_ Use fast derivatives.
   * @returns [LevenbergMarquardtOD] object.
   */
  constructor(
    observations: Observation[],
    private readonly apriori_: J2000,
    private readonly forceModel_?: ForceModel,
    private readonly posStep_: number = 1e-5,
    private readonly velStep_: number = 1e-5,
    private readonly fastDerivatives_: boolean = false,
  ) {
    this.observations_ = [...observations].sort((a, b) => a.epoch.posix - b.epoch.posix);
    this.start_ = this.observations_[0].epoch;
    this.propPairs_ = new PropagatorPairs(this.posStep_, this.velStep_);
    this.forceModel_ ??= new ForceModel().setGravity();
    const propagator = new RungeKutta89Propagator(this.apriori_, this.forceModel_);

    this.nominal_ = propagator.propagate(this.start_);
  }

  private buildPropagator_(x0: Float64Array, simple: boolean): Propagator {
    const state = new J2000(
      this.nominal_.epoch,
      new Vector3D(x0[0] as Kilometers, x0[1] as Kilometers, x0[2] as Kilometers),
      new Vector3D(x0[3] as KilometersPerSecond, x0[4] as KilometersPerSecond, x0[5] as KilometersPerSecond),
    );

    if (simple) {
      return new KeplerPropagator(state.toClassicalElements());
    }

    return new RungeKutta89Propagator(state, this.forceModel_);
  }

  private static stateToX0_(state: J2000): Float64Array {
    return concat(state.position.toArray(), state.velocity.toArray());
  }

  private setPropagatorPairs_(x0: Float64Array): void {
    const pl = this.buildPropagator_(x0, this.fastDerivatives_);

    for (let i = 0; i < 6; i++) {
      const step = this.propPairs_.step(i);
      const xh = x0.slice();

      xh[i] += step;
      const ph = this.buildPropagator_(xh, this.fastDerivatives_);

      this.propPairs_.set(i, ph, pl);
    }
  }

  private computeRMS(x: Float64Array): number {
    const propagator = this.buildPropagator_(x, false);
    let rmsTotal = 0.0;
    let measCount = 0;

    for (const ob of this.observations_) {
      const noise = ob.noise;
      const bMat = ob.residual(propagator);

      rmsTotal += bMat.transpose().multiply(noise).multiply(bMat).elements[0][0];
      measCount += noise.rows;
    }

    return Math.sqrt(rmsTotal / measCount);
  }

  private computeLinearSystem(x: Float64Array): { atwa: Matrix; atwb: Matrix; rms: number; measCount: number } {
    const propagator = this.buildPropagator_(x, false);

    this.setPropagatorPairs_(x);
    let atwaMat = Matrix.zero(6, 6);
    let atwbMat = Matrix.zero(6, 1);
    let rmsTotal = 0.0;
    let measCount = 0;

    for (const ob of this.observations_) {
      const noise = ob.noise;
      const aMat = ob.jacobian(this.propPairs_);
      const aMatTN = aMat.transpose().multiply(noise);
      const bMat = ob.residual(propagator);

      atwaMat = atwaMat.add(aMatTN.multiply(aMat));
      atwbMat = atwbMat.add(aMatTN.multiply(bMat));
      rmsTotal += bMat.transpose().multiply(noise).multiply(bMat).elements[0][0];
      measCount += noise.rows;
    }

    return {
      atwa: atwaMat,
      atwb: atwbMat,
      rms: Math.sqrt(rmsTotal / measCount),
      measCount,
    };
  }

  /** Invert a normal matrix, or throw a SingularMatrixError naming the cause. */
  private static invertNormal_(mat: Matrix): Matrix {
    const inv = mat.tryInverse();

    if (inv === null) {
      throw new SingularMatrixError(
        'LevenbergMarquardtOD: the normal matrix J^T W J is singular; the observations do not determine all six ' +
        'state components (too few observations or degenerate geometry)',
      );
    }

    return inv;
  }

  /**
   * Attempt to solve a state estimate using the Levenberg-Marquardt algorithm (Marquardt
   * scaling: the diagonal of J^T W J is multiplied by 1 + lambda).
   *
   * Convergence is tested at every linearisation point, before a step is attempted, so the
   * returned state, `rms` and covariance always belong to the same state. The solve has
   * converged when either
   * - the noise-weighted RMS is below [epsilon] (noiseless data), or
   * - the undamped Gauss-Newton step would lower the weighted RMS by at most
   *   epsilon * max(RMS, 1). The predicted mean-square reduction is g^T (J^T W J)^-1 g / m with
   *   g = J^T W r and m the number of measurements (exact for a linear model). At the noise
   *   floor the weighted RMS is about 1, so this is a relative test there.
   *
   * `converged` is false when [maxIterations] accepted steps did not meet either test, or when
   * the damping factor exceeded 1e10 without finding a step that lowers the RMS.
   * @param root0 Options.
   * @param root0.maxIterations Maximum number of accepted steps.
   * @param root0.epsilon Convergence tolerance on the weighted RMS (see above), default 1e-6.
   * @param root0.lambdaInit Initial damping factor.
   * @param root0.lambdaFactor Factor to increase/decrease lambda.
   * @param root0.printIter Print iterations to console.
   * @returns [LevenbergMarquardtResult] object.
   * @throws {SingularMatrixError} If J^T W J is singular (the observations do not determine the
   *   full state). It is not caught here.
   */
  solve({
    maxIterations = 50,
    epsilon = 1e-6,
    lambdaInit = 0.01,
    lambdaFactor = 10.0,
    printIter = false,
  }: {
    maxIterations?: number;
    epsilon?: number;
    lambdaInit?: number;
    lambdaFactor?: number;
    printIter?: boolean;
  } = {}): LevenbergMarquardtResult {
    let xNom = LevenbergMarquardtOD.stateToX0_(this.nominal_);
    let lambda = lambdaInit;
    let iter = 0;
    let converged = false;

    // Initial system calculation
    let sys = this.computeLinearSystem(xNom);
    let currentRms = sys.rms;

    if (printIter) {
      // eslint-disable-next-line no-console
      console.log(`0: rms=${currentRms} lambda=${lambda} x=${new Vector(xNom)}`);
    }

    for (;;) {
      // Convergence test at the current linearisation point
      const jtwjInv = LevenbergMarquardtOD.invertNormal_(sys.atwa);
      const predictedMsReduction = Math.max(
        0,
        sys.atwb.transpose().multiply(jtwjInv).multiply(sys.atwb).elements[0][0] / sys.measCount,
      );
      const predictedRms = Math.sqrt(Math.max(0, currentRms * currentRms - predictedMsReduction));

      if (currentRms < epsilon || currentRms - predictedRms <= epsilon * Math.max(currentRms, 1)) {
        converged = true;
        break;
      }

      if (iter >= maxIterations) {
        break;
      }
      iter++;

      let stepAccepted = false;

      while (!stepAccepted) {
        /*
         * Form the augmented normal equations: (JtWJ + lambda * diag(JtWJ)) * delta = JtWr
         * Using Marquardt's method: A[i][i] *= (1 + lambda)
         */
        const A = Matrix.zero(6, 6);

        for (let i = 0; i < 6; i++) {
          for (let j = 0; j < 6; j++) {
            A.elements[i][j] = sys.atwa.elements[i][j];
          }
          A.elements[i][i] *= (1.0 + lambda);
        }

        // Solve for delta
        const delta = LevenbergMarquardtOD.invertNormal_(A).multiply(sys.atwb);

        // Trial state
        const xTrial = new Float64Array(6);

        for (let i = 0; i < 6; i++) {
          xTrial[i] = xNom[i] + delta.elements[i][0];
        }

        // Check cost of trial state
        const trialRms = this.computeRMS(xTrial);

        if (trialRms < currentRms) {
          // Accept step
          xNom = xTrial;
          lambda /= lambdaFactor;
          stepAccepted = true;

          // Recompute system for next iteration (sys.rms equals trialRms)
          sys = this.computeLinearSystem(xNom);
          currentRms = sys.rms;

          if (printIter) {
            // eslint-disable-next-line no-console
            console.log(`${iter}: rms=${currentRms} lambda=${lambda} x=${new Vector(xNom)}`);
          }
        } else {
          // Reject step
          lambda *= lambdaFactor;
          if (lambda > 1e10) {
            // Prevent infinite loop or excessive damping
            break;
          }
        }
      }

      if (!stepAccepted) {
        break;
      }
    }

    // Final covariance at the returned state
    const p = LevenbergMarquardtOD.invertNormal_(sys.atwa);
    const covariance = new StateCovariance(p, CovarianceFrame.ECI);

    return new LevenbergMarquardtResult(
      this.buildPropagator_(xNom, false).propagate(this.start_),
      covariance,
      currentRms,
      iter,
      converged,
    );
  }
}
