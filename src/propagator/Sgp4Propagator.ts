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

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
import { Thrust } from '../force/Thrust.js';
import { VerletBlendInterpolator } from '../interpolator/VerletBlendInterpolator.js';
import { EpochUTC, J2000, Tle } from '../main.js';
import { Propagator } from './Propagator.js';

/**
 * Sgp4Propagator is a propagator that uses the SGP4 model to propagate the state of an object.
 * This class is useful for propagating multiple states with the same TLE, since it caches the
 * state of the TLE at different epochs.
 */
export class Sgp4Propagator extends Propagator {
  constructor(private tle: Tle) {
    super();
    this._cacheState = tle.state.toJ2000();
  }

  private _cacheState: J2000;
  private _checkpoints: J2000[] = [];

  /**
   * Gets the state of the propagator in the J2000 coordinate system.
   * @returns The J2000 state of the propagator.
   */
  get state(): J2000 {
    return this._cacheState;
  }

  /**
   * Calculates the ephemeris maneuver using the SGP4 propagator.
   * @param start The start epoch in UTC.
   * @param finish The finish epoch in UTC.
   * @param maneuvers The array of thrust maneuvers.
   * @param interval The time interval in seconds.
   */
  ephemerisManeuver(start: EpochUTC, finish: EpochUTC, maneuvers: Thrust[], interval = 60.0): VerletBlendInterpolator {
    throw new Error('Maneuvers cannot be modelled with SGP4.');
  }

  /**
   * Performs a maneuver with the given thrust.
   * @param maneuver - The thrust maneuver to perform.
   * @param interval - The time interval for the maneuver (default: 60.0 seconds).
   * @throws Error if maneuvers cannot be modeled with SGP4.
   */
  maneuver(maneuver: Thrust, interval = 60.0): J2000[] {
    throw new Error('Maneuvers cannot be modelled with SGP4.');
  }

  /**
   * Propagates the state of the Sgp4Propagator to a specified epoch in J2000 coordinates.
   * @param epoch - The epoch in UTC format.
   * @returns The propagated state in J2000 coordinates.
   */
  propagate(epoch: EpochUTC): J2000 {
    this._cacheState = this.tle.propagate(epoch).toJ2000();

    return this._cacheState;
  }

  /**
   * Resets the state of the Sgp4Propagator by updating the cache state
   * to the current J2000 state of the TLE.
   */
  reset(): void {
    this._cacheState = this.tle.state.toJ2000();
  }

  /**
   * Saves the current state of the propagator and returns the index of the checkpoint.
   * @returns The index of the checkpoint.
   */
  checkpoint(): number {
    this._checkpoints.push(this._cacheState);

    return this._checkpoints.length - 1;
  }

  /**
   * Clears all the checkpoints in the propagator.
   */
  clearCheckpoints(): void {
    this._checkpoints = [];
  }

  /**
   * Restores the state of the propagator to a previously saved checkpoint.
   * @param index - The index of the checkpoint to restore.
   */
  restore(index: number): void {
    this._cacheState = this._checkpoints[index];
  }
}
