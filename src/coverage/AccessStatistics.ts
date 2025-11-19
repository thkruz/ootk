/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
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

import { EpochUTC } from '../main.js';
import { Degrees, Seconds } from '../types/types.js';
import { Sensor } from '../objects/Sensor.js';
import { Satellite } from '../objects/Satellite.js';

/**
 * Represents an access interval when a satellite is visible to a sensor.
 */
export interface AccessInterval {
  /** Start epoch of access */
  start: EpochUTC;
  /** End epoch of access */
  end: EpochUTC;
  /** Duration in seconds */
  duration: Seconds;
  /** Maximum elevation during this access */
  maxElevation: Degrees;
  /** Time of maximum elevation */
  timeOfMaxElevation: EpochUTC;
}

/**
 * Statistics about satellite access over a time period.
 */
export interface AccessStats {
  /** Total number of access intervals */
  totalAccesses: number;
  /** Total access time in seconds */
  totalAccessTime: Seconds;
  /** Mean access time in seconds */
  meanAccessTime: Seconds;
  /** Minimum access time in seconds */
  minAccessTime: Seconds;
  /** Maximum access time in seconds */
  maxAccessTime: Seconds;
  /** Mean time between accesses in seconds */
  meanGapTime: Seconds;
  /** Maximum time between accesses in seconds */
  maxGapTime: Seconds;
  /** Coverage percentage (0-100) */
  coveragePercentage: number;
  /** Mean maximum elevation in degrees */
  meanMaxElevation: Degrees;
  /** All access intervals */
  intervals: AccessInterval[];
}

/**
 * Calculates access statistics for satellite-to-ground visibility.
 */
export class AccessStatistics {
  private sensor_: Sensor;
  private satellite_: Satellite;

  constructor(sensor: Sensor, satellite: Satellite) {
    this.sensor_ = sensor;
    this.satellite_ = satellite;
  }

  /**
   * Calculate access statistics over a time period.
   * @param startEpoch - Start of analysis period
   * @param duration - Duration of analysis in seconds
   * @param stepSize - Time step for analysis in seconds (default: 10)
   * @returns Access statistics
   */
  calculate(startEpoch: EpochUTC, duration: Seconds, stepSize: Seconds = 10 as Seconds): AccessStats {
    const intervals: AccessInterval[] = [];
    const steps = Math.floor(duration / stepSize);

    let inAccess = false;
    let accessStart: EpochUTC | null = null;
    let maxEl: Degrees = 0 as Degrees;
    let timeOfMaxEl: EpochUTC | null = null;

    // Scan through time to find access intervals
    for (let i = 0; i <= steps; i++) {
      const offset = (i * stepSize) as Seconds;
      const epoch = startEpoch.roll(offset);

      const rae = this.sensor_.rae(this.satellite_, epoch.toDateTime());

      if (!rae) {
        continue;
      }

      const isVisible = this.sensor_.isRaeInFov(rae);

      if (isVisible && !inAccess) {
        // Start of new access
        inAccess = true;
        accessStart = epoch;
        maxEl = rae.el;
        timeOfMaxEl = epoch;
      } else if (isVisible && inAccess) {
        // During access, track max elevation
        if (rae.el > maxEl) {
          maxEl = rae.el;
          timeOfMaxEl = epoch;
        }
      } else if (!isVisible && inAccess) {
        // End of access
        inAccess = false;
        if (accessStart && timeOfMaxEl) {
          const accessDuration = ((epoch.toJulianDate() - accessStart.toJulianDate()) * 86400) as Seconds;

          intervals.push({
            start: accessStart,
            end: epoch,
            duration: accessDuration,
            maxElevation: maxEl,
            timeOfMaxElevation: timeOfMaxEl,
          });
        }
        maxEl = 0 as Degrees;
        timeOfMaxEl = null;
      }
    }

    // Handle case where access is still ongoing at end of period
    if (inAccess && accessStart && timeOfMaxEl) {
      const endEpoch = startEpoch.roll(duration);
      const accessDuration = ((endEpoch.toJulianDate() - accessStart.toJulianDate()) * 86400) as Seconds;

      intervals.push({
        start: accessStart,
        end: endEpoch,
        duration: accessDuration,
        maxElevation: maxEl,
        timeOfMaxElevation: timeOfMaxEl,
      });
    }

    return this.computeStats(intervals, duration);
  }

  /**
   * Compute statistics from access intervals.
   * @param intervals - Array of access intervals
   * @param totalDuration - Total duration of analysis period
   * @returns Computed statistics
   */
  private computeStats(intervals: AccessInterval[], totalDuration: Seconds): AccessStats {
    if (intervals.length === 0) {
      return {
        totalAccesses: 0,
        totalAccessTime: 0 as Seconds,
        meanAccessTime: 0 as Seconds,
        minAccessTime: 0 as Seconds,
        maxAccessTime: 0 as Seconds,
        meanGapTime: 0 as Seconds,
        maxGapTime: 0 as Seconds,
        coveragePercentage: 0,
        meanMaxElevation: 0 as Degrees,
        intervals: [],
      };
    }

    const totalAccessTime = intervals.reduce((sum, interval) => sum + interval.duration, 0) as Seconds;
    const durations = intervals.map((interval) => interval.duration);
    const elevations = intervals.map((interval) => interval.maxElevation);

    const minAccessTime = Math.min(...durations) as Seconds;
    const maxAccessTime = Math.max(...durations) as Seconds;
    const meanAccessTime = (totalAccessTime / intervals.length) as Seconds;
    const meanMaxElevation = (elevations.reduce((sum, el) => sum + el, 0) / intervals.length) as Degrees;

    // Calculate gap times
    const gapTimes: number[] = [];

    for (let i = 0; i < intervals.length - 1; i++) {
      const gapTime = (intervals[i + 1].start.toJulianDate() - intervals[i].end.toJulianDate()) * 86400;

      gapTimes.push(gapTime);
    }

    const meanGapTime = gapTimes.length > 0 ? ((gapTimes.reduce((sum, gap) => sum + gap, 0) / gapTimes.length) as Seconds) : (0 as Seconds);
    const maxGapTime = gapTimes.length > 0 ? (Math.max(...gapTimes) as Seconds) : (0 as Seconds);

    const coveragePercentage = (totalAccessTime / totalDuration) * 100;

    return {
      totalAccesses: intervals.length,
      totalAccessTime,
      meanAccessTime,
      minAccessTime,
      maxAccessTime,
      meanGapTime,
      maxGapTime,
      coveragePercentage,
      meanMaxElevation,
      intervals,
    };
  }

  /**
   * Find the next access opportunity after a given epoch.
   * @param startEpoch - Epoch to start searching from
   * @param maxSearchDuration - Maximum time to search in seconds (default: 7 days)
   * @param stepSize - Time step for search in seconds (default: 60)
   * @returns Next access interval or null if none found
   */
  findNextAccess(
    startEpoch: EpochUTC,
    maxSearchDuration: Seconds = 604800 as Seconds,
    stepSize: Seconds = 60 as Seconds,
  ): AccessInterval | null {
    const stats = this.calculate(startEpoch, maxSearchDuration, stepSize);

    return stats.intervals.length > 0 ? stats.intervals[0] : null;
  }
}
