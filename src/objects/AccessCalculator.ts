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
import { Degrees, Kilometers, Meters, RaeVec3 } from '../types/types';
import { AccessWindow, type AccessConstraints, type AccessState } from './AccessWindow';
import type { GroundObject } from './GroundObject';
import type { SpaceObject } from './SpaceObject';

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

  /** Prevent instantiation */
  private constructor() {
    // Static utility class
  }

  /**
   * Calculates all access windows between a ground observer and a space object
   * within a specified time interval.
   *
   * @param observer - The ground-based observer
   * @param target - The space object to track
   * @param start - Start of the search interval
   * @param end - End of the search interval
   * @param constraints - Optional visibility constraints
   * @param stepMs - Time step in milliseconds (default: 10000)
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

    // Initialize state
    const state: AccessState = {
      isInAccess: false,
      windowStart: null,
      maxEl: 0 as Degrees,
      maxElTime: null,
      rangeAtMaxEl: 0 as Kilometers,
    };

    // Check visibility 1 step before start for initial state detection
    const preStartTime = new Date(startTime - stepMs);
    const preStartRae = AccessCalculator.getRae_(target, observer, preStartTime);

    if (preStartRae && AccessCalculator.isAccessible_(preStartRae, target, observer, preStartTime, constraints)) {
      state.isInAccess = true;
      state.windowStart = start; // Window started before our interval
      state.maxEl = preStartRae.el;
      state.maxElTime = preStartTime;
      state.rangeAtMaxEl = preStartRae.rng;
    }

    // Main loop through time interval
    for (let timeMs = startTime; timeMs <= endTime; timeMs += stepMs) {
      const curTime = new Date(timeMs);
      const rae = AccessCalculator.getRae_(target, observer, curTime);

      if (!rae) {
        // Propagation failed - treat as not accessible
        if (state.isInAccess) {
          // End current window
          windows.push(AccessCalculator.createWindow_(state, curTime, observer, target));
          AccessCalculator.resetState_(state);
        }
        continue;
      }

      const isAccessible = AccessCalculator.isAccessible_(rae, target, observer, curTime, constraints);

      if (!state.isInAccess && isAccessible) {
        // Entering access window
        state.isInAccess = true;
        state.windowStart = curTime;
        state.maxEl = rae.el;
        state.maxElTime = curTime;
        state.rangeAtMaxEl = rae.rng;
      } else if (state.isInAccess && !isAccessible) {
        // Exiting access window
        windows.push(AccessCalculator.createWindow_(state, curTime, observer, target));
        AccessCalculator.resetState_(state);
      } else if (state.isInAccess) {
        // Still in access - track max elevation
        if (rae.el > state.maxEl) {
          state.maxEl = rae.el;
          state.maxElTime = curTime;
          state.rangeAtMaxEl = rae.rng;
        }
      }
    }

    // Handle open window at end of interval
    if (state.isInAccess && state.windowStart) {
      windows.push(AccessCalculator.createWindow_(state, end, observer, target));
    }

    return windows;
  }

  /**
   * Finds the next access window after a specified time.
   *
   * @param observer - The ground-based observer
   * @param target - The space object to track
   * @param after - Search for windows starting after this time
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
    const endTime = new Date(after.getTime() + maxSearchDays * AccessCalculator.MS_PER_DAY_);
    const windows = AccessCalculator.calculateAccess(observer, target, after, endTime, constraints);

    // Return first window that starts after the specified time
    // (handles case where we're in the middle of a pass)
    for (const window of windows) {
      if (window.start.getTime() > after.getTime()) {
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

    if (!ecef) {
      return null;
    }

    return ecef2rae(observer.lla(), ecef);
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
      const eci = target.eci(date);

      if (!eci) {
        return false;
      }
      const epoch = EpochUTC.fromDateTime(date);
      const satPos = new Vector3D<Kilometers>(
        eci.position.x,
        eci.position.y,
        eci.position.z,
      );

      if (Sun.shadow(epoch, satPos)) {
        return false;
      }
    }

    // 4. Observer darkness check (for optical observations)
    if (constraints.requireObserverDark) {
      const lla = observer.lla();
      // Convert altitude from km to meters for getTimes
      const altMeters = (lla.alt * 1000) as Meters;
      const sunTimes = Sun.getTimes(date, lla.lat, lla.lon, altMeters);

      // Check if current time is during nighttime (after sunset, before sunrise)
      // Using civil dusk/dawn as the threshold for darkness
      const currentTime = date.getTime();
      const civilDusk = sunTimes.civilDusk?.getTime();
      const civilDawn = sunTimes.civilDawn?.getTime();

      if (civilDusk && civilDawn) {
        // During the night, civilDusk < current < civilDawn (next day)
        // OR civilDawn (same day) < current < civilDusk
        // Simpler: observer is in light if between dawn and dusk
        if (currentTime >= civilDawn && currentTime <= civilDusk) {
          return false; // Observer is in daylight
        }
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
