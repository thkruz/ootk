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

import { ClassicalElements, EpochUTC } from '../main.js';
import { Degrees, Kilometers, Radians } from '../types/types.js';
import { DEG2RAD, RAD2DEG } from '../utils/constants.js';
import { Satellite } from '../objects/Satellite.js';

/**
 * Walker constellation parameters.
 * Walker constellations are denoted as i:t/p/f where:
 * - i = inclination
 * - t = total number of satellites
 * - p = number of equally spaced orbital planes
 * - f = relative spacing between satellites in adjacent planes (phasing parameter)
 */
export interface WalkerConstellationParams {
  /** Total number of satellites */
  totalSatellites: number;
  /** Number of orbital planes */
  numberOfPlanes: number;
  /** Relative phasing between planes (0 to numberOfPlanes-1) */
  relativePhasing: number;
  /** Orbital inclination in degrees */
  inclination: Degrees;
  /** Semi-major axis in kilometers */
  semiMajorAxis: Kilometers;
  /** Eccentricity (default: 0 for circular) */
  eccentricity?: number;
  /** Argument of periapsis in degrees (default: 0) */
  argumentOfPeriapsis?: Degrees;
  /** Epoch for the constellation */
  epoch: EpochUTC;
}

/**
 * Represents a satellite in a Walker constellation.
 */
export interface WalkerSatellite {
  /** Satellite index (0 to totalSatellites-1) */
  index: number;
  /** Plane number (0 to numberOfPlanes-1) */
  plane: number;
  /** Position in plane (0 to satellitesPerPlane-1) */
  positionInPlane: number;
  /** Classical orbital elements */
  elements: ClassicalElements;
  /** Satellite object (if TLE creation is enabled) */
  satellite?: Satellite;
}

/**
 * Walker constellation generator.
 * Creates satellite constellations using the Walker Delta pattern.
 */
export class WalkerConstellation {
  private params_: WalkerConstellationParams;
  private satellites_: WalkerSatellite[] = [];

  constructor(params: WalkerConstellationParams) {
    this.validateParams_(params);
    this.params_ = params;
    this.generateConstellation_();
  }

  /**
   * Get all satellites in the constellation.
   * @returns Array of Walker satellites
   */
  getSatellites(): WalkerSatellite[] {
    return this.satellites_;
  }

  /**
   * Get satellites in a specific orbital plane.
   * @param planeNumber - Plane number (0 to numberOfPlanes-1)
   * @returns Array of satellites in the plane
   */
  getSatellitesInPlane(planeNumber: number): WalkerSatellite[] {
    return this.satellites_.filter((sat) => sat.plane === planeNumber);
  }

  /**
   * Get the orbital elements for a specific satellite.
   * @param index - Satellite index (0 to totalSatellites-1)
   * @returns Classical orbital elements or undefined if index invalid
   */
  getSatelliteElements(index: number): ClassicalElements | undefined {
    return this.satellites_[index]?.elements;
  }

  /**
   * Get the Walker constellation designation string.
   * @returns Walker designation (e.g., "53:6/6/1")
   */
  getDesignation(): string {
    const { inclination, totalSatellites, numberOfPlanes, relativePhasing } = this.params_;

    return `${inclination}:${totalSatellites}/${numberOfPlanes}/${relativePhasing}`;
  }

  /**
   * Calculate the street-of-coverage width for the constellation.
   * @param minElevation - Minimum elevation angle in degrees
   * @returns Street width in degrees
   */
  calculateStreetWidth(minElevation: Degrees): Degrees {
    const { semiMajorAxis } = this.params_;
    const Re = 6371; // Earth radius in km
    const h = semiMajorAxis - Re;

    // Calculate nadir angle
    const elRad = minElevation * DEG2RAD;
    const rho = Math.acos((Re / (Re + h)) * Math.cos(elRad));
    const eta = (Math.PI / 2 - elRad - rho) as Radians;

    // Angular radius of coverage
    const lambda = (eta * RAD2DEG) as Degrees;

    return (2 * lambda) as Degrees;
  }

  /**
   * Validate Walker constellation parameters.
   */
  private validateParams_(params: WalkerConstellationParams): void {
    if (params.totalSatellites <= 0) {
      throw new Error('Total satellites must be positive');
    }

    if (params.numberOfPlanes <= 0) {
      throw new Error('Number of planes must be positive');
    }

    if (params.totalSatellites % params.numberOfPlanes !== 0) {
      throw new Error('Total satellites must be divisible by number of planes');
    }

    if (params.relativePhasing < 0 || params.relativePhasing >= params.numberOfPlanes) {
      throw new Error('Relative phasing must be between 0 and numberOfPlanes-1');
    }

    if (params.inclination < 0 || params.inclination > 180) {
      throw new Error('Inclination must be between 0 and 180 degrees');
    }

    if (params.semiMajorAxis <= 6371) {
      throw new Error('Semi-major axis must be greater than Earth radius (6371 km)');
    }
  }

  /**
   * Generate the constellation satellites.
   */
  private generateConstellation_(): void {
    const {
      totalSatellites,
      numberOfPlanes,
      relativePhasing,
      inclination,
      semiMajorAxis,
      eccentricity = 0,
      argumentOfPeriapsis = 0 as Degrees,
      epoch,
    } = this.params_;

    const satellitesPerPlane = totalSatellites / numberOfPlanes;
    const raanSpacing = (360 / numberOfPlanes) as Degrees;
    const taSpacing = (360 / satellitesPerPlane) as Degrees;

    let satIndex = 0;

    for (let plane = 0; plane < numberOfPlanes; plane++) {
      const raan = (plane * raanSpacing) as Degrees;

      for (let pos = 0; pos < satellitesPerPlane; pos++) {
        // Calculate true anomaly with phasing
        const phaseOffset = (plane * relativePhasing * taSpacing) / numberOfPlanes;
        const ta = ((pos * taSpacing + phaseOffset) % 360) as Degrees;

        const elements = new ClassicalElements({
          epoch,
          semimajorAxis: semiMajorAxis,
          eccentricity,
          inclination: (inclination * DEG2RAD) as Radians,
          rightAscension: (raan * DEG2RAD) as Radians,
          argPerigee: (argumentOfPeriapsis * DEG2RAD) as Radians,
          trueAnomaly: (ta * DEG2RAD) as Radians,
        });

        this.satellites_.push({
          index: satIndex,
          plane,
          positionInPlane: pos,
          elements,
        });

        satIndex++;
      }
    }
  }

  /**
   * Create a Walker Delta constellation (most common pattern).
   * @param t - Total number of satellites
   * @param p - Number of orbital planes
   * @param f - Relative phasing parameter
   * @param inclination - Orbital inclination in degrees
   * @param altitude - Orbital altitude in kilometers
   * @param epoch - Epoch for the constellation
   * @returns WalkerConstellation instance
   */
  static createDelta(
    t: number,
    p: number,
    f: number,
    inclination: Degrees,
    altitude: Kilometers,
    epoch: EpochUTC,
  ): WalkerConstellation {
    const Re = 6371; // Earth radius
    const semiMajorAxis = (Re + altitude) as Kilometers;

    return new WalkerConstellation({
      totalSatellites: t,
      numberOfPlanes: p,
      relativePhasing: f,
      inclination,
      semiMajorAxis,
      eccentricity: 0,
      epoch,
    });
  }

  /**
   * Create a Walker Star constellation (polar, counter-rotating planes).
   * @param t - Total number of satellites
   * @param p - Number of orbital planes
   * @param f - Relative phasing parameter
   * @param altitude - Orbital altitude in kilometers
   * @param epoch - Epoch for the constellation
   * @returns WalkerConstellation instance
   */
  static createStar(t: number, p: number, f: number, altitude: Kilometers, epoch: EpochUTC): WalkerConstellation {
    // Star pattern uses polar orbits (90 degrees)
    return WalkerConstellation.createDelta(t, p, f, 90 as Degrees, altitude, epoch);
  }

  /**
   * Create a preset GPS-like constellation.
   * GPS uses 24 satellites in 6 planes at 55° inclination.
   * @param epoch - Epoch for the constellation
   * @returns WalkerConstellation instance
   */
  static createGPS(epoch: EpochUTC): WalkerConstellation {
    return WalkerConstellation.createDelta(24, 6, 1, 55 as Degrees, 20180 as Kilometers, epoch);
  }

  /**
   * Create a preset Galileo-like constellation.
   * Galileo uses 24 satellites in 3 planes at 56° inclination.
   * @param epoch - Epoch for the constellation
   * @returns WalkerConstellation instance
   */
  static createGalileo(epoch: EpochUTC): WalkerConstellation {
    return WalkerConstellation.createDelta(24, 3, 1, 56 as Degrees, 23222 as Kilometers, epoch);
  }

  /**
   * Create a preset Iridium-like constellation.
   * Iridium uses 66 satellites in 6 planes at 86.4° inclination.
   * @param epoch - Epoch for the constellation
   * @returns WalkerConstellation instance
   */
  static createIridium(epoch: EpochUTC): WalkerConstellation {
    return WalkerConstellation.createDelta(66, 6, 1, 86.4 as Degrees, 780 as Kilometers, epoch);
  }

  /**
   * Create a preset OneWeb-like constellation.
   * OneWeb uses 648 satellites in 18 planes at 87.9° inclination.
   * @param epoch - Epoch for the constellation
   * @returns WalkerConstellation instance
   */
  static createOneWeb(epoch: EpochUTC): WalkerConstellation {
    return WalkerConstellation.createDelta(648, 18, 1, 87.9 as Degrees, 1200 as Kilometers, epoch);
  }
}
