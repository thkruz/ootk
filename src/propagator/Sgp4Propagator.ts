/**
 * @author @thkruz Theodore Kruczek
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2024 Theodore Kruczek
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

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
import { EpochUTC, J2000, Tle } from 'ootk-core';
import { Thrust } from '../force/Thrust';
import { VerletBlendInterpolator } from '../interpolator/VerletBlendInterpolator';
import { Propagator } from './Propagator';

// / SGP4 propagator.
export class Sgp4Propagator extends Propagator {
  // / Create a new [Sgp4Propagator] object from a [TLE].
  constructor(private tle: Tle) {
    super();
    this._cacheState = tle.state.toJ2000();
  }

  private _cacheState: J2000;
  private _checkpoints: J2000[] = [];

  get state(): J2000 {
    return this._cacheState;
  }

  ephemerisManeuver(start: EpochUTC, finish: EpochUTC, maneuvers: Thrust[], interval = 60.0): VerletBlendInterpolator {
    throw new Error('Maneuvers cannot be modelled with SGP4.');
  }

  maneuver(maneuver: Thrust, interval = 60.0): J2000[] {
    throw new Error('Maneuvers cannot be modelled with SGP4.');
  }

  propagate(epoch: EpochUTC): J2000 {
    this._cacheState = this.tle.propagate(epoch).toJ2000();

    return this._cacheState;
  }

  reset(): void {
    this._cacheState = this.tle.state.toJ2000();
  }

  checkpoint(): number {
    this._checkpoints.push(this._cacheState);

    return this._checkpoints.length - 1;
  }

  clearCheckpoints(): void {
    this._checkpoints = [];
  }

  restore(index: number): void {
    this._cacheState = this._checkpoints[index];
  }
}
