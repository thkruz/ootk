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

import { TEME } from '../coordinate/frames';
import { Tle } from '../coordinate/Tle';
import { SatKey, Sgp4WasmError } from '../external/Sgp4WasmTypes';
import { Sgp4WasmBase } from '../external/Sgp4WasmBase';
import { Thrust } from '../force/Thrust';
import { VerletBlendInterpolator } from '../interpolator/VerletBlendInterpolator';
import { EpochUTC } from '../time/EpochUTC';
import { J2000 } from '../coordinate/J2000';
import { Propagator } from './Propagator';

/**
 * Sgp4WasmPropagator adapts the USSF Astro Standards SGP4 WebAssembly
 * wrappers ({@link Sgp4Wasm} / {@link Sgp4XpWasm}) to the same
 * {@link Propagator} interface as {@link Sgp4Propagator}, so the official
 * Astro Standards implementation can be swapped in for the pure-TypeScript
 * SGP4.
 *
 * The wasm instance must already be loaded (`await wasm.load()`); the
 * constructor registers and initializes the TLE synchronously. Call
 * {@link dispose} to remove the satellite from the wasm instance's registry
 * when done.
 */
export class Sgp4WasmPropagator extends Propagator {
  private readonly satKey_: SatKey;
  private cacheState_: J2000;
  private checkpoints_: J2000[] = [];

  constructor(private readonly wasm_: Sgp4WasmBase, private readonly tle_: Tle) {
    super();

    if (!wasm_.isLoaded) {
      throw new Sgp4WasmError('Sgp4WasmPropagator requires a loaded Sgp4Wasm instance. Call load() first.');
    }

    this.satKey_ = wasm_.addSat(tle_.line1, tle_.line2);
    wasm_.initSats([this.satKey_]);
    this.cacheState_ = this.propagate(tle_.epoch);
  }

  /**
   * The Astro Standards satKey backing this propagator.
   */
  get satKey(): SatKey {
    return this.satKey_;
  }

  /**
   * Gets the state of the propagator in the J2000 coordinate system.
   * @returns The J2000 state of the propagator.
   */
  get state(): J2000 {
    return this.cacheState_;
  }

  /**
   * Calculates the ephemeris maneuver using the SGP4 propagator.
   * @param start The start epoch in UTC.
   * @param finish The finish epoch in UTC.
   * @param maneuvers The array of thrust maneuvers.
   * @param interval The time interval in seconds.
   */
  ephemerisManeuver(_start: EpochUTC, _finish: EpochUTC, _maneuvers: Thrust[], _interval = 60.0): VerletBlendInterpolator {
    throw new Error('Maneuvers cannot be modelled with SGP4.');
  }

  /**
   * Performs a maneuver with the given thrust.
   * @param maneuver - The thrust maneuver to perform.
   * @param interval - The time interval for the maneuver (default: 60.0 seconds).
   * @throws Error if maneuvers cannot be modeled with SGP4.
   */
  maneuver(_maneuver: Thrust, _interval = 60.0): J2000[] {
    throw new Error('Maneuvers cannot be modelled with SGP4.');
  }

  /**
   * Propagates the state to a specified epoch in J2000 coordinates.
   * @param epoch - The epoch in UTC format.
   * @returns The propagated state in J2000 coordinates.
   */
  propagate(epoch: EpochUTC): J2000 {
    const state = this.wasm_.propagateEpoch(this.satKey_, epoch);

    if (state.err !== 0) {
      throw new Sgp4WasmError(`SGP4 propagation failed for satKey ${this.satKey_} (code ${state.err})`, state.err);
    }

    this.cacheState_ = new TEME(epoch, state.position, state.velocity).toJ2000();

    return this.cacheState_;
  }

  /**
   * Resets the state of the propagator to the TLE epoch state.
   */
  reset(): void {
    this.cacheState_ = this.propagate(this.tle_.epoch);
  }

  /**
   * Saves the current state of the propagator and returns the index of the checkpoint.
   * @returns The index of the checkpoint.
   */
  checkpoint(): number {
    this.checkpoints_.push(this.cacheState_);

    return this.checkpoints_.length - 1;
  }

  /**
   * Clears all the checkpoints in the propagator.
   */
  clearCheckpoints(): void {
    this.checkpoints_ = [];
  }

  /**
   * Restores the state of the propagator to a previously saved checkpoint.
   * @param index - The index of the checkpoint to restore.
   */
  restore(index: number): void {
    this.cacheState_ = this.checkpoints_[index];
  }

  /**
   * Removes the satellite from the backing wasm instance's SGP4 and TLE
   * registries.
   */
  dispose(): void {
    this.wasm_.uninitSats([this.satKey_]);
    this.wasm_.removeSats([this.satKey_]);
  }
}
