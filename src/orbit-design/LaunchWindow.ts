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

import { Sgp4 } from '../sgp4/sgp4';
import { jday } from '../transforms';
import { Degrees, SatelliteRecord } from '../types/types';
import { DEG2RAD, MILLISECONDS_TO_DAYS, MINUTES_PER_DAY, RAD2DEG } from '../utils/constants';

/** Options for {@link LaunchWindowFinder}. */
export interface LaunchWindowOptions {
  /** Launch site geodetic latitude. */
  siteLat: Degrees;
  /** Launch site longitude (-180 to 180, east positive). */
  siteLon: Degrees;
  /** Inclination of the desired orbit. */
  inclination: Degrees;
  /** Whether the vehicle crosses the site heading north (ascending leg) or south (descending leg). */
  direction: 'N' | 'S';
  /**
   * RAAN of the target orbital plane. Pass a function to account for the
   * target's nodal drift over the search window (see {@link LaunchWindowFinder.meanRaanAt}).
   */
  targetRaan: Degrees | ((time: Date) => Degrees);
  /** Start of the search window. */
  startTime: Date;
  /** Length of the search window in hours. Defaults to 24. */
  searchHours?: number;
  /** Coarse scan step in seconds. Defaults to 60. */
  coarseStepSec?: number;
  /** Refinement step in seconds around the best coarse sample. Defaults to 1. */
  fineStepSec?: number;
}

/** A candidate launch time and the plane alignment it achieves. */
export interface LaunchWindowResult {
  /** The launch time that best aligns the launch plane with the target plane. */
  time: Date;
  /** RAAN of the plane reachable by launching at {@link time}. (deg) */
  achievableRaan: Degrees;
  /** RAAN of the target plane at {@link time}. (deg) */
  targetRaan: Degrees;
  /** Signed alignment error achievable - target, normalized to [-180, 180). (deg) */
  raanError: Degrees;
}

/**
 * Finds the launch time whose resulting orbital plane best matches a target
 * plane's RAAN (a launch-window / RAAN-matching search).
 *
 * A launch site can only inject into planes that contain it, so for a fixed
 * inclination the achievable RAAN is a function of launch time alone: the site
 * rotates eastward under the candidate planes at Earth's rotation rate. This
 * class computes that achievable RAAN in closed form (spherical geometry, no
 * propagation) and scans a time window for the minimum |ΔRAAN| against the
 * target plane.
 *
 * @example
 * ```typescript
 * const finder = new LaunchWindowFinder({
 *   siteLat: 28.608 as Degrees,   // Kennedy Space Center
 *   siteLon: -80.604 as Degrees,
 *   inclination: 51.64 as Degrees,
 *   direction: 'N',
 *   targetRaan: (t) => LaunchWindowFinder.meanRaanAt(issSatrec, t),
 *   startTime: new Date(),
 * });
 * const window = finder.findBestLaunchTime();
 * ```
 */
export class LaunchWindowFinder {
  private readonly options_: Required<Omit<LaunchWindowOptions, 'targetRaan'>> & Pick<LaunchWindowOptions, 'targetRaan'>;

  constructor(options: LaunchWindowOptions) {
    this.options_ = {
      searchHours: 24,
      coarseStepSec: 60,
      fineStepSec: 1,
      ...options,
    };
  }

  /**
   * Whether the site can inject directly into the desired inclination: the
   * orbit plane must reach the site's latitude, i.e. |sin(lat)| <= sin(inc).
   */
  isGeometryPossible(): boolean {
    const sinInc = Math.sin(this.options_.inclination * DEG2RAD);

    if (sinInc === 0) {
      return this.options_.siteLat === 0;
    }

    return Math.abs(Math.sin(this.options_.siteLat * DEG2RAD) / sinInc) <= 1;
  }

  /**
   * RAAN of the (only) plane with the configured inclination that contains the
   * launch site at the given time on the configured leg. (deg, 0-360)
   */
  achievableRaan(time: Date): Degrees {
    const inc = this.options_.inclination * DEG2RAD;
    const lat = this.options_.siteLat * DEG2RAD;
    const sinU = Math.sin(lat) / Math.sin(inc);

    // Argument of latitude of the site crossing: northbound on the cos(u) > 0
    // branch, southbound mirrored across the pole. Holds for retrograde too.
    const u = this.options_.direction === 'N' ? Math.asin(sinU) : Math.PI - Math.asin(sinU);
    // In-plane angle from the ascending node projected onto the equator.
    const nodeToSite = Math.atan2(Math.sin(u) * Math.cos(inc), Math.cos(u));

    const gmst = Sgp4.gstime(LaunchWindowFinder.julianDate_(time));
    const lst = gmst + this.options_.siteLon * DEG2RAD;

    return LaunchWindowFinder.normalizeDeg_((lst - nodeToSite) * RAD2DEG);
  }

  /**
   * Scans the search window for the launch time minimizing |ΔRAAN| to the
   * target plane, then refines around the best coarse sample. Returns null
   * when the geometry is impossible (inclination below site latitude).
   */
  findBestLaunchTime(): LaunchWindowResult | null {
    if (!this.isGeometryPossible()) {
      return null;
    }

    const startMs = this.options_.startTime.getTime();
    const endMs = startMs + this.options_.searchHours * 3600 * 1000;
    const coarseMs = this.options_.coarseStepSec * 1000;

    let bestMs = startMs;
    let bestError = Infinity;

    for (let ms = startMs; ms <= endMs; ms += coarseMs) {
      const error = Math.abs(this.raanErrorAt_(new Date(ms)));

      if (error < bestError) {
        bestError = error;
        bestMs = ms;
      }
    }

    // Refine around the best coarse sample.
    const fineMs = this.options_.fineStepSec * 1000;
    const refineStart = Math.max(startMs, bestMs - coarseMs);
    const refineEnd = Math.min(endMs, bestMs + coarseMs);

    for (let ms = refineStart; ms <= refineEnd; ms += fineMs) {
      const error = Math.abs(this.raanErrorAt_(new Date(ms)));

      if (error < bestError) {
        bestError = error;
        bestMs = ms;
      }
    }

    const time = new Date(bestMs);
    const achievableRaan = this.achievableRaan(time);
    const targetRaan = this.targetRaanAt_(time);

    return {
      time,
      achievableRaan,
      targetRaan,
      raanError: LaunchWindowFinder.normalize180_(achievableRaan - targetRaan),
    };
  }

  /**
   * Mean RAAN of a satellite at a given time: the TLE epoch value advanced by
   * the secular nodal drift (J2). Suitable as the `targetRaan` function so the
   * target plane's regression over the search window is accounted for.
   */
  static meanRaanAt(satrec: SatelliteRecord, time: Date): Degrees {
    const minutesSinceEpoch = (LaunchWindowFinder.julianDate_(time) - satrec.jdsatepoch) * MINUTES_PER_DAY;

    return LaunchWindowFinder.normalizeDeg_((satrec.nodeo + satrec.nodedot * minutesSinceEpoch) * RAD2DEG);
  }

  private targetRaanAt_(time: Date): Degrees {
    const target = this.options_.targetRaan;

    return typeof target === 'function' ? target(time) : target;
  }

  private raanErrorAt_(time: Date): Degrees {
    return LaunchWindowFinder.normalize180_(this.achievableRaan(time) - this.targetRaanAt_(time));
  }

  private static julianDate_(time: Date): number {
    return (
      jday(time.getUTCFullYear(), time.getUTCMonth() + 1, time.getUTCDate(), time.getUTCHours(), time.getUTCMinutes(), time.getUTCSeconds()) +
      time.getUTCMilliseconds() * MILLISECONDS_TO_DAYS
    );
  }

  private static normalizeDeg_(deg: number): Degrees {
    return (((deg % 360) + 360) % 360) as Degrees;
  }

  private static normalize180_(deg: number): Degrees {
    const normalized = ((deg % 360) + 360) % 360;

    return (normalized >= 180 ? normalized - 360 : normalized) as Degrees;
  }
}
