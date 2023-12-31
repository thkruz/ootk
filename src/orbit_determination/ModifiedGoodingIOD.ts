import { EpochUTC } from '@src/time/EpochUTC';
import { Earth } from '../body/Earth';
import { J2000 } from '../coordinate/J2000';
import { ForceModel } from '../force/ForceModel';
import { RadecTopocentric } from '../observation/RadecTopocentric';
import { Vector3D } from '../operations/Vector3D';
import { RungeKutta89Propagator } from '../propagator/RungeKutta89Propagator';
import { ObservationOptical } from './../observation/ObservationOptical';
import { DownhillSimplex } from './../optimize/DownhillSimplex';
import { CostFunction } from './../optimize/SimplexEntry';
import { GoodingIOD } from './GoodingIOD';

type SolveOptions = {
  nRev?: number;
  direction?: boolean;
  posSearch?: number;
  velSearch?: number;
  tolerance?: number;
  printIter?: boolean;
};

export class ModifiedGoodingIOD {
  private _observations: ObservationOptical[];
  private _mu: number;

  constructor(observations: ObservationOptical[], mu: number = Earth.mu) {
    this._observations = observations;
    this._mu = mu;
  }

  private _createInitial(r0: number, rN: number, nRev: number, direction: boolean): J2000 {
    const iod = new GoodingIOD(
      this._observations[0],
      this._observations[Math.floor(this._observations.length / 2)],
      this._observations[this._observations.length - 1],
      this._mu,
    );

    return iod.solve(r0, rN, nRev, direction);
  }

  private _createErrorFunction(aprioriEpoch: EpochUTC): CostFunction {
    const forceModel = new ForceModel().setGravity(this._mu);
    const scoreFn = (x: Float64Array): number => {
      const position = new Vector3D(x[0], x[1], x[2]);
      const velocity = new Vector3D(x[3], x[4], x[5]);
      const state = new J2000(aprioriEpoch, position, velocity);
      const propagator = new RungeKutta89Propagator(state, forceModel);
      let total = 0;

      for (const oC of this._observations) {
        const sC = propagator.propagate(oC.epoch);
        const pC = oC.site;
        const expected = oC.observation.lineOfSight();
        const actual = RadecTopocentric.fromStateVectors(sC, pC).lineOfSight();
        const error = expected.angle(actual);

        total += error;
      }

      return total;
    };

    return scoreFn;
  }

  solve(
    r0: number,
    rN: number,
    {
      nRev = 0,
      direction = true,
      posSearch = 10.0,
      velSearch = 0.1,
      tolerance = 1e-6,
      printIter = false,
    }: SolveOptions,
  ): J2000 {
    if (this._observations.length < 3) {
      throw new Error('At least 3 observations required for Gooding IOD.');
    }
    const init = this._createInitial(r0, rN, nRev, direction);
    const guess = Float64Array.from([...init.position.toArray(), ...init.velocity.toArray()]);
    const solveFn = this._createErrorFunction(init.epoch);
    const simplex = [
      Float64Array.from(guess),
      Float64Array.from([guess[0] + posSearch, guess[1], guess[2], guess[3], guess[4], guess[5]]),
      Float64Array.from([guess[0], guess[1] + posSearch, guess[2], guess[3], guess[4], guess[5]]),
      Float64Array.from([guess[0], guess[1], guess[2] + posSearch, guess[3], guess[4], guess[5]]),
      Float64Array.from([guess[0], guess[1], guess[2], guess[3] + velSearch, guess[4], guess[5]]),
      Float64Array.from([guess[0], guess[1], guess[2], guess[3], guess[4] + velSearch, guess[5]]),
      Float64Array.from([guess[0], guess[1], guess[2], guess[3], guess[4], guess[5] + velSearch]),
    ];
    const result = DownhillSimplex.solveSimplex(solveFn, simplex, {
      adaptive: true,
      xTolerance: tolerance,
      fTolerance: tolerance,
      printIter,
    });

    return new J2000(
      init.epoch,
      new Vector3D(result[0], result[1], result[2]),
      new Vector3D(result[3], result[4], result[5]),
    );
  }
}
