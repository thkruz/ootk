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

import { Thrust } from '../force/Thrust.js';
import { VerletBlendInterpolator } from '../interpolator/VerletBlendInterpolator.js';
import { ClassicalElements, EpochUTC, J2000, Seconds } from '../main.js';
import { Propagator } from './Propagator.js';

// / Kepler analytical two-body propagator.
export class KeplerPropagator extends Propagator {
  private _initElements: ClassicalElements;
  private _elements: ClassicalElements;
  private _cacheState: J2000;
  private _checkpoints: J2000[];

  constructor(initElements: ClassicalElements) {
    super();
    this._initElements = initElements;
    this._elements = initElements;
    this._cacheState = J2000.fromClassicalElements(initElements);
    this._checkpoints = [];
  }

  get state(): J2000 {
    return this._cacheState;
  }

  propagate(epoch: EpochUTC): J2000 {
    this._cacheState = J2000.fromClassicalElements(this._elements.propagate(epoch));

    return this._cacheState;
  }

  reset(): void {
    this._elements = this._initElements;
    this._cacheState = J2000.fromClassicalElements(this._elements);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  maneuver(maneuver: Thrust, interval = 60): J2000[] {
    this._cacheState = maneuver.apply(this.propagate(maneuver.center));
    this._elements = this._cacheState.toClassicalElements();

    return [this._cacheState];
  }

  ephemerisManeuver(start: EpochUTC, finish: EpochUTC, maneuvers: Thrust[], interval = 60.0): VerletBlendInterpolator {
    const tMvr = maneuvers.slice(0).filter((mvr) => mvr.center >= start || mvr.center <= finish);
    const ephemeris: J2000[] = [];

    if (tMvr[0].start > start) {
      ephemeris.push(this.propagate(start));
    }
    for (const mvr of tMvr) {
      while (this._cacheState.epoch < mvr.center) {
        const step = Math.min(mvr.center.difference(this._cacheState.epoch), interval) as Seconds;

        this.propagate(this._cacheState.epoch.roll(step));
        if (this._cacheState.epoch.posix !== mvr.center.posix) {
          ephemeris.push(this._cacheState);
        }
      }
      ephemeris.push(...this.maneuver(mvr, interval));
    }
    while (this._cacheState.epoch < finish) {
      const step = Math.min(finish.difference(this._cacheState.epoch), interval) as Seconds;

      this.propagate(this._cacheState.epoch.roll(step));
      ephemeris.push(this._cacheState);
    }

    return new VerletBlendInterpolator(ephemeris);
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
