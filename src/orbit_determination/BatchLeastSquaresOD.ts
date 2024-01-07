import { concat, EpochUTC, J2000, Matrix, Vector, Vector3D } from 'ootk-core';
import { Observation } from '../observation/Observation';
import { PropagatorPairs } from '../observation/PropagatorPairs';
import { Propagator } from '../propagator/Propagator';
import { CovarianceFrame, StateCovariance } from './../covariance/StateCovariance';
import { ForceModel } from './../force/ForceModel';
import { KeplerPropagator } from './../propagator/KeplerPropagator';
import { RungeKutta89Propagator } from './../propagator/RungeKutta89Propagator';
import { BatchLeastSquaresResult } from './BatchLeastSquaresResult';

/**
 * Batch least squares orbit determination.
 */
export class BatchLeastSquaresOD {
  // / Propagator pair cache, for generating observation Jacobians.
  private propPairs_: PropagatorPairs;
  // / Nominal state propagator.
  private propagator_: Propagator;
  // / State estimate during solve.
  private nominal_: J2000;
  // / Solve start epoch.
  private start_: EpochUTC;

  /**
   * Create a new [BatchLeastSquaresOD] object from a list of [Observation]
   * objects, an [apriori] state estimate, and an optional
   * spacecraft [forceModel].
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
    const state = new J2000(this.nominal_.epoch, new Vector3D(x0[0], x0[1], x0[2]), new Vector3D(x0[3], x0[4], x0[5]));

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
        rmsTotal += bMat.transpose().multiply(noise).multiply(bMat)[0][0];
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
        xNom[i] += dX[i][0];
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
