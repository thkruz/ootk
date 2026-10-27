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
import { BatchLeastSquaresResult } from './BatchLeastSquaresResult';

/**
 * Batch least squares orbit determination.
 */
export class BatchLeastSquaresOD {
  /** Propagator pair cache, for generating observation Jacobians. */
  private readonly propPairs_: PropagatorPairs;
  /**  Nominal state propagator. */
  private propagator_: Propagator;
  /**  State estimate during solve. */
  private readonly nominal_: J2000;
  /**  Solve start epoch. */
  private readonly start_: EpochUTC;
  /** Observations sorted by epoch (a copy; the caller's array is not modified). */
  private readonly observations_: Observation[];

  /**
   * Create a new [BatchLeastSquaresOD] object from a list of [Observation]
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
   * @returns [BatchLeastSquaresOD] object.
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
    this.propagator_ = new RungeKutta89Propagator(this.apriori_, this.forceModel_);
    this.nominal_ = this.propagator_.propagate(this.start_);
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

  /**
   * Accumulate the normal equations A^T W A and A^T W b and the weighted RMS of the
   * residuals for the state [xNom] at the solve start epoch.
   */
  private accumulate_(xNom: Float64Array): { atwaMat: Matrix; atwbMat: Matrix; weightedRms: number } {
    let atwaMat = Matrix.zero(6, 6);
    let atwbMat = Matrix.zero(6, 1);

    this.propagator_ = this.buildPropagator_(xNom, false);
    this.setPropagatorPairs_(xNom);
    let rmsTotal = 0.0;
    let measCount = 0;

    for (const ob of this.observations_) {
      const noise = ob.noise;
      const aMat = ob.jacobian(this.propPairs_);
      const aMatTN = aMat.transpose().multiply(noise);
      const bMat = ob.residual(this.propagator_);

      atwaMat = atwaMat.add(aMatTN.multiply(aMat));
      atwbMat = atwbMat.add(aMatTN.multiply(bMat));
      rmsTotal += bMat.transpose().multiply(noise).multiply(bMat).elements[0][0];
      measCount += noise.rows;
    }

    return { atwaMat, atwbMat, weightedRms: Math.sqrt(rmsTotal / measCount) };
  }

  /** Invert the normal matrix, or throw a SingularMatrixError naming the cause. */
  private static invertNormal_(atwaMat: Matrix): Matrix {
    const inv = atwaMat.tryInverse();

    if (inv === null) {
      throw new SingularMatrixError(
        'BatchLeastSquaresOD: the normal matrix A^T W A is singular; the observations do not determine all six ' +
        'state components (too few observations or degenerate geometry)',
      );
    }

    return inv;
  }

  /**
   * Attempt to solve a state estimate by Gauss-Newton iteration on the weighted residuals.
   *
   * Each iteration evaluates the residuals at the current state; the solve has converged when the
   * change in weighted RMS between two consecutive evaluations is at most
   * [tolerance] * max(previous RMS, 1). At or above the noise floor (weighted RMS of order 1) this
   * is a relative test; below it the test is absolute in units of the measurement sigma, because
   * with noiseless data the RMS sits at floating-point round-off (about 1e-12) and changes by
   * tens of percent between iterations, so a purely relative test never triggers.
   * On convergence the step is not applied, so the returned state, `rms` and covariance all
   * belong to the same state. If [maxIter] steps are applied without meeting the tolerance, the
   * residuals are evaluated once more at the final state and `converged` is false.
   * @param root0 Options.
   * @param root0.tolerance Change in weighted RMS that counts as converged, relative to max(RMS, 1) (default 1e-3).
   * @param root0.maxIter Maximum number of Gauss-Newton steps (default 250).
   * @param root0.printIter Print iterations.
   * @returns [BatchLeastSquaresResult] object.
   * @throws {SingularMatrixError} If the normal matrix is singular (the observations do not
   *   determine the full state). It is not caught here.
   */
  solve({
    tolerance = 1e-3,
    maxIter = 250,
    printIter = false,
  }: {
    tolerance?: number;
    maxIter?: number;
    printIter?: boolean;
  } = {}): BatchLeastSquaresResult {
    const xNom = BatchLeastSquaresOD.stateToX0_(this.nominal_);
    let weightedRms = Infinity;
    let atwaMat = Matrix.zero(6, 6);
    let converged = false;

    for (let iter = 0; iter < maxIter; iter++) {
      const normal = this.accumulate_(xNom);
      const newWeightedRms = normal.weightedRms;

      atwaMat = normal.atwaMat;

      if (printIter) {
        // eslint-disable-next-line no-console
        console.log(`${iter + 1}: rms=${newWeightedRms} x=${new Vector(xNom)}`);
      }
      if (iter > 0 && Math.abs(weightedRms - newWeightedRms) <= tolerance * Math.max(weightedRms, 1)) {
        weightedRms = newWeightedRms;
        converged = true;
        break;
      }
      weightedRms = newWeightedRms;
      const dX = BatchLeastSquaresOD.invertNormal_(atwaMat).multiply(normal.atwbMat);

      for (let i = 0; i < 6; i++) {
        xNom[i] += dX.elements[i][0];
      }
    }

    if (!converged) {
      // Re-evaluate at the final iterate so rms and covariance describe the returned state.
      const normal = this.accumulate_(xNom);

      atwaMat = normal.atwaMat;
      weightedRms = normal.weightedRms;
    }

    const p = BatchLeastSquaresOD.invertNormal_(atwaMat);
    const covariance = new StateCovariance(p, CovarianceFrame.ECI);

    return new BatchLeastSquaresResult(
      this.buildPropagator_(xNom, false).propagate(this.start_),
      covariance,
      weightedRms,
      converged,
    );
  }
}
