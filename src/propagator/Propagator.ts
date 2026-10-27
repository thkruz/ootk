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
import { EpochUTC } from '../time/EpochUTC';
import { J2000 } from '../coordinate/J2000';
import { Seconds } from '../types/types';
import { PropagationError } from '../errors';
import { GoldenSection } from './../optimize/GoldenSection';

// Propagator base class.
export abstract class Propagator {
  // Propagate state to the provided [epoch].
  abstract propagate(epoch: EpochUTC): J2000;

  /**
   * Sample epochs from [start] to [stop] inclusive on a fixed [interval] grid.
   *
   * Samples are `start + k * interval` for every k with `start + k * interval < stop`, followed by
   * `stop` itself, so the last sample is exactly `stop` and never one interval past it. Each
   * sample is computed from `start` directly (not by repeated rolling) so rounding does not
   * accumulate. When `stop` does not follow `start` the result is the single epoch `start`.
   * @param start First epoch.
   * @param stop Last epoch.
   * @param interval Grid spacing in seconds (must be positive).
   * @returns Ascending list of sample epochs.
   */
  protected static sampleEpochs_(start: EpochUTC, stop: EpochUTC, interval: Seconds): EpochUTC[] {
    const span = stop.posix - start.posix;

    if (!(interval > 0) || span <= 0) {
      return [start];
    }

    // Treat a grid point within 1 microsecond of stop as stop itself.
    const tolerance = 1e-6;
    const epochs: EpochUTC[] = [start];

    for (let k = 1; k * interval < span - tolerance; k++) {
      epochs.push(start.roll(k * interval as Seconds));
    }
    epochs.push(stop);

    return epochs;
  }

  /**
   * Generate a [VerletBlendInterpolator] containing ephemeris over the [start] to [stop]
   * propagation period, sampled every [interval] seconds. The first sample is at [start] and
   * the last is exactly at [stop] (the final step is shortened when the span is not a whole
   * multiple of the interval).
   * @param start Ephemeris start epoch.
   * @param stop Ephemeris stop epoch.
   * @param interval Sample spacing in seconds (default 60).
   * @returns Interpolator whose window is [start, stop].
   */
  ephemeris(start: EpochUTC, stop: EpochUTC, interval = 60.0 as Seconds): VerletBlendInterpolator {
    const output = Propagator.sampleEpochs_(start, stop, interval).map((epoch) => this.propagate(epoch));

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

  /**
   * Generate a list of [J2000] states sampled across a maneuver, from its start to its stop
   * epoch every [interval] seconds, with the last sample exactly at the stop epoch.
   *
   * If the maneuver is impulsive (start equals stop), the list contains a single state.
   * This base implementation does not apply the thrust; numerical propagators override it.
   * @param maneuver Maneuver to sample.
   * @param interval Sample spacing in seconds (default 60).
   * @returns States across the maneuver.
   */
  maneuver(maneuver: Thrust, interval = 60.0 as Seconds): J2000[] {
    return Propagator.sampleEpochs_(maneuver.start, maneuver.stop, interval).map((epoch) => this.propagate(epoch));
  }

  /**
   * Generate a [VerletBlendInterpolator] containing ephemeris over the [start] to [finish]
   * interval, sampled every [interval] seconds with the last sample exactly at [finish].
   * This base implementation ignores the maneuvers; numerical propagators override it.
   * @param start Ephemeris start epoch.
   * @param finish Ephemeris stop epoch.
   * @param _maneuvers Maneuvers (ignored by the base class).
   * @param interval Sample spacing in seconds (default 60).
   * @returns Interpolator whose window is [start, finish].
   */
  ephemerisManeuver(
    start: EpochUTC,
    finish: EpochUTC,
    _maneuvers: Thrust[],
    interval = 60.0 as Seconds,
  ): VerletBlendInterpolator {
    return this.ephemeris(start, finish, interval);
  }

  /**
   * Coarse-scan one orbital period after [start] in eighths for an equator crossing in the
   * requested direction, then refine it with a golden-section search on |z|.
   * @param start Search start epoch.
   * @param ascending True for the ascending node (z goes from negative to positive).
   * @returns Node epoch.
   * @throws {PropagationError} When no crossing in that direction occurs within the scan
   *   (for example an equatorial orbit, where z never changes sign).
   */
  private nodeEpoch_(start: EpochUTC, ascending: boolean): EpochUTC {
    this.propagate(start);
    // StateVector.period is in MINUTES; convert to seconds before rolling epochs.
    const period = this.state.period * 60 as Seconds;
    const step = period / 8 as Seconds;
    let previous = this.state.position.z;
    let current = start;
    let found = false;

    // One extra step past a full period so a node exactly at start + period is still found.
    for (let k = 1; k <= 9; k++) {
      current = start.roll(k * step as Seconds);
      this.propagate(current);
      const z = this.state.position.z;
      const crossed = ascending ? previous < 0 && z >= 0 : previous > 0 && z <= 0;

      if (crossed) {
        found = true;
        break;
      }
      previous = z;
    }

    /*
     * Without a sign change the golden-section search below would return the |z| minimum of the
     * last slice, an epoch that is not a node at all (v7 did that for equatorial orbits).
     */
    if (!found) {
      throw new PropagationError(
        `No ${ascending ? 'ascending' : 'descending'} node within one period after ${start.toString()}: ` +
        'the orbit does not cross the equator (equatorial orbit?)',
        start.toDateTime(),
      );
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

  /**
   * Return the epoch of the first ascending node (equator crossing heading north, z from
   * negative to positive in J2000) within one orbital period after [start].
   * @param start Search start epoch.
   * @returns Ascending node epoch, refined to about 1 ms.
   * @throws {PropagationError} When the orbit has no ascending node (equatorial orbit).
   */
  ascendingNodeEpoch(start: EpochUTC): EpochUTC {
    return this.nodeEpoch_(start, true);
  }

  /**
   * Return the epoch of the first descending node (equator crossing heading south, z from
   * positive to negative in J2000) within one orbital period after [start].
   * @param start Search start epoch.
   * @returns Descending node epoch, refined to about 1 ms.
   * @throws {PropagationError} When the orbit has no descending node (equatorial orbit).
   */
  descendingNodeEpoch(start: EpochUTC): EpochUTC {
    return this.nodeEpoch_(start, false);
  }

  /**
   * Split one orbital period after [start] into eight slices, golden-section search each slice
   * for an extremum of the radius, and keep the best.
   * @param start Search start epoch.
   * @param solveMax True for the maximum radius (apogee), false for the minimum (perigee).
   * @returns Epoch of the extremum.
   */
  private apsisEpoch_(start: EpochUTC, solveMax: boolean): EpochUTC {
    const slice = 8;

    this.propagate(start);
    // StateVector.period is in MINUTES; convert to seconds before rolling epochs.
    const period = this.state.period * 60 as Seconds;
    const step = period / slice as Seconds;
    let tCache = start;
    let rCache = this.state.position.magnitude();

    for (let i = 1; i <= slice; i++) {
      const sliceEnd = start.roll(i * step as Seconds);
      const t = new EpochUTC(
        GoldenSection.search(
          (x: number) => {
            this.propagate(new EpochUTC(x as Seconds));

            return this.state.position.magnitude();
          },
          sliceEnd.posix - step,
          sliceEnd.posix,
          { tolerance: 1e-3, solveMax },
        ) as Seconds,
      );

      this.propagate(t);
      const r = this.state.position.magnitude();

      if (solveMax ? r > rCache : r < rCache) {
        tCache = t;
        rCache = r;
      }
    }

    return tCache;
  }

  /**
   * Return the epoch of apogee (maximum geocentric radius) within one orbital period after
   * [start].
   * @param start Search start epoch.
   * @returns Apogee epoch, refined to about 1 ms.
   */
  apogeeEpoch(start: EpochUTC): EpochUTC {
    return this.apsisEpoch_(start, true);
  }

  /**
   * Return the epoch of perigee (minimum geocentric radius) within one orbital period after
   * [start].
   * @param start Search start epoch.
   * @returns Perigee epoch, refined to about 1 ms.
   */
  perigeeEpoch(start: EpochUTC): EpochUTC {
    return this.apsisEpoch_(start, false);
  }
}
