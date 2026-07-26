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

import { Thrust } from '../force/Thrust';
import { VerletBlendInterpolator } from '../interpolator/VerletBlendInterpolator';
import { ClassicalElements } from '../coordinate/ClassicalElements';
import { EpochUTC } from '../time/EpochUTC';
import { J2000 } from '../coordinate/J2000';
import { Seconds } from '../types/types';
import { Propagator } from './Propagator';

// / Kepler analytical two-body propagator.
export class KeplerPropagator extends Propagator {
  private readonly initElements_: ClassicalElements;
  private elements_: ClassicalElements;
  private cacheState_: J2000;
  private checkpoints_: J2000[];

  constructor(initElements: ClassicalElements) {
    super();
    this.initElements_ = initElements;
    this.elements_ = initElements;
    this.cacheState_ = J2000.fromClassicalElements(initElements);
    this.checkpoints_ = [];
  }

  get state(): J2000 {
    return this.cacheState_;
  }

  propagate(epoch: EpochUTC): J2000 {
    this.cacheState_ = J2000.fromClassicalElements(this.elements_.propagate(epoch));

    return this.cacheState_;
  }

  reset(): void {
    this.elements_ = this.initElements_;
    this.cacheState_ = J2000.fromClassicalElements(this.elements_);
  }

  maneuver(maneuver: Thrust): J2000[] {
    this.cacheState_ = maneuver.apply(this.propagate(maneuver.center));
    this.elements_ = this.cacheState_.toClassicalElements();

    return [this.cacheState_];
  }

  ephemerisManeuver(start: EpochUTC, finish: EpochUTC, maneuvers: Thrust[], interval = 60.0): VerletBlendInterpolator {
    // Compare raw POSIX seconds; relational operators on Epoch objects coerce via toISOString().
    const tMvr = maneuvers.slice(0).filter((mvr) => mvr.center.posix >= start.posix || mvr.center.posix <= finish.posix);
    const ephemeris: J2000[] = [];

    if (tMvr[0].start.posix > start.posix) {
      ephemeris.push(this.propagate(start));
    }
    for (const mvr of tMvr) {
      while (this.cacheState_.epoch.posix < mvr.center.posix) {
        const step = Math.min(mvr.center.difference(this.cacheState_.epoch), interval) as Seconds;

        this.propagate(this.cacheState_.epoch.roll(step));
        if (this.cacheState_.epoch.posix !== mvr.center.posix) {
          ephemeris.push(this.cacheState_);
        }
      }
      ephemeris.push(...this.maneuver(mvr));
    }
    while (this.cacheState_.epoch.posix < finish.posix) {
      const step = Math.min(finish.difference(this.cacheState_.epoch), interval) as Seconds;

      this.propagate(this.cacheState_.epoch.roll(step));
      ephemeris.push(this.cacheState_);
    }

    return new VerletBlendInterpolator(ephemeris);
  }

  checkpoint(): number {
    this.checkpoints_.push(this.cacheState_);

    return this.checkpoints_.length - 1;
  }

  clearCheckpoints(): void {
    this.checkpoints_ = [];
  }

  restore(index: number): void {
    this.cacheState_ = this.checkpoints_[index];
  }
}
