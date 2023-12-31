import { J2000 } from '../coordinate/J2000';
import { Observation } from '../observation/Observation';
import { PropagatorPairs } from '../observation/PropagatorPairs';
import { concat } from '../operations/functions';
import { Matrix } from '../operations/Matrix';
import { Vector } from '../operations/Vector';
import { Vector3D } from '../operations/Vector3D';
import { Propagator } from '../propagator/Propagator';
import { EpochUTC } from '../time/EpochUTC';
import { CovarianceFrame, StateCovariance } from './../covariance/StateCovariance';
import { ForceModel } from './../force/ForceModel';
import { KeplerPropagator } from './../propagator/KeplerPropagator';
import { RungeKutta89Propagator } from './../propagator/RungeKutta89Propagator';
import { BatchLeastSquaresResult } from './BatchLeastSquaresResult';

// / Batch least squares orbit determination.
export class BatchLeastSquaresOD {
  // / Propagator pair cache, for generating observation Jacobians.
  private _propPairs: PropagatorPairs;
  // / Nominal state propagator.
  private _propagator: Propagator;
  // / State estimate during solve.
  private _nominal: J2000;
  // / Solve start epoch.
  private _start: EpochUTC;

  /**
   * Create a new [BatchLeastSquaresOD] object from a list of [Observation]
   * objects, an [apriori] state estimate, and an optional
   * spacecraft [forceModel].
   */
  constructor(
    private _observations: Observation[],
    private _apriori: J2000,
    private _forceModel?: ForceModel,
    private _posStep: number = 1e-5,
    private _velStep: number = 1e-5,
    private _fastDerivatives: boolean = false,
  ) {
    this._observations.sort((a, b) => a.epoch.posix - b.epoch.posix);
    this._start = this._observations[0].epoch;
    this._propPairs = new PropagatorPairs(this._posStep, this._velStep);
    this._forceModel ??= new ForceModel().setGravity();
    this._propagator = new RungeKutta89Propagator(this._apriori, this._forceModel);
    this._nominal = this._propagator.propagate(this._start);
  }

  private _buildPropagator(x0: Float64Array, simple: boolean): Propagator {
    const state = new J2000(this._nominal.epoch, new Vector3D(x0[0], x0[1], x0[2]), new Vector3D(x0[3], x0[4], x0[5]));

    if (simple) {
      return new KeplerPropagator(state.toClassicalElements());
    }

    return new RungeKutta89Propagator(state, this._forceModel);
  }

  private static _stateToX0(state: J2000): Float64Array {
    return concat(state.position.toArray(), state.velocity.toArray());
  }

  private _setPropagatorPairs(x0: Float64Array): void {
    const pl = this._buildPropagator(x0, this._fastDerivatives);

    for (let i = 0; i < 6; i++) {
      const step = this._propPairs.step(i);
      const xh = x0.slice();

      xh[i] += step;
      const ph = this._buildPropagator(xh, this._fastDerivatives);

      this._propPairs.set(i, ph, pl);
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
    const xNom = BatchLeastSquaresOD._stateToX0(this._nominal);
    let weightedRms = Infinity;
    const atwaMatInit = Matrix.zero(6, 6);
    const atwbMatInit = Matrix.zero(6, 1);
    let atwaMat = atwaMatInit;

    for (let iter = 0; iter < maxIter; iter++) {
      atwaMat = atwaMatInit;
      let atwbMat = atwbMatInit;

      this._propagator = this._buildPropagator(xNom, false);
      this._setPropagatorPairs(xNom);
      let rmsTotal = 0.0;
      let measCount = 0;

      for (const ob of this._observations) {
        const noise = ob.noise;
        const aMat = ob.jacobian(this._propPairs);
        const aMatTN = aMat.transpose().multiply(noise);
        const bMat = ob.residual(this._propagator);

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
      this._buildPropagator(xNom, false).propagate(this._start),
      covariance,
      weightedRms,
    );
  }
}
