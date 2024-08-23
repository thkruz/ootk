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
import { EpochUTC, J2000, Seconds } from '../main.js';
import { GoldenSection } from './../optimize/GoldenSection.js';

// Propagator base class.
export abstract class Propagator {
  // Propagate state to the provided [epoch].
  abstract propagate(epoch: EpochUTC): J2000;

  /*
   * Generate a [VerletBlendInterpolator] containing ephemeris over the
   * [start] and [stop] propagation period, with an optional
   * ephemeris [interval].
   */
  ephemeris(start: EpochUTC, stop: EpochUTC, interval = 60.0 as Seconds): VerletBlendInterpolator {
    const output: J2000[] = [this.propagate(start)];
    let tempEpoch = start;

    while (tempEpoch <= stop) {
      tempEpoch = tempEpoch.roll(interval);
      output.push(this.propagate(tempEpoch));
    }

    return new VerletBlendInterpolator(output);
  }

  /*
   * Reset cached propagator state to its initial value.
   *
   * This will clear any post-maneuver states in the propagator.
   */
  abstract reset(): void;

  /*
   * Store a checkpoint of this propagator's current state, and return the
   * checkpoint index that can be used to [restore] the propagator state
   * later.
   */
  abstract checkpoint(): number;

  // Restore a state [checkpoint] at the provided index.
  abstract restore(index: number): void;

  // Remove any stored [checkpoint] values from this propagator.
  abstract clearCheckpoints(): void;

  // Return the last propagated state.
  abstract get state(): J2000;

  /*
   * Generate a list of [J2000] states integrating over a maneuver.
   *
   * If the maneuver is impulsive, the list will only contain a single state.
   */
  maneuver(maneuver: Thrust, interval = 60.0 as Seconds): J2000[] {
    const output: J2000[] = [];
    const tempEpoch = maneuver.start;
    const stop = maneuver.stop;

    output.push(this.propagate(tempEpoch));
    let current = tempEpoch;

    while (current <= stop) {
      current = current.roll(interval);
      output.push(this.propagate(current));
    }

    return output;
  }

  /*
   * Generate a [VerletBlendInterpolator] containing maneuver ephemeris over
   * the [start] and [finish] interval, with an optional ephemeris [interval].
   */
  ephemerisManeuver(
    start: EpochUTC,
    finish: EpochUTC,
    maneuvers: Thrust[],
    interval = 60.0 as Seconds,
  ): VerletBlendInterpolator {
    const output: J2000[] = [];
    const tempEpoch = start;

    output.push(this.propagate(tempEpoch));
    const stop = finish;
    let current = tempEpoch;

    while (current <= stop) {
      current = current.roll(interval);
      output.push(this.propagate(current));
    }

    return new VerletBlendInterpolator(output);
  }

  // Return the epoch of the ascending node after the [start] epoch.
  ascendingNodeEpoch(start: EpochUTC): EpochUTC {
    const period = this.state.period / 60 as Seconds;
    const step = period / 8 as Seconds;
    let current = start;
    const stop = current.roll(period);

    this.propagate(current);
    let previous = this.state.position.z;

    while (current <= stop) {
      current = current.roll(step);
      this.propagate(current);
      if (Math.sign(this.state.position.z) === Math.sign(-previous) && this.state.velocity.z > 0) {
        break;
      }
      previous = this.state.position.z;
    }
    const t = GoldenSection.search(
      (x) => {
        this.propagate(new EpochUTC(x as Seconds));

        return Math.abs(this.state.position.z) as Seconds;
      },
      current.posix - step,
      current.posix,
      { tolerance: 1e-3 },
    ) as Seconds;

    return new EpochUTC(t);
  }

  // Return the epoch of the descending node after the [start] epoch.
  descendingNodeEpoch(start: EpochUTC): EpochUTC {
    const period = this.state.period / 60 as Seconds;
    const step = period / 8 as Seconds;
    let current = start;
    const stop = current.roll(period);

    this.propagate(current);
    let previous = this.state.position.z;

    while (current <= stop) {
      current = current.roll(step);
      this.propagate(current);
      if (Math.sign(this.state.position.z) === Math.sign(-previous) && this.state.velocity.z < 0) {
        break;
      }
      previous = this.state.position.z;
    }
    const t = GoldenSection.search(
      (x: number) => {
        this.propagate(new EpochUTC(x as Seconds));

        return Math.abs(this.state.position.z);
      },
      current.posix - step,
      current.posix,
      { tolerance: 1e-3 },
    ) as Seconds;

    return new EpochUTC(t);
  }

  // Return the epoch of apogee after the [start] epoch.
  apogeeEpoch(start: EpochUTC): EpochUTC {
    const slice = 8;
    const period = this.state.period / 60 as Seconds;
    const step = period / slice as Seconds;
    let current = start;

    this.propagate(current);
    let tCache = current;
    let rCache = this.state.position.magnitude();

    for (let i = 0; i < slice; i++) {
      current = current.roll(step);
      const t = new EpochUTC(
        GoldenSection.search(
          (x: number) => {
            this.propagate(new EpochUTC(x as Seconds));

            return this.state.position.magnitude();
          },
          current.posix - step,
          current.posix,
          { tolerance: 1e-3, solveMax: true },
        ) as Seconds,
      );

      this.propagate(t);
      const r = this.state.position.magnitude();

      if (r > rCache) {
        tCache = t;
        rCache = r;
      }
    }

    return tCache;
  }

  // Return the epoch of perigee after the [start] epoch.
  perigeeEpoch(start: EpochUTC): EpochUTC {
    const slice = 8;
    const period = this.state.period / 60 as Seconds;
    const step = period / slice as Seconds;
    let current = start;

    this.propagate(current);
    let tCache = current;
    let rCache = this.state.position.magnitude();

    for (let i = 0; i < slice; i++) {
      current = current.roll(step);
      const t = new EpochUTC(
        GoldenSection.search(
          (x: number) => {
            this.propagate(new EpochUTC(x as Seconds));

            return this.state.position.magnitude();
          },
          current.posix - step,
          current.posix,
          { tolerance: 1e-3, solveMax: false },
        ) as Seconds,
      );

      this.propagate(t);
      const r = this.state.position.magnitude();

      if (r < rCache) {
        tCache = t;
        rCache = r;
      }
    }

    return tCache;
  }
}
