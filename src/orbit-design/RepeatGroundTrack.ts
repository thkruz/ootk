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
import { ValidationError } from '../errors';
import { EpochUTC } from '../time/EpochUTC';
import { Degrees, Kilometers, Radians } from '../types/types';
import { DEG2RAD, RAD2DEG, secondsPerDay, secondsPerSiderealDay, TAU } from '../utils/constants';

/**
 * Sun-synchronous nodal precession rate in rad/s.
 * Earth moves ~0.9856°/day around the Sun, so the RAAN must precess at this rate
 * to maintain constant local solar time.
 */
const SUN_SYNC_PRECESSION_RAD_PER_SEC = (0.9856 * DEG2RAD) / secondsPerDay;

/**
 * Reference radius for the altitudes reported and accepted by {@link RepeatGroundTrack.findNearest}:
 * the WGS-84 equatorial radius in km, matching `ClassicalElements.apogee` / `perigee`.
 */
const ALTITUDE_REFERENCE_RADIUS_KM = 6378.137;

/**
 * Result from repeat ground track calculation.
 */
export interface RepeatOrbitResult {
  /** Orbital elements for this RGT orbit */
  elements: ClassicalElements;
  /** Number of revolutions in repeat cycle */
  revolutions: number;
  /** Number of days in repeat cycle */
  days: number;
  /** Altitude in km: semimajor axis minus the WGS-84 equatorial radius 6378.137 km */
  altitude: Kilometers;
  /** Whether orbit is sun-synchronous */
  isSunSynchronous: boolean;
  /** Nodal precession rate in deg/day (negative for prograde orbits, +0.9856 for sun-synchronous) */
  nodalPrecessionRate: number;
  /** Ground track spacing at equator (km) */
  groundTrackSpacing: Kilometers;
}

/**
 * Options for RGT calculation.
 */
export interface RepeatGroundTrackOptions {
  /** Orbital eccentricity (default: 0.0001 for near-circular) */
  eccentricity?: number;
  /** Require sun-synchronous orbit (auto-calculates inclination) */
  sunSynchronous?: boolean;
  /** Maximum iterations for convergence (default: 50) */
  maxIterations?: number;
  /** Convergence tolerance in km (default: 0.001) */
  tolerance?: Kilometers;
  /** Epoch for generated elements (default: current date) */
  epoch?: Date;
}

/**
 * Options for finding nearest RGT orbits.
 */
export interface FindNearestOptions extends RepeatGroundTrackOptions {
  /** Orbital inclination in degrees (required unless sunSynchronous=true) */
  inclination?: Degrees;
  /** Maximum repeat cycle length in days (default: 30) */
  maxDays?: number;
  /** Maximum number of results to return (default: 10) */
  maxResults?: number;
}

/**
 * Static utility class for calculating repeat ground track (RGT) orbits.
 *
 * A repeat ground track orbit is one where the satellite's ground track repeats
 * exactly after a specific number of orbital revolutions over a specific number
 * of days. This is essential for Earth observation missions that require
 * consistent revisit patterns.
 *
 * @example
 * ```typescript
 * // Calculate Landsat-8 style orbit: 233 revs / 16 days
 * const elements = RepeatGroundTrack.calculate(233, 16, 98.2 as Degrees);
 * console.log(`Semimajor axis: ${elements.semimajorAxis} km`); // ~7077.7 km
 *
 * // Find RGT orbits near 700 km (altitude above 6378.137 km)
 * const orbits = RepeatGroundTrack.findNearest(
 *   700 as Kilometers,
 *   50 as Kilometers,
 *   { sunSynchronous: true }
 * );
 * ```
 */
export class RepeatGroundTrack {
  private constructor() {
    // Static-only class - disable constructor
  }

  /**
   * Calculate orbital elements for a repeat ground track orbit.
   *
   * The calculation uses the secular J2 rates of mean anomaly, argument of perigee and right
   * ascension (Vallado, 4th ed., Algorithm 71): the track repeats when R nodal periods
   * 2 pi / (n + Mdot + omegadot) equal D nodal days 2 pi / (omegaE - Omegadot).
   *
   * @param revolutions - Number of orbital revolutions in repeat cycle (must be positive integer)
   * @param days - Number of days in repeat cycle (must be positive integer)
   * @param inclination - Orbital inclination in degrees (optional if sunSynchronous=true)
   * @param options - Additional calculation options
   * @returns Classical elements for the RGT orbit
   * @throws ValidationError if parameters are invalid
   *
   * @example
   * ```typescript
   * // Landsat-8 style orbit: 233 revs / 16 days, sun-synchronous
   * const elements = RepeatGroundTrack.calculate(233, 16, 98.2 as Degrees);
   * console.log(`Semimajor axis: ${elements.semimajorAxis} km`);
   * // Output: ~7077.7 km (about 699.6 km above the 6378.137 km equatorial radius)
   *
   * // Sun-synchronous RGT (inclination auto-calculated)
   * const ssoElements = RepeatGroundTrack.calculate(233, 16, undefined, {
   *   sunSynchronous: true
   * });
   * ```
   */
  static calculate(
    revolutions: number,
    days: number,
    inclination?: Degrees,
    options: RepeatGroundTrackOptions = {},
  ): ClassicalElements {
    const {
      eccentricity = 0.0001,
      sunSynchronous = false,
      maxIterations = 50,
      tolerance = 0.001 as Kilometers,
      epoch = new Date(),
    } = options;

    // Validate parameters
    RepeatGroundTrack.validateParams_(revolutions, days, inclination, sunSynchronous);

    // Calculate revolutions per day
    const revsPerDay = revolutions / days;

    // Initial estimate of semi-major axis (without J2)
    // n = revsPerDay * 2π / secondsPerSiderealDay (rad/s)
    const nInitial = (revsPerDay * TAU) / secondsPerSiderealDay;
    let sma = ((Earth.mu / (nInitial * nInitial)) ** (1 / 3)) as Kilometers;

    // Convert inclination to radians or calculate for sun-synchronous
    let incRad: Radians;

    if (sunSynchronous) {
      // Calculate sun-synchronous inclination for initial SMA estimate
      incRad = RepeatGroundTrack.calculateSunSyncInclination_(sma, eccentricity);
    } else {
      incRad = ((inclination as number) * DEG2RAD) as Radians;
    }

    /*
     * Iterative refinement with secular J2 rates (Vallado, Fundamentals of Astrodynamics and
     * Applications, 4th ed., Sec. 11.4.2, Algorithm 71):
     *
     *   K  = J2 (Re / p)^2
     *   Mdot     = 3/4 n K sqrt(1 - e^2) (3 cos^2 i - 1)   (J2 drift of mean anomaly)
     *   omegadot = 3/4 n K (5 cos^2 i - 1)                 (apsidal rotation)
     *   Omegadot = -3/2 n K cos i                          (nodal regression)
     *
     * The satellite completes one nodal revolution when its argument of latitude advances by
     * 2 pi, at the rate n + Mdot + omegadot. The Earth turns once relative to the orbit plane
     * at the rate omegaE - Omegadot. The track repeats after R revolutions in D nodal days:
     *
     *   R / (n + Mdot + omegadot) = D / (omegaE - Omegadot)
     *
     * Solved by fixed-point iteration on n (all three rates scale with n through K).
     */
    const earthRotationRate = TAU / secondsPerSiderealDay;
    const sqrtOneMinusE2 = Math.sqrt(1 - eccentricity * eccentricity);

    for (let iter = 0; iter < maxIterations; iter++) {
      const prevSma = sma;

      // If sun-synchronous, update inclination for current SMA
      if (sunSynchronous) {
        incRad = RepeatGroundTrack.calculateSunSyncInclination_(sma, eccentricity);
      }

      const p = sma * (1 - eccentricity * eccentricity); // semi-latus rectum (km)
      const cosI = Math.cos(incRad);
      const cos2I = cosI * cosI;
      const k = Earth.j2 * (Earth.radiusEquator / p) ** 2;
      const nKeplerian = Math.sqrt(Earth.mu / (sma * sma * sma)); // rad/s

      // Nodal regression Omegadot (rad/s), negative for prograde orbits
      const nodalPrecessionRate = (-3 / 2) * nKeplerian * k * cosI;

      // (n + Mdot + omegadot) / n
      const nodalRateFactor = 1 + (3 / 4) * k * (sqrtOneMinusE2 * (3 * cos2I - 1) + (5 * cos2I - 1));

      // Required rate of the argument of latitude (rad/s), then the Keplerian n that gives it
      const argLatRateRequired = (revolutions / days) * (earthRotationRate - nodalPrecessionRate);
      const nRequired = argLatRateRequired / nodalRateFactor;

      sma = ((Earth.mu / (nRequired * nRequired)) ** (1 / 3)) as Kilometers;

      // Check convergence
      if (Math.abs(sma - prevSma) < tolerance) {
        break;
      }
    }

    // Final inclination calculation for sun-synchronous
    if (sunSynchronous) {
      incRad = RepeatGroundTrack.calculateSunSyncInclination_(sma, eccentricity);
    }

    // Build ClassicalElements
    return new ClassicalElements({
      epoch: EpochUTC.fromDateTime(epoch),
      semimajorAxis: sma,
      eccentricity,
      inclination: incRad,
      rightAscension: 0 as Radians,
      argPerigee: 0 as Radians,
      trueAnomaly: 0 as Radians,
    });
  }

  /**
   * Find repeat ground track orbits near a target altitude.
   *
   * Searches through possible R/D combinations to find RGT orbits within
   * the specified altitude range, sorted by proximity to the target.
   *
   * Altitudes (input and `RepeatOrbitResult.altitude`) are semimajor axis minus the WGS-84
   * equatorial radius 6378.137 km, the same reference as `ClassicalElements.apogee`.
   *
   * @param targetAltitude - Desired altitude in km above 6378.137 km
   * @param maxDeviation - Maximum altitude deviation to search in km
   * @param options - Search options including inclination constraints
   * @returns Array of nearby RGT orbits sorted by altitude proximity. `isSunSynchronous` is true
   * only when the nodal precession is within 0.1 deg/day of +0.9856 deg/day (eastward).
   *
   * @example
   * ```typescript
   * // Find sun-synchronous RGT orbits near 700 km within ±50 km
   * const orbits = RepeatGroundTrack.findNearest(
   *   700 as Kilometers,
   *   50 as Kilometers,
   *   { sunSynchronous: true }
   * );
   *
   * for (const orbit of orbits) {
   *   console.log(`${orbit.revolutions}/${orbit.days}: ${orbit.altitude.toFixed(1)} km`);
   * }
   * ```
   */
  static findNearest(
    targetAltitude: Kilometers,
    maxDeviation: Kilometers,
    options: FindNearestOptions = {},
  ): RepeatOrbitResult[] {
    const {
      inclination,
      sunSynchronous = false,
      maxDays = 30,
      maxResults = 10,
      eccentricity = 0.0001,
      epoch = new Date(),
    } = options;

    // Validate
    if (targetAltitude <= 0) {
      throw new ValidationError('Target altitude must be positive', 'targetAltitude', targetAltitude);
    }

    if (maxDeviation <= 0) {
      throw new ValidationError('Max deviation must be positive', 'maxDeviation', maxDeviation);
    }

    if (!sunSynchronous && inclination === undefined) {
      throw new ValidationError(
        'Inclination must be provided unless sunSynchronous=true',
        'inclination',
        undefined,
      );
    }

    const minAlt = (targetAltitude - maxDeviation) as Kilometers;
    const maxAlt = (targetAltitude + maxDeviation) as Kilometers;

    // Generate candidate R/D pairs
    const candidates = RepeatGroundTrack.findRgtCandidates_(minAlt, maxAlt, maxDays);

    // Calculate each candidate and filter by altitude
    const results: RepeatOrbitResult[] = [];

    for (const { revs, days } of candidates) {
      try {
        const elements = RepeatGroundTrack.calculate(revs, days, inclination, {
          eccentricity,
          sunSynchronous,
          epoch,
        });

        const altitude = (elements.semimajorAxis - ALTITUDE_REFERENCE_RADIUS_KM) as Kilometers;

        if (altitude >= minAlt && altitude <= maxAlt) {
          // Calculate nodal precession rate in deg/day
          const nodalPrecessionRate = elements.nodalPrecessionRate * secondsPerDay * RAD2DEG;

          /*
           * Sun-synchronous means the node advances eastward with the mean Sun at +0.9856 deg/day.
           * The sign matters: a prograde orbit regressing at -0.9856 deg/day drifts 2 deg/day
           * relative to the Sun. Tolerance 0.1 deg/day allows for J2 modeling differences.
           */
          const isSunSynchronous = Math.abs(nodalPrecessionRate - 0.9856) < 0.1;

          // Ground track spacing at equator
          // The sub-satellite tracks are spaced by Earth circumference / revolutions per repeat
          const earthCircumference = 2 * Math.PI * Earth.radiusEquator;
          const groundTrackSpacing = (earthCircumference / revs) as Kilometers;

          results.push({
            elements,
            revolutions: revs,
            days,
            altitude,
            isSunSynchronous,
            nodalPrecessionRate,
            groundTrackSpacing,
          });
        }
      } catch {
        // Skip invalid combinations
        continue;
      }
    }

    // Sort by proximity to target altitude
    results.sort((a, b) => Math.abs(a.altitude - targetAltitude) - Math.abs(b.altitude - targetAltitude));

    // Return top results
    return results.slice(0, maxResults);
  }

  /**
   * Calculate the sun-synchronous inclination for a given altitude.
   *
   * For a sun-synchronous orbit, the nodal precession rate must equal
   * Earth's orbital motion around the Sun (~0.9856°/day).
   *
   * @param altitude - Orbital altitude in km
   * @param eccentricity - Orbital eccentricity (default: 0.0001)
   * @returns Inclination in degrees for sun-synchronous orbit
   * @throws ValidationError if no sun-synchronous solution exists at this altitude
   *
   * @example
   * ```typescript
   * // Calculate SSO inclination for 700 km altitude
   * const inc = RepeatGroundTrack.sunSynchronousInclination(700 as Kilometers);
   * console.log(`Sun-synchronous inclination: ${inc.toFixed(2)}°`);
   * // Output: ~98.2°
   * ```
   */
  static sunSynchronousInclination(altitude: Kilometers, eccentricity = 0.0001): Degrees {
    if (altitude <= 0) {
      throw new ValidationError('Altitude must be positive', 'altitude', altitude);
    }

    if (altitude < 160) {
      throw new ValidationError('Altitude must be at least 160 km (above dense atmosphere)', 'altitude', altitude);
    }

    const sma = (altitude + Earth.radiusMean) as Kilometers;
    const incRad = RepeatGroundTrack.calculateSunSyncInclination_(sma, eccentricity);

    return (incRad * RAD2DEG) as Degrees;
  }

  /**
   * Validates calculation parameters.
   */
  private static validateParams_(
    revolutions: number,
    days: number,
    inclination: Degrees | undefined,
    sunSynchronous: boolean,
  ): void {
    if (!Number.isInteger(revolutions) || revolutions < 1) {
      throw new ValidationError('Revolutions must be a positive integer', 'revolutions', revolutions);
    }

    if (!Number.isInteger(days) || days < 1) {
      throw new ValidationError('Days must be a positive integer', 'days', days);
    }

    if (revolutions <= days) {
      throw new ValidationError(
        `Revolutions (${revolutions}) must be greater than days (${days}) for a valid LEO/MEO orbit`,
        'revolutions',
        revolutions,
      );
    }

    if (!sunSynchronous && inclination === undefined) {
      throw new ValidationError(
        'Inclination must be provided unless sunSynchronous=true',
        'inclination',
        undefined,
      );
    }

    if (inclination !== undefined) {
      if (inclination < 0 || inclination > 180) {
        throw new ValidationError('Inclination must be between 0 and 180 degrees', 'inclination', inclination);
      }
    }
  }

  /**
   * Calculate sun-synchronous inclination for a given semi-major axis.
   * @param sma - Semi-major axis in km
   * @param eccentricity - Orbital eccentricity
   * @returns Inclination in radians
   */
  private static calculateSunSyncInclination_(sma: Kilometers, eccentricity: number): Radians {
    // For sun-synchronous orbit:
    // Ω̇ = -3/2 * J2 * (Re/a)² * n * cos(i) / (1-e²)² = +0.9856°/day
    // Note: The precession is eastward (positive in the direction of Earth's motion)
    // but the formula gives negative for prograde orbits

    const n = Math.sqrt(Earth.mu / (sma * sma * sma)); // mean motion rad/s
    const p = sma * (1 - eccentricity * eccentricity); // semi-latus rectum

    // Required precession rate (positive eastward)
    const requiredPrecession = SUN_SYNC_PRECESSION_RAD_PER_SEC;

    // From Ω̇ = -3/2 * J2 * (Re/p)² * n * cos(i)
    // cos(i) = Ω̇ / (-3/2 * J2 * (Re/p)² * n)
    const factor = (-3 / 2) * Earth.j2 * (Earth.radiusEquator / p) ** 2 * n;
    const cosI = requiredPrecession / factor;

    // Check if solution exists
    if (cosI < -1 || cosI > 1) {
      throw new ValidationError(
        `No sun-synchronous orbit exists at altitude ${(sma - Earth.radiusMean).toFixed(0)} km`,
        'altitude',
        sma - Earth.radiusMean,
      );
    }

    return Math.acos(cosI) as Radians;
  }

  /**
   * Generate candidate R/D pairs for a given altitude range.
   * @param minAlt - Minimum altitude in km above 6378.137 km
   * @param maxAlt - Maximum altitude in km above 6378.137 km
   * @param maxDays - Maximum repeat cycle length in days
   * @returns Array of {revs, days} candidates
   */
  private static findRgtCandidates_(
    minAlt: Kilometers,
    maxAlt: Kilometers,
    maxDays: number,
  ): Array<{ revs: number; days: number }> {
    const candidates: Array<{ revs: number; days: number }> = [];

    // Calculate approximate revs/day range from altitude
    const minSma = (minAlt + ALTITUDE_REFERENCE_RADIUS_KM) as Kilometers;
    const maxSma = (maxAlt + ALTITUDE_REFERENCE_RADIUS_KM) as Kilometers;

    // Period = 2π * sqrt(a³/μ) seconds
    const minPeriod = TAU * Math.sqrt((minSma * minSma * minSma) / Earth.mu);
    const maxPeriod = TAU * Math.sqrt((maxSma * maxSma * maxSma) / Earth.mu);

    // Revs per day (higher altitude = fewer revs)
    const minRevsPerDay = secondsPerSiderealDay / maxPeriod;
    const maxRevsPerDay = secondsPerSiderealDay / minPeriod;

    // Generate all valid R/D combinations
    for (let d = 1; d <= maxDays; d++) {
      const minRevs = Math.floor(d * minRevsPerDay);
      const maxRevs = Math.ceil(d * maxRevsPerDay);

      for (let r = minRevs; r <= maxRevs; r++) {
        if (r > d) {
          // Only add unique reduced fractions to avoid duplicates
          const gcd = RepeatGroundTrack.gcd_(r, d);

          if (gcd === 1) {
            candidates.push({ revs: r, days: d });
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Calculate greatest common divisor.
   */
  private static gcd_(a: number, b: number): number {
    while (b !== 0) {
      const t = b;

      b = a % b;
      a = t;
    }

    return a;
  }
}
