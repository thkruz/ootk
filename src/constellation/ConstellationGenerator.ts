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

import { Earth } from '../body/Earth';
import { ClassicalElements } from '../coordinate/ClassicalElements';
import { Tle } from '../coordinate/Tle';
import { ValidationError } from '../errors';
import { Satellite } from '../objects/Satellite';
import { EpochUTC } from '../time/EpochUTC';
import { Degrees, Kilometers, Radians } from '../types/types';
import { DEG2RAD, TAU } from '../utils/constants';

/**
 * Result from parsing a Walker pattern string.
 */
interface WalkerPatternResult_ {
  totalSats: number;
  planes: number;
  phasing: number;
  altitude?: Kilometers;
  inclination?: Degrees;
}

/**
 * Static utility class for generating satellite constellations.
 *
 * Supports Walker Delta constellation patterns, which are characterized by:
 * - T total satellites distributed across P orbital planes
 * - All planes at the same inclination
 * - Equal spacing between adjacent orbital planes in RAAN (360°/P)
 * - Equal spacing between satellites within each plane (360°/(T/P))
 * - A phasing parameter F that defines relative phase offset between adjacent planes
 *
 * The notation is typically "T/P/F" (e.g., "24/3/1" means 24 satellites, 3 planes, phasing factor 1).
 *
 * @example
 * ```typescript
 * // Generate a 24/3/1 Walker constellation at 550 km, 53 degrees inclination
 * const satellites = ConstellationGenerator.walker(
 *   550 as Kilometers,
 *   53 as Degrees,
 *   24,
 *   3,
 *   1,
 *   new Date()
 * );
 *
 * // Or using the pattern string format with altitude and inclination
 * const satellites = ConstellationGenerator.fromPattern(
 *   "550:53:24/3/1",
 *   new Date()
 * );
 * ```
 */
export class ConstellationGenerator {
  private constructor() {
    // Static-only class - disable constructor
  }

  /**
   * Generates a Walker Delta constellation.
   *
   * A Walker Delta constellation distributes satellites evenly across multiple
   * orbital planes at the same inclination. The phasing factor determines the
   * relative angular offset between satellites in adjacent planes.
   *
   * @param altitude - Orbital altitude above Earth's surface in kilometers
   * @param inclination - Orbital inclination in degrees (0-180)
   * @param totalSats - Total number of satellites (T)
   * @param planes - Number of orbital planes (P)
   * @param phasing - Phasing factor (F), determines relative phasing between planes (0 to P-1)
   * @param epoch - Epoch for TLE generation
   * @returns Array of Satellite objects representing the constellation
   * @throws ValidationError if parameters are invalid
   *
   * @example
   * ```typescript
   * // GPS-like constellation: 24/6/1 at 20,200 km, 55 deg inclination
   * const gpsSats = ConstellationGenerator.walker(
   *   20200 as Kilometers,
   *   55 as Degrees,
   *   24, 6, 1,
   *   new Date()
   * );
   *
   * // Iridium-like constellation: 66/6/2 at 780 km, 86.4 deg inclination
   * const iridiumSats = ConstellationGenerator.walker(
   *   780 as Kilometers,
   *   86.4 as Degrees,
   *   66, 6, 2,
   *   new Date()
   * );
   * ```
   */
  static walker(
    altitude: Kilometers,
    inclination: Degrees,
    totalSats: number,
    planes: number,
    phasing: number,
    epoch: Date,
  ): Satellite[] {
    ConstellationGenerator.validateWalkerParams_(altitude, inclination, totalSats, planes, phasing);

    return ConstellationGenerator.generateWalkerConstellation_(
      altitude,
      inclination,
      totalSats,
      planes,
      phasing,
      epoch,
    );
  }

  /**
   * Generates a Walker constellation from a pattern string.
   *
   * Pattern formats supported:
   * - "T/P/F" - Basic Walker notation (requires altitude and inclination params)
   * - "altitude:inclination:T/P/F" - Extended format with orbital parameters
   *
   * @param pattern - Walker pattern string (e.g., "24/3/1" or "550:53:24/3/1")
   * @param epoch - Epoch for TLE generation
   * @param altitude - Optional altitude (required if not in pattern)
   * @param inclination - Optional inclination (required if not in pattern)
   * @returns Array of Satellite objects representing the constellation
   * @throws ValidationError if pattern is invalid or missing required parameters
   *
   * @example
   * ```typescript
   * // Using extended format
   * const sats = ConstellationGenerator.fromPattern("550:53:24/3/1", new Date());
   *
   * // Using basic format with explicit parameters
   * const sats = ConstellationGenerator.fromPattern(
   *   "24/3/1",
   *   new Date(),
   *   550 as Kilometers,
   *   53 as Degrees
   * );
   * ```
   */
  static fromPattern(pattern: string, epoch: Date, altitude?: Kilometers, inclination?: Degrees): Satellite[] {
    const parsed = ConstellationGenerator.parseWalkerPattern_(pattern);

    const finalAltitude = altitude ?? parsed.altitude;
    const finalInclination = inclination ?? parsed.inclination;

    if (finalAltitude === undefined) {
      throw new ValidationError(
        'Altitude must be provided either in pattern (e.g., "550:53:24/3/1") or as parameter',
        'altitude',
        undefined,
      );
    }

    if (finalInclination === undefined) {
      throw new ValidationError(
        'Inclination must be provided either in pattern (e.g., "550:53:24/3/1") or as parameter',
        'inclination',
        undefined,
      );
    }

    return ConstellationGenerator.walker(
      finalAltitude,
      finalInclination,
      parsed.totalSats,
      parsed.planes,
      parsed.phasing,
      epoch,
    );
  }

  /**
   * Validates Walker constellation parameters.
   */
  private static validateWalkerParams_(
    altitude: Kilometers,
    inclination: Degrees,
    totalSats: number,
    planes: number,
    phasing: number,
  ): void {
    if (altitude <= 0) {
      throw new ValidationError('Altitude must be positive', 'altitude', altitude);
    }

    if (altitude < 160) {
      throw new ValidationError('Altitude must be at least 160 km (above dense atmosphere)', 'altitude', altitude);
    }

    if (altitude > 400000) {
      throw new ValidationError('Altitude must be less than 400,000 km (lunar distance)', 'altitude', altitude);
    }

    if (inclination < 0 || inclination > 180) {
      throw new ValidationError('Inclination must be between 0 and 180 degrees', 'inclination', inclination);
    }

    if (!Number.isInteger(totalSats) || totalSats < 1) {
      throw new ValidationError('Total satellites must be a positive integer', 'totalSats', totalSats);
    }

    if (!Number.isInteger(planes) || planes < 1) {
      throw new ValidationError('Number of planes must be a positive integer', 'planes', planes);
    }

    if (totalSats % planes !== 0) {
      throw new ValidationError(
        `Total satellites (${totalSats}) must be divisible by number of planes (${planes})`,
        'totalSats',
        totalSats,
      );
    }

    if (!Number.isInteger(phasing) || phasing < 0 || phasing >= planes) {
      throw new ValidationError(`Phasing factor must be an integer from 0 to ${planes - 1}`, 'phasing', phasing);
    }
  }

  /**
   * Parses a Walker pattern string.
   *
   * Supported formats:
   * - "T/P/F" - Basic Walker notation
   * - "altitude:inclination:T/P/F" - Extended format
   */
  private static parseWalkerPattern_(pattern: string): WalkerPatternResult_ {
    const trimmed = pattern.trim();

    const colonParts = trimmed.split(':');

    if (colonParts.length === 3) {
      const altitude = parseFloat(colonParts[0]);
      const inclination = parseFloat(colonParts[1]);
      const walkerPart = colonParts[2];

      if (isNaN(altitude)) {
        throw new ValidationError('Invalid altitude in pattern', 'pattern', pattern);
      }

      if (isNaN(inclination)) {
        throw new ValidationError('Invalid inclination in pattern', 'pattern', pattern);
      }

      const tpf = ConstellationGenerator.parseTPF_(walkerPart, pattern);

      return {
        ...tpf,
        altitude: altitude as Kilometers,
        inclination: inclination as Degrees,
      };
    } else if (colonParts.length === 1) {
      return ConstellationGenerator.parseTPF_(trimmed, pattern);
    }
    throw new ValidationError('Invalid pattern format. Use "T/P/F" or "altitude:inclination:T/P/F"', 'pattern', pattern);

  }

  /**
   * Parses the T/P/F portion of a Walker pattern.
   */
  private static parseTPF_(tpf: string, originalPattern: string): WalkerPatternResult_ {
    const parts = tpf.split('/');

    if (parts.length !== 3) {
      throw new ValidationError(
        'Walker pattern must be in format "T/P/F" (e.g., "24/3/1")',
        'pattern',
        originalPattern,
      );
    }

    const totalSats = parseInt(parts[0], 10);
    const planes = parseInt(parts[1], 10);
    const phasing = parseInt(parts[2], 10);

    if (isNaN(totalSats) || isNaN(planes) || isNaN(phasing)) {
      throw new ValidationError('Walker pattern values must be integers', 'pattern', originalPattern);
    }

    return { totalSats, planes, phasing };
  }

  /**
   * Generates the Walker constellation satellites.
   */
  private static generateWalkerConstellation_(
    altitude: Kilometers,
    inclination: Degrees,
    totalSats: number,
    planes: number,
    phasing: number,
    epoch: Date,
  ): Satellite[] {
    const satellites: Satellite[] = [];
    const satsPerPlane = totalSats / planes;
    const epochUTC = EpochUTC.fromDateTime(epoch);

    // Calculate semi-major axis (altitude + Earth radius)
    const semimajorAxis = (altitude + Earth.radiusMean) as Kilometers;

    // Convert inclination to radians
    const inclinationRad = (inclination * DEG2RAD) as Radians;

    // Near-circular orbit (avoid exactly 0 for SGP4 numerical stability)
    const eccentricity = 0.0001;

    // RAAN spacing between planes (360° / P)
    const raanSpacing = TAU / planes;

    // True anomaly spacing within each plane (360° / satsPerPlane)
    const trueAnomalySpacing = TAU / satsPerPlane;

    // Phase offset per plane = F * (360° / T)
    const phaseOffsetPerPlane = phasing * (TAU / totalSats);

    for (let planeIndex = 0; planeIndex < planes; planeIndex++) {
      // Calculate RAAN for this plane
      const rightAscension = (planeIndex * raanSpacing) as Radians;

      // Calculate phase offset for this plane
      const planePhaseOffset = planeIndex * phaseOffsetPerPlane;

      for (let satIndex = 0; satIndex < satsPerPlane; satIndex++) {
        // Calculate true anomaly for this satellite
        let trueAnomaly = satIndex * trueAnomalySpacing + planePhaseOffset;

        // Normalize to [0, 2π)
        trueAnomaly = ((trueAnomaly % TAU) + TAU) % TAU;

        // Create classical elements
        const elements = new ClassicalElements({
          epoch: epochUTC,
          semimajorAxis,
          eccentricity,
          inclination: inclinationRad,
          rightAscension,
          argPerigee: 0 as Radians,
          trueAnomaly: trueAnomaly as Radians,
        });

        // Generate TLE from classical elements
        const tle = Tle.fromClassicalElements(elements);

        // Create descriptive satellite name
        const satName = `Walker-P${planeIndex + 1}-S${satIndex + 1}`;

        // Create satellite object
        const satellite = new Satellite({
          tle1: tle.line1,
          tle2: tle.line2,
          name: satName,
        });

        satellites.push(satellite);
      }
    }

    return satellites;
  }
}
