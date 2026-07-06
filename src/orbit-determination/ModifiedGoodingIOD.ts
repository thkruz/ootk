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

import { OrbitDeterminationError } from '../errors';
import { ForceModel } from '../force/ForceModel';
import { Earth } from '../body/Earth';
import { EpochUTC } from '../time/EpochUTC';
import { J2000 } from '../coordinate/J2000';
import { Kilometers, KilometersPerSecond } from '../types/types';
import { RadecTopocentric } from '../observation/RadecTopocentric';
import { Vector3D } from '../operations/Vector3D';
import { ObservationOptical } from '../observation/ObservationOptical';
import { DownhillSimplex } from '../optimize/DownhillSimplex';
import { CostFunction } from '../optimize/internal/SimplexEntry';
import { RungeKutta89Propagator } from '../propagator/RungeKutta89Propagator';
import { GoodingIOD } from './GoodingIOD';

type SolveOptions = {
  nRev?: number;
  direction?: boolean;
  posSearch?: number;
  velSearch?: number;
  tolerance?: number;
  maxIter?: number;
  printIter?: boolean;
};

/**
 * Gooding angles-only initial orbit determination.
 *
 * Used for orbit determination from multiple optical observations.
 */
export class ModifiedGoodingIOD {
  private observations_!: ObservationOptical[];
  private readonly mu_: number;

  constructor(mu: number = Earth.mu) {
    this.mu_ = mu;
  }

  private createInitial_(r1Init: Kilometers | null, rNInit: Kilometers | null, nRev: number, direction: boolean): J2000 {
    const iod = new GoodingIOD(
      this.mu_,
    );

    return iod.estimate(this.observations_[0],
      this.observations_[Math.floor(this.observations_.length / 2)],
      this.observations_[this.observations_.length - 1], r1Init, rNInit, nRev, direction);
  }

  private createErrorFunction_(aprioriEpoch: EpochUTC): CostFunction {
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
    observations: ObservationOptical[],
    r0?: Kilometers,
    rN?: Kilometers,
    {
      nRev = 0,
      direction = true,
      posSearch = 10.0,
      velSearch = 0.1,
      tolerance = 1e-6,
      maxIter = 10000,
      printIter = false,
    }: SolveOptions = this.defaultSolveOptions_(),
  ): J2000 {
    this.observations_ = observations;
    if (this.observations_.length < 3) {
      throw new OrbitDeterminationError('At least 3 observations required for Gooding IOD', 'ModifiedGooding');
    }
    const init = this.createInitial_(r0 ?? null, rN ?? null, nRev, direction);
    const guess = Float64Array.from([...init.position.toArray(), ...init.velocity.toArray()]);
    const solveFn = this.createErrorFunction_(init.epoch);
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
      maxIter,
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

  private defaultSolveOptions_(): SolveOptions {
    return {
      nRev: 0,
      direction: true,
      posSearch: 10.0,
      velSearch: 0.1,
      tolerance: 1e-6,
      printIter: false,
    };
  }
}
