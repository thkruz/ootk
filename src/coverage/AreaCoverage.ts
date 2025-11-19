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
import { Degrees, Kilometers, Seconds } from '../types/types.js';
import { Satellite } from '../objects/Satellite.js';
import { GroundObject } from '../objects/GroundObject.js';
import { DEG2RAD, RAD2DEG, RADIUS_OF_EARTH } from '../utils/constants.js';

/**
 * Represents a grid point for coverage analysis.
 */
export interface CoverageGridPoint {
  /** Latitude in degrees */
  lat: Degrees;
  /** Longitude in degrees */
  lon: Degrees;
  /** Number of times this point was covered */
  coverageCount: number;
  /** Total coverage time in seconds */
  coverageTime: Seconds;
  /** Maximum elevation angle observed from this point */
  maxElevation: Degrees;
  /** Percentage of time covered (0-100) */
  coveragePercentage: number;
}

/**
 * Options for area coverage calculation.
 */
export interface AreaCoverageOptions {
  /** Start epoch */
  startEpoch: EpochUTC;
  /** Duration in seconds */
  duration: Seconds;
  /** Time step in seconds (default: 60) */
  stepSize?: Seconds;
  /** Latitude resolution in degrees (default: 5) */
  latResolution?: Degrees;
  /** Longitude resolution in degrees (default: 5) */
  lonResolution?: Degrees;
  /** Minimum elevation angle in degrees (default: 0) */
  minElevation?: Degrees;
  /** Latitude bounds (default: -90 to 90) */
  latBounds?: { min: Degrees; max: Degrees };
  /** Longitude bounds (default: -180 to 180) */
  lonBounds?: { min: Degrees; max: Degrees };
}

/**
 * Area coverage analyzer for satellite coverage analysis.
 * Computes which ground locations are covered by a satellite over time.
 */
export class AreaCoverage {
  private satellites_: Satellite[];

  constructor(satellites: Satellite | Satellite[]) {
    this.satellites_ = Array.isArray(satellites) ? satellites : [satellites];
  }

  /**
   * Calculate area coverage grid.
   * @param options - Coverage calculation options
   * @returns Array of coverage grid points
   */
  calculateGrid(options: AreaCoverageOptions): CoverageGridPoint[] {
    const {
      startEpoch,
      duration,
      stepSize = 60 as Seconds,
      latResolution = 5 as Degrees,
      lonResolution = 5 as Degrees,
      minElevation = 0 as Degrees,
      latBounds = { min: -90 as Degrees, max: 90 as Degrees },
      lonBounds = { min: -180 as Degrees, max: 180 as Degrees },
    } = options;

    // Create coverage grid
    const grid = this.initializeGrid_(latBounds, lonBounds, latResolution, lonResolution);

    const steps = Math.floor(duration / stepSize);

    // Scan through time and update coverage for each point
    for (let i = 0; i <= steps; i++) {
      const offset = (i * stepSize) as Seconds;
      const epoch = startEpoch.roll(offset);

      for (const satellite of this.satellites_) {
        const state = satellite.toJ2000(epoch.toDateTime());

        if (!state) {
          continue;
        }

        const satPos = state.toITRF().toGeodetic();

        // For each grid point, check if satellite is visible
        for (const point of grid) {
          const groundPos = new GroundObject({ lat: point.lat, lon: point.lon, alt: 0 as Kilometers });
          const el = this.calculateElevation_(satPos.latDeg as Degrees, satPos.lonDeg as Degrees, satPos.alt, groundPos);

          if (el >= minElevation) {
            point.coverageCount++;
            point.coverageTime = (point.coverageTime + stepSize) as Seconds;
            point.maxElevation = Math.max(point.maxElevation, el) as Degrees;
          }
        }
      }
    }

    // Calculate coverage percentages
    for (const point of grid) {
      point.coveragePercentage = (point.coverageTime / duration) * 100;
    }

    return grid;
  }

  /**
   * Calculate instantaneous coverage area at a specific time.
   * @param epoch - Epoch to calculate coverage
   * @param minElevation - Minimum elevation angle in degrees
   * @param resolution - Grid resolution in degrees
   * @returns Array of grid points that are currently covered
   */
  calculateInstantaneousCoverage(
    epoch: EpochUTC,
    minElevation: Degrees = 0 as Degrees,
    resolution: Degrees = 5 as Degrees,
  ): CoverageGridPoint[] {
    return this.calculateGrid({
      startEpoch: epoch,
      duration: 1 as Seconds,
      stepSize: 1 as Seconds,
      latResolution: resolution,
      lonResolution: resolution,
      minElevation,
    }).filter((point) => point.coverageCount > 0);
  }

  /**
   * Calculate coverage percentage over a region.
   * @param options - Coverage calculation options
   * @returns Coverage percentage (0-100)
   */
  calculateCoveragePercentage(options: AreaCoverageOptions): number {
    const grid = this.calculateGrid(options);
    const coveredPoints = grid.filter((point) => point.coverageCount > 0).length;

    return (coveredPoints / grid.length) * 100;
  }

  /**
   * Calculate the instantaneous swath width at a given elevation angle.
   * @param altitude - Satellite altitude in kilometers
   * @param minElevation - Minimum elevation angle in degrees
   * @returns Swath width in kilometers
   */
  static calculateSwathWidth(altitude: Kilometers, minElevation: Degrees = 0 as Degrees): Kilometers {
    const Re = RADIUS_OF_EARTH;
    const h = altitude;
    const elRad = minElevation * DEG2RAD;

    // Calculate nadir angle using spherical geometry
    const rho = Math.acos((Re / (Re + h)) * Math.cos(elRad));
    const eta = Math.PI / 2 - elRad - rho;

    // Calculate swath half-angle
    const lambda = Re * eta;

    // Total swath width
    return (2 * lambda) as Kilometers;
  }

  /**
   * Calculate the footprint radius for a satellite.
   * @param altitude - Satellite altitude in kilometers
   * @param minElevation - Minimum elevation angle in degrees
   * @returns Footprint radius in kilometers
   */
  static calculateFootprintRadius(altitude: Kilometers, minElevation: Degrees = 0 as Degrees): Kilometers {
    const swathWidth = AreaCoverage.calculateSwathWidth(altitude, minElevation);

    return (swathWidth / 2) as Kilometers;
  }

  /**
   * Calculate maximum coverage latitude for an inclined orbit.
   * @param inclination - Orbital inclination in degrees
   * @param altitude - Satellite altitude in kilometers
   * @param minElevation - Minimum elevation angle in degrees
   * @returns Maximum latitude that can be covered
   */
  static calculateMaxCoverageLatitude(
    inclination: Degrees,
    altitude: Kilometers,
    minElevation: Degrees = 0 as Degrees,
  ): Degrees {
    const footprintRadius = AreaCoverage.calculateFootprintRadius(altitude, minElevation);
    const angularRadius = (footprintRadius / RADIUS_OF_EARTH) * RAD2DEG;

    return (inclination + angularRadius) as Degrees;
  }

  /**
   * Initialize coverage grid.
   */
  private initializeGrid_(
    latBounds: { min: Degrees; max: Degrees },
    lonBounds: { min: Degrees; max: Degrees },
    latResolution: Degrees,
    lonResolution: Degrees,
  ): CoverageGridPoint[] {
    const grid: CoverageGridPoint[] = [];

    for (let lat = latBounds.min as number; lat <= latBounds.max; lat += latResolution) {
      for (let lon = lonBounds.min as number; lon < lonBounds.max; lon += lonResolution) {
        grid.push({
          lat: lat as Degrees,
          lon: lon as Degrees,
          coverageCount: 0,
          coverageTime: 0 as Seconds,
          maxElevation: 0 as Degrees,
          coveragePercentage: 0,
        });
      }
    }

    return grid;
  }

  /**
   * Calculate elevation angle from a ground point to a satellite.
   */
  private calculateElevation_(
    satLat: Degrees,
    satLon: Degrees,
    satAlt: Kilometers,
    groundPos: GroundObject,
  ): Degrees {
    // Convert to radians
    const lat1 = groundPos.lat * DEG2RAD;
    const lon1 = groundPos.lon * DEG2RAD;
    const lat2 = satLat * DEG2RAD;
    const lon2 = satLon * DEG2RAD;

    // Calculate angular distance
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = RADIUS_OF_EARTH * c;

    // Calculate elevation angle
    const Re = RADIUS_OF_EARTH;
    const h = satAlt;
    const d = distance;

    const elevation = Math.atan2(h - Re * (1 - Math.cos(d / Re)), Re * Math.sin(d / Re));

    return (elevation * RAD2DEG) as Degrees;
  }
}
