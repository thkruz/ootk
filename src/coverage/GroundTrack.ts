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
import { GroundObject } from '../objects/GroundObject.js';
import { Degrees, Kilometers, Seconds } from '../types/types.js';
import { Satellite } from '../objects/Satellite.js';

/**
 * Represents a point on a ground track.
 */
export interface GroundTrackPoint {
  /** Epoch of the point */
  epoch: EpochUTC;
  /** Latitude in degrees */
  lat: Degrees;
  /** Longitude in degrees */
  lon: Degrees;
  /** Altitude in kilometers */
  alt: Kilometers;
}

/**
 * Options for ground track calculation.
 */
export interface GroundTrackOptions {
  /** Start epoch */
  startEpoch: EpochUTC;
  /** Duration in seconds */
  duration: Seconds;
  /** Time step in seconds (default: 60) */
  stepSize?: Seconds;
  /** Whether to include ascending/descending node crossings */
  includeNodeCrossings?: boolean;
}

/**
 * Ground track calculator for satellite orbits.
 * Generates ground track points showing where a satellite passes over the Earth's surface.
 */
export class GroundTrack {
  private satellite_: Satellite;

  constructor(satellite: Satellite) {
    this.satellite_ = satellite;
  }

  /**
   * Calculate ground track points for the satellite.
   * @param options - Ground track calculation options
   * @returns Array of ground track points
   */
  calculate(options: GroundTrackOptions): GroundTrackPoint[] {
    const { startEpoch, duration, stepSize = 60 as Seconds, includeNodeCrossings = false } = options;
    const points: GroundTrackPoint[] = [];
    const steps = Math.floor(duration / stepSize);

    let lastLat: Degrees | null = null;

    for (let i = 0; i <= steps; i++) {
      const offset = (i * stepSize) as Seconds;
      const epoch = startEpoch.roll(offset);
      const state = this.satellite_.toJ2000(epoch.toDateTime());

      if (!state) {
        continue;
      }

      const lla = state.toITRF().toGeodetic();

      const point: GroundTrackPoint = {
        epoch,
        lat: lla.latDeg as Degrees,
        lon: lla.lonDeg as Degrees,
        alt: lla.alt,
      };

      points.push(point);

      // Detect node crossings (equator crossings)
      if (includeNodeCrossings && lastLat !== null) {
        if ((lastLat < 0 && lla.latDeg >= 0) || (lastLat > 0 && lla.latDeg <= 0)) {
          // Mark this as a node crossing
          (point as GroundTrackPoint & { isNodeCrossing?: boolean }).isNodeCrossing = true;
        }
      }

      lastLat = lla.latDeg as Degrees;
    }

    return points;
  }

  /**
   * Calculate ground track for one complete orbit.
   * @param startEpoch - Starting epoch
   * @param stepSize - Time step in seconds (default: 60)
   * @returns Array of ground track points for one orbit
   */
  calculateOrbit(startEpoch: EpochUTC, stepSize: Seconds = 60 as Seconds): GroundTrackPoint[] {
    // Get orbital period
    const state = this.satellite_.toJ2000(startEpoch.toDateTime());

    if (!state) {
      return [];
    }

    const elements = state.toClassicalElements();
    const period = elements.period;

    return this.calculate({
      startEpoch,
      duration: (period * 60) as Seconds,
      stepSize,
      includeNodeCrossings: true,
    });
  }

  /**
   * Get the subsatellite point (ground position directly below satellite).
   * @param epoch - Epoch to calculate subsatellite point
   * @returns Ground position or null if propagation fails
   */
  getSubsatellitePoint(epoch: EpochUTC): GroundObject | null {
    const state = this.satellite_.toJ2000(epoch.toDateTime());

    if (!state) {
      return null;
    }

    const lla = state.toITRF().toGeodetic();

    return new GroundObject({ lat: lla.latDeg as Degrees, lon: lla.lonDeg as Degrees, alt: lla.alt });
  }

  /**
   * Calculate maximum and minimum latitudes reached by the satellite.
   * For circular orbits, this equals the inclination.
   * @param startEpoch - Starting epoch
   * @returns Object with max and min latitudes
   */
  getLatitudeBounds(startEpoch: EpochUTC): { maxLat: Degrees; minLat: Degrees } {
    const state = this.satellite_.toJ2000(startEpoch.toDateTime());

    if (!state) {
      return { maxLat: 0 as Degrees, minLat: 0 as Degrees };
    }

    const elements = state.toClassicalElements();
    const inc = elements.inclinationDegrees;

    return {
      maxLat: inc,
      minLat: (-inc) as Degrees,
    };
  }

  /**
   * Calculate the repeat ground track parameters.
   * A repeat ground track occurs when the satellite returns to the same ground track
   * after a whole number of orbits and Earth rotations.
   * @param startEpoch - Starting epoch
   * @returns Repeat parameters or null if satellite doesn't have a repeat ground track
   */
  getRepeatGroundTrack(startEpoch: EpochUTC): {
    orbits: number;
    days: number;
    error: number;
  } | null {
    const state = this.satellite_.toJ2000(startEpoch.toDateTime());

    if (!state) {
      return null;
    }

    const elements = state.toClassicalElements();
    const period = elements.period; // in seconds
    const orbitsPerDay = 86400 / period;

    // Try to find a simple ratio (within 1%)
    for (let days = 1; days <= 30; days++) {
      const orbits = Math.round(orbitsPerDay * days);
      const actualRatio = orbits / days;
      const error = Math.abs(actualRatio - orbitsPerDay) / orbitsPerDay;

      if (error < 0.01) {
        // Within 1%
        return { orbits, days, error };
      }
    }

    return null;
  }
}
