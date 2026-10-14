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

import { Sun } from '../body/SunBody';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { ecef2rae } from '../transforms/transforms';
import { Degrees, Kilometers, RaeVec3 } from '../types/types';
import { AccessWindow, type AccessConstraints, type AccessState } from './AccessWindow';
import type { GroundObject } from './GroundObject';
import type { SpaceObject } from './SpaceObject';

/** Sun elevation (deg, centre, no refraction) below which the observer counts as dark. */
const CIVIL_TWILIGHT_DEG = -6;

/**
 * Static utility class for calculating access windows between
 * ground observers and space objects.
 *
 * An access window is a period during which a space object is visible
 * from a ground observer, subject to optional constraints such as
 * minimum elevation, range limits, and illumination requirements.
 *
 * @example
 * ```typescript
 * // Find all passes over 24 hours
 * const windows = AccessCalculator.calculateAccess(
 *   groundStation,
 *   satellite,
 *   new Date(),
 *   new Date(Date.now() + 86400000)
 * );
 *
 * // Find next pass with constraints
 * const nextPass = AccessCalculator.getNextAccess(
 *   groundStation,
 *   satellite,
 *   new Date(),
 *   { minElevation: 10 as Degrees, requireSunlit: true }
 * );
 * ```
 */
export class AccessCalculator {
  /** Default calculation time step in milliseconds (10 seconds) */
  private static readonly DEFAULT_STEP_MS_ = 10000;

  /** Default max search duration in days */
  private static readonly DEFAULT_MAX_SEARCH_DAYS_ = 7;

  /** Milliseconds per day */
  private static readonly MS_PER_DAY_ = 86400000;

  /** Resolution (ms) to which rise and set edges are bisected after the coarse step brackets them. */
  static readonly EDGE_RESOLUTION_MS = 1;

  /** Prevent instantiation */
  private constructor() {
    // Static utility class
  }

  /**
   * Calculates all access windows between a ground observer and a space object
   * within a specified time interval.
   *
   * The interval is sampled every `stepMs` (the coarse step). Whenever two consecutive samples
   * differ in accessibility, the rise or set instant between them is located by bisection to
   * {@link EDGE_RESOLUTION_MS} (1 ms), so window edges are not late by up to a step. A pass
   * shorter than `stepMs` that falls entirely between two samples can still be missed; reduce
   * `stepMs` to catch it.
   *
   * Window `start` is the first accessible millisecond (or `start` itself when the target is
   * already accessible at `start`) and `end` is the first millisecond at which it is no longer
   * accessible (or `end` itself when the pass is still in progress at `end`), so `duration` is
   * end - start in ms. `maxElevation` / `maxElevationTime` are the highest coarse sample (or edge)
   * inside the window, so they always lie within [start, end].
   *
   * @param observer - The ground-based observer; a moving observer is evaluated at each instant via `llaAt`
   * @param target - The space object to track
   * @param start - Start of the search interval
   * @param end - End of the search interval
   * @param constraints - Optional visibility constraints
   * @param stepMs - Coarse sampling step in milliseconds (default: 10000); edges are then refined to 1 ms
   * @returns Array of access windows found within the interval
   */
  static calculateAccess(
    observer: GroundObject,
    target: SpaceObject,
    start: Date,
    end: Date,
    constraints: AccessConstraints = {},
    stepMs: number = AccessCalculator.DEFAULT_STEP_MS_,
  ): AccessWindow[] {
    const windows: AccessWindow[] = [];
    const startTime = start.getTime();
    const endTime = end.getTime();

    if (!(stepMs > 0) || endTime < startTime) {
      return windows;
    }

    const state: AccessState = {
      isInAccess: false,
      windowStart: null,
      maxEl: 0 as Degrees,
      maxElTime: null,
      rangeAtMaxEl: 0 as Kilometers,
    };

    let prevTimeMs = startTime;

    for (let timeMs = startTime; ; timeMs = Math.min(timeMs + stepMs, endTime)) {
      const curTime = new Date(timeMs);
      const rae = AccessCalculator.getRae_(target, observer, curTime);
      const isAccessible = rae !== null && AccessCalculator.isAccessible_(rae, target, observer, curTime, constraints);

      if (!state.isInAccess && isAccessible) {
        // Rise: the first sample of the interval opens the window at `start`; otherwise bisect
        // between the last inaccessible sample and this one.
        const riseMs = timeMs === startTime
          ? startTime
          : AccessCalculator.findEdge_(observer, target, constraints, prevTimeMs, timeMs, false);

        AccessCalculator.openWindow_(state, observer, target, riseMs, rae, curTime);
      } else if (state.isInAccess && !isAccessible) {
        // Set: bisect between the last accessible sample and this one.
        const setMs = AccessCalculator.findEdge_(observer, target, constraints, prevTimeMs, timeMs, true);

        windows.push(AccessCalculator.createWindow_(state, new Date(setMs), observer, target));
        AccessCalculator.resetState_(state);
      } else if (state.isInAccess && rae && rae.el > state.maxEl) {
        state.maxEl = rae.el;
        state.maxElTime = curTime;
        state.rangeAtMaxEl = rae.rng;
      }

      prevTimeMs = timeMs;

      if (timeMs >= endTime) {
        break;
      }
    }

    // Handle open window at end of interval
    if (state.isInAccess && state.windowStart) {
      windows.push(AccessCalculator.createWindow_(state, end, observer, target));
    }

    return windows;
  }

  /**
   * Finds the next access window that begins at or after a specified time.
   *
   * A pass that rises exactly at `after` is returned. A pass already in progress at `after`
   * (the target is accessible 1 ms before `after`) is skipped, and the next one is returned.
   *
   * @param observer - The ground-based observer
   * @param target - The space object to track
   * @param after - Search for windows starting at or after this time
   * @param constraints - Optional visibility constraints
   * @param maxSearchDays - Maximum number of days to search (default: 7)
   * @returns The next access window, or null if none found within search period
   */
  static getNextAccess(
    observer: GroundObject,
    target: SpaceObject,
    after: Date,
    constraints: AccessConstraints = {},
    maxSearchDays: number = AccessCalculator.DEFAULT_MAX_SEARCH_DAYS_,
  ): AccessWindow | null {
    const afterMs = after.getTime();
    const endTime = new Date(afterMs + maxSearchDays * AccessCalculator.MS_PER_DAY_);
    const windows = AccessCalculator.calculateAccess(observer, target, after, endTime, constraints);

    for (const window of windows) {
      const windowStartMs = window.start.getTime();

      if (windowStartMs > afterMs) {
        return window;
      }

      // A window clipped to `after`: it rises exactly at `after` only if the target was not
      // accessible one edge resolution earlier; otherwise the pass is already in progress.
      if (windowStartMs === afterMs && !AccessCalculator.isAccessibleAt_(observer, target, constraints, afterMs - AccessCalculator.EDGE_RESOLUTION_MS)) {
        return window;
      }
    }

    return null;
  }

  /**
   * Calculates access windows for multiple targets from a single observer.
   *
   * @param observer - The ground-based observer
   * @param targets - Array of space objects to track
   * @param start - Start of the search interval
   * @param end - End of the search interval
   * @param constraints - Optional visibility constraints (applied to all targets)
   * @returns Map from target ID to array of access windows
   */
  static calculateMultiTargetAccess(
    observer: GroundObject,
    targets: SpaceObject[],
    start: Date,
    end: Date,
    constraints: AccessConstraints = {},
  ): Map<number, AccessWindow[]> {
    const results = new Map<number, AccessWindow[]>();

    for (const target of targets) {
      const windows = AccessCalculator.calculateAccess(observer, target, start, end, constraints);

      results.set(target.id, windows);
    }

    return results;
  }

  /**
   * Gets the Range-Azimuth-Elevation from observer to target at the given time.
   * @internal
   */
  private static getRae_(
    target: SpaceObject,
    observer: GroundObject,
    date: Date,
  ): RaeVec3<Kilometers, Degrees> | null {
    const ecef = target.ecef(date);
    const observerLla = observer.llaAt(date);

    if (!ecef || !observerLla) {
      return null;
    }

    return ecef2rae(observerLla, ecef);
  }

  /**
   * True if the target is accessible at `timeMs` (propagation failure counts as not accessible).
   * @internal
   */
  private static isAccessibleAt_(
    observer: GroundObject,
    target: SpaceObject,
    constraints: AccessConstraints,
    timeMs: number,
  ): boolean {
    const date = new Date(timeMs);
    const rae = AccessCalculator.getRae_(target, observer, date);

    return rae !== null && AccessCalculator.isAccessible_(rae, target, observer, date, constraints);
  }

  /**
   * Bisects the accessibility transition between two samples to {@link EDGE_RESOLUTION_MS}.
   *
   * `loMs` has accessibility `wasAccessible` and `hiMs` the opposite. The bracket is halved on
   * whole milliseconds until hiMs - loMs <= 1 ms, and the first millisecond with the new state
   * (`hiMs`) is returned: the rise time for a rise, the first inaccessible instant for a set.
   * @internal
   */
  private static findEdge_(
    observer: GroundObject,
    target: SpaceObject,
    constraints: AccessConstraints,
    loMs: number,
    hiMs: number,
    wasAccessible: boolean,
  ): number {
    let lo = loMs;
    let hi = hiMs;

    while (hi - lo > AccessCalculator.EDGE_RESOLUTION_MS) {
      const mid = Math.floor((lo + hi) / 2);

      if (AccessCalculator.isAccessibleAt_(observer, target, constraints, mid) === wasAccessible) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    return hi;
  }

  /**
   * Opens a window at `riseMs`. The maximum elevation starts from the rise instant when it can
   * be evaluated, and from the triggering sample otherwise.
   * @internal
   */
  private static openWindow_(
    state: AccessState,
    observer: GroundObject,
    target: SpaceObject,
    riseMs: number,
    sampleRae: RaeVec3<Kilometers, Degrees> | null,
    sampleTime: Date,
  ): void {
    state.isInAccess = true;
    state.windowStart = new Date(riseMs);

    const riseRae = riseMs === sampleTime.getTime() ? sampleRae : AccessCalculator.getRae_(target, observer, new Date(riseMs));

    if (riseRae && sampleRae && riseRae.el > sampleRae.el) {
      state.maxEl = riseRae.el;
      state.maxElTime = new Date(riseMs);
      state.rangeAtMaxEl = riseRae.rng;
    } else if (sampleRae) {
      state.maxEl = sampleRae.el;
      state.maxElTime = sampleTime;
      state.rangeAtMaxEl = sampleRae.rng;
    }
  }

  /**
   * Checks if the current observation meets all constraints.
   * @internal
   */
  private static isAccessible_(
    rae: RaeVec3<Kilometers, Degrees>,
    target: SpaceObject,
    observer: GroundObject,
    date: Date,
    constraints: AccessConstraints,
  ): boolean {
    // 1. Elevation check (default: 0°)
    const minEl = constraints.minElevation ?? (0 as Degrees);

    if (rae.el < minEl) {
      return false;
    }

    // 2. Range checks
    if (constraints.maxRange !== undefined && rae.rng > constraints.maxRange) {
      return false;
    }
    if (constraints.minRange !== undefined && rae.rng < constraints.minRange) {
      return false;
    }

    // 3. Sunlit check (requires target to be illuminated by Sun)
    if (constraints.requireSunlit) {
      // Sun.shadow() compares against the J2000 Sun, so the target must be in J2000 too
      // (TEME is ~0.3 deg away in 2026, a few seconds of shadow-entry error in LEO).
      let satPos: Vector3D<Kilometers>;

      try {
        satPos = target.toJ2000(date).position;
      } catch {
        return false;
      }
      const epoch = EpochUTC.fromDateTime(date);

      if (Sun.shadow(epoch, satPos)) {
        return false;
      }
    }

    // 4. Observer darkness check (for optical observations)
    if (constraints.requireObserverDark) {
      // Dark = Sun's centre below civil twilight (-6 deg) at the site, at this instant.
      // (The earlier dawn/dusk lookup via Sun.getTimes moved `date` to local noon, so this
      // check reported daylight for every pass.)
      if (Sun.getAzEl(observer, date, false).el >= CIVIL_TWILIGHT_DEG) {
        return false;
      }
    }

    return true;
  }

  /**
   * Creates an AccessWindow from the current state.
   * @internal
   */
  private static createWindow_(
    state: AccessState,
    endTime: Date,
    observer: GroundObject,
    target: SpaceObject,
  ): AccessWindow {
    const start = state.windowStart!;
    const duration = endTime.getTime() - start.getTime();

    return new AccessWindow({
      start,
      end: endTime,
      duration,
      maxElevation: state.maxEl,
      maxElevationTime: state.maxElTime!,
      rangeAtMaxEl: state.rangeAtMaxEl,
      observer,
      target,
    });
  }

  /**
   * Resets the state for tracking a new access window.
   * @internal
   */
  private static resetState_(state: AccessState): void {
    state.isInAccess = false;
    state.windowStart = null;
    state.maxEl = 0 as Degrees;
    state.maxElTime = null;
    state.rangeAtMaxEl = 0 as Kilometers;
  }
}
