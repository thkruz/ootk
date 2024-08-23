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

import { concat, EpochUTC, J2000, Kilometers, KilometersPerSecond, Matrix, Vector, Vector3D } from '../main.js';
import { Observation } from '../observation/Observation.js';
import { PropagatorPairs } from '../observation/PropagatorPairs.js';
import { Propagator } from '../propagator/Propagator.js';
import { CovarianceFrame, StateCovariance } from './../covariance/StateCovariance.js';
import { ForceModel } from './../force/ForceModel.js';
import { KeplerPropagator } from './../propagator/KeplerPropagator.js';
import { RungeKutta89Propagator } from './../propagator/RungeKutta89Propagator.js';
import { BatchLeastSquaresResult } from './BatchLeastSquaresResult.js';

/**
 * Batch least squares orbit determination.
 */
export class BatchLeastSquaresOD {
  /** Propagator pair cache, for generating observation Jacobians. */
  private propPairs_: PropagatorPairs;
  /**  Nominal state propagator. */
  private propagator_: Propagator;
  /**  State estimate during solve. */
  private nominal_: J2000;
  /**  Solve start epoch. */
  private start_: EpochUTC;

  /**
   * Create a new [BatchLeastSquaresOD] object from a list of [Observation]
   * objects, an [apriori] state estimate, and an optional
   * spacecraft [forceModel].
   * @param observations_ List of observations.
   * @param apriori_ Apriori state estimate.
   * @param forceModel_ Spacecraft force model.
   * @param posStep_ Position step size.
   * @param velStep_ Velocity step size.
   * @param fastDerivatives_ Use fast derivatives.
   * @returns [BatchLeastSquaresOD] object.
   */
  constructor(
    private observations_: Observation[],
    private apriori_: J2000,
    private forceModel_?: ForceModel,
    private posStep_: number = 1e-5,
    private velStep_: number = 1e-5,
    private fastDerivatives_: boolean = false,
  ) {
    this.observations_.sort((a, b) => a.epoch.posix - b.epoch.posix);
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
   * Attempt to solve a state estimate with the given root-mean-squared delta
   * [tolerance].
   * @param root0 Root initial guess.
   * @param root0.tolerance Root-mean-squared delta tolerance.
   * @param root0.maxIter Maximum number of iterations.
   * @param root0.printIter Print iterations.
   * @returns [BatchLeastSquaresResult] object.
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
    let breakFlag = false;
    const xNom = BatchLeastSquaresOD.stateToX0_(this.nominal_);
    let weightedRms = Infinity;
    const atwaMatInit = Matrix.zero(6, 6);
    const atwbMatInit = Matrix.zero(6, 1);
    let atwaMat = atwaMatInit;

    for (let iter = 0; iter < maxIter; iter++) {
      atwaMat = atwaMatInit;
      let atwbMat = atwbMatInit;

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
      const newWeightedRms = Math.sqrt(rmsTotal / measCount);

      if (printIter) {
        // eslint-disable-next-line no-console
        console.log(`${iter + 1}: rms=${newWeightedRms} x=${new Vector(xNom)}`);
      }
      if (Math.abs((weightedRms - newWeightedRms) / weightedRms) <= tolerance) {
        breakFlag = true;
      }
      weightedRms = newWeightedRms;
      const dX = atwaMat.inverse().multiply(atwbMat);

      for (let i = 0; i < 6; i++) {
        xNom[i] += dX.elements[i][0];
      }
      if (breakFlag) {
        break;
      }
    }
    const p = atwaMat.inverse();
    const covariance = new StateCovariance(p, CovarianceFrame.ECI);

    return new BatchLeastSquaresResult(
      this.buildPropagator_(xNom, false).propagate(this.start_),
      covariance,
      weightedRms,
    );
  }
}
