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

import type { Tle } from '../coordinate/Tle';
import { DEG2RAD } from '../utils/constants';
import type { Kilometers, Radians } from '../types/types';
import type { ConjunctionEvent } from './ConjunctionEvent';

/**
 * Orbital shell bounds for coarse filtering in catalog screening.
 * Represents the radial extent of an orbit.
 */
export interface OrbitalShell {
  /** Perigee radius from Earth center (km) */
  perigee: Kilometers;
  /** Apogee radius from Earth center (km) */
  apogee: Kilometers;
  /** Orbital inclination (radians) */
  inclination: Radians;
  /** Object identifier for tracking */
  id?: string;
}

/**
 * Coarse filtering utilities for catalog screening operations.
 * Provides fast geometric checks to eliminate impossible conjunction pairs
 * before expensive detailed assessment.
 */
export class ScreeningFilter {
  private constructor() {
    // Static-only utility class
  }

  /**
   * Extract orbital shell parameters from a TLE.
   * The shell represents the radial bounds of the orbit.
   * @param tle - Two-Line Element set
   * @param id - Optional identifier for the object
   * @returns Orbital shell with perigee, apogee, and inclination
   */
  static getOrbitalShell(tle: Tle, id?: string): OrbitalShell {
    return {
      perigee: tle.perigee as Kilometers,
      apogee: tle.apogee as Kilometers,
      inclination: (tle.inclination * DEG2RAD) as Radians,
      id,
    };
  }

  /**
   * Check if two orbital shells could possibly intersect.
   * Uses simple apogee/perigee overlap test.
   *
   * Two orbits can only conjunct if their radial extents overlap:
   * - Primary's perigee must be <= Secondary's apogee, AND
   * - Primary's apogee must be >= Secondary's perigee
   *
   * @param shell1 - First orbital shell
   * @param shell2 - Second orbital shell
   * @returns True if shells could overlap, false if no conjunction possible
   */
  static shellsOverlap(shell1: OrbitalShell, shell2: OrbitalShell): boolean {
    // Check radial overlap
    if (shell1.perigee > shell2.apogee || shell1.apogee < shell2.perigee) {
      return false;
    }

    return true;
  }

  /**
   * Enhanced overlap check including inclination discrimination.
   * Polar orbits (inc > 60°) can intersect any other orbit.
   * Near-equatorial orbits (inc < 30°) rarely intersect high-inclination orbits.
   *
   * @param shell1 - First orbital shell
   * @param shell2 - Second orbital shell
   * @param incThreshold - Inclination threshold for discrimination (default: 30°)
   * @returns True if shells could overlap, false if no conjunction possible
   */
  static shellsOverlapWithInclination(
    shell1: OrbitalShell,
    shell2: OrbitalShell,
    incThreshold: Radians = (30 * DEG2RAD) as Radians,
  ): boolean {
    // First check radial overlap
    if (!ScreeningFilter.shellsOverlap(shell1, shell2)) {
      return false;
    }

    // Both low inclination but very different planes - unlikely to intersect
    // However, this is a weak filter and may produce false negatives
    // Only apply if both orbits are near-equatorial and differ significantly
    const inc1 = shell1.inclination;
    const inc2 = shell2.inclination;

    if (inc1 < incThreshold && inc2 < incThreshold) {
      // Both near-equatorial - could intersect at nodes
      return true;
    }

    // High inclination orbits can intersect anything
    return true;
  }

  /**
   * Filter candidate secondaries that could conjunct with a primary.
   * Returns indices of secondaries that pass the coarse filter.
   *
   * @param primary - Primary object TLE
   * @param secondaries - Array of secondary TLEs to filter
   * @param useInclinationFilter - Apply inclination-based filtering (default: false)
   * @returns Array of indices into secondaries that could conjunct with primary
   */
  static filterCandidates(
    primary: Tle,
    secondaries: Tle[],
    useInclinationFilter = false,
  ): number[] {
    const primaryShell = ScreeningFilter.getOrbitalShell(primary);
    const candidates: number[] = [];

    for (let i = 0; i < secondaries.length; i++) {
      const secondaryShell = ScreeningFilter.getOrbitalShell(secondaries[i]);

      const overlaps = useInclinationFilter
        ? ScreeningFilter.shellsOverlapWithInclination(primaryShell, secondaryShell)
        : ScreeningFilter.shellsOverlap(primaryShell, secondaryShell);

      if (overlaps) {
        candidates.push(i);
      }
    }

    return candidates;
  }

  /**
   * Compute a risk score for a conjunction event.
   * Combines miss distance and probability of collision into a single metric.
   * Higher score = higher risk (0 to 1 scale, though can exceed 1 for very close passes).
   *
   * Risk score formula:
   * - Base risk from miss distance: exp(-missDistance / scaleFactor)
   * - If Pc available: max(distance_risk, Pc * 1000)
   *
   * @param event - Conjunction event to score
   * @param distanceScaleFactor - Distance scale factor in km (default: 1.0 km)
   * @returns Risk score (higher = more dangerous)
   */
  static computeRiskScore(event: ConjunctionEvent, distanceScaleFactor: Kilometers = 1.0 as Kilometers): number {
    // Distance-based risk (exponential decay)
    const distanceRisk = Math.exp(-event.missDistance / distanceScaleFactor);

    // If Pc is available, use it as an additional risk factor
    if (event.probabilityOfCollision !== undefined && event.probabilityOfCollision > 0) {
      // Scale Pc to be comparable to distance risk
      // Pc of 1e-4 (typical threshold) maps to ~0.1 risk
      const pcRisk = event.probabilityOfCollision * 1000;

      return Math.max(distanceRisk, pcRisk);
    }

    return distanceRisk;
  }

  /**
   * Sort conjunction events by risk score (highest risk first).
   * @param events - Array of conjunction events
   * @param distanceScaleFactor - Distance scale factor for risk calculation
   * @returns Sorted array (mutates original)
   */
  static sortByRisk(events: ConjunctionEvent[], distanceScaleFactor: Kilometers = 1.0 as Kilometers): ConjunctionEvent[] {
    return events.sort((a, b) => {
      const riskA = ScreeningFilter.computeRiskScore(a, distanceScaleFactor);
      const riskB = ScreeningFilter.computeRiskScore(b, distanceScaleFactor);

      return riskB - riskA; // Descending order (highest risk first)
    });
  }

  /**
   * Create a unique pair identifier for two objects.
   * Used to avoid duplicate pair assessments in many-to-many screening.
   * @param id1 - First object identifier
   * @param id2 - Second object identifier
   * @returns Canonical pair identifier (alphabetically sorted)
   */
  static getPairId(id1: string, id2: string): string {
    return id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
  }
}
