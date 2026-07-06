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

  /**
   * Create a new [LevenbergMarquardtOD] object from a list of [Observation]
   * objects, an [apriori] state estimate, and an optional
   * spacecraft [forceModel].
   * @param observations_ List of observations.
   * @param apriori_ Apriori state estimate.
   * @param forceModel_ Spacecraft force model.
   * @param posStep_ Position step size.
   * @param velStep_ Velocity step size.
   * @param fastDerivatives_ Use fast derivatives.
   * @returns [LevenbergMarquardtOD] object.
   */
  constructor(
    private readonly observations_: Observation[],
    private readonly apriori_: J2000,
    private readonly forceModel_?: ForceModel,
    private readonly posStep_: number = 1e-5,
    private readonly velStep_: number = 1e-5,
    private readonly fastDerivatives_: boolean = false,
  ) {
    this.observations_.sort((a, b) => a.epoch.posix - b.epoch.posix);
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

  private computeLinearSystem(x: Float64Array): { atwa: Matrix; atwb: Matrix; rms: number } {
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
    };
  }

  /**
   * Attempt to solve a state estimate using the Levenberg-Marquardt algorithm.
   * @param root0 Options.
   * @param root0.maxIterations Maximum number of iterations.
   * @param root0.epsilon Convergence tolerance (RMS error).
   * @param root0.lambdaInit Initial damping factor.
   * @param root0.lambdaFactor Factor to increase/decrease lambda.
   * @param root0.printIter Print iterations to console.
   * @returns [LevenbergMarquardtResult] object.
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
    let { atwa: JtWJ, atwb: JtWr, rms: currentRms } = this.computeLinearSystem(xNom);

    if (printIter) {
      // eslint-disable-next-line no-console
      console.log(`0: rms=${currentRms} lambda=${lambda} x=${new Vector(xNom)}`);
    }

    while (iter < maxIterations) {
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
            A.elements[i][j] = JtWJ.elements[i][j];
          }
          A.elements[i][i] *= (1.0 + lambda);
        }

        // Solve for delta
        const delta = A.inverse().multiply(JtWr);

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
          currentRms = trialRms;
          lambda /= lambdaFactor;
          stepAccepted = true;

          if (printIter) {
            // eslint-disable-next-line no-console
            console.log(`${iter}: rms=${currentRms} lambda=${lambda} x=${new Vector(xNom)}`);
          }

          // Recompute system for next iteration
          const sys = this.computeLinearSystem(xNom);

          JtWJ = sys.atwa;
          JtWr = sys.atwb;
          // Note: sys.rms should match trialRms
        } else {
          // Reject step
          lambda *= lambdaFactor;
          if (lambda > 1e10) {
            // Prevent infinite loop or excessive damping
            break;
          }
        }
      }

      if (currentRms < epsilon || lambda > 1e10) {
        converged = currentRms < epsilon;
        break;
      }
    }

    // Final covariance
    const p = JtWJ.inverse();
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
