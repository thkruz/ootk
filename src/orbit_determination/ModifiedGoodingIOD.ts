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

import { ForceModel } from '../force/ForceModel.js';
import { Earth, EpochUTC, J2000, Kilometers, KilometersPerSecond, RadecTopocentric, Vector3D } from '../main.js';
import { RungeKutta89Propagator } from '../propagator/RungeKutta89Propagator.js';
import { ObservationOptical } from './../observation/ObservationOptical.js';
import { DownhillSimplex } from './../optimize/DownhillSimplex.js';
import { CostFunction } from './../optimize/SimplexEntry.js';
import { GoodingIOD } from './GoodingIOD.js';

type SolveOptions = {
  nRev?: number;
  direction?: boolean;
  posSearch?: number;
  velSearch?: number;
  tolerance?: number;
  printIter?: boolean;
};

/**
 * Gooding angles-only initial orbit determination.
 *
 * Used for orbit determination from multiple optical observations.
 */
export class ModifiedGoodingIOD {
  private observations_: ObservationOptical[];
  private mu_: number;

  constructor(observations: ObservationOptical[], mu: number = Earth.mu) {
    this.observations_ = observations;
    this.mu_ = mu;
  }

  private createInitial_(r0: Kilometers, rN: Kilometers, nRev: number, direction: boolean): J2000 {
    const iod = new GoodingIOD(
      this.observations_[0],
      this.observations_[Math.floor(this.observations_.length / 2)],
      this.observations_[this.observations_.length - 1],
      this.mu_,
    );

    return iod.solve(r0, rN, nRev, direction);
  }

  private _createErrorFunction(aprioriEpoch: EpochUTC): CostFunction {
    const forceModel = new ForceModel().setGravity(this.mu_);
    const scoreFn = (x: Float64Array): number => {
      const position = new Vector3D(x[0] as Kilometers, x[1] as Kilometers, x[2] as Kilometers);
      const velocity = new Vector3D(
        x[3] as KilometersPerSecond,
        x[4] as KilometersPerSecond,
        x[5] as KilometersPerSecond,
      );
      const state = new J2000(aprioriEpoch, position, velocity);
      const propagator = new RungeKutta89Propagator(state, forceModel);
      let total = 0;

      for (const oC of this.observations_) {
        const sC = propagator.propagate(oC.epoch);
        const pC = oC.site;
        const expected = oC.observation.lineOfSight();
        const actual = RadecTopocentric.fromStateVector(sC, pC).lineOfSight();
        const error = expected.angle(actual);

        total += error;
      }

      return total;
    };

    return scoreFn;
  }

  solve(
    r0: Kilometers,
    rN: Kilometers,
    {
      nRev = 0,
      direction = true,
      posSearch = 10.0,
      velSearch = 0.1,
      tolerance = 1e-6,
      printIter = false,
    }: SolveOptions,
  ): J2000 {
    if (this.observations_.length < 3) {
      throw new Error('At least 3 observations required for Gooding IOD.');
    }
    const init = this.createInitial_(r0, rN, nRev, direction);
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
      new Vector3D(result[0] as Kilometers, result[1] as Kilometers, result[2] as Kilometers),
      new Vector3D(
        result[3] as KilometersPerSecond,
        result[4] as KilometersPerSecond,
        result[5] as KilometersPerSecond,
      ),
    );
  }
}
