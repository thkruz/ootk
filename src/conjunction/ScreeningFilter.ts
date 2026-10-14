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
import type { Kilometers, Radians } from '../types/types';
import type { ConjunctionEvent } from './ConjunctionEvent';

/**
 * Default pad (km) for the apogee/perigee filter. Mean-element perigee and apogee from a TLE
 * differ from the osculating radius by the J2 short-period terms (several km in LEO, of order
 * J2 R^2 / a), and the orbit evolves over the screening window, so two shells whose mean bounds
 * are a few km apart can still meet. The pad follows the apogee/perigee filter of Hoots,
 * Crawford and Roehrich (1984), "An analytic method to determine future close approaches between
 * satellites", Celestial Mechanics 33, which rejects a pair only when
 * max(q1, q2) - min(Q1, Q2) > D for a pad D.
 */
export const DEFAULT_SHELL_PAD_KM = 10 as Kilometers;

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
   * @returns Orbital shell with perigee and apogee as geocentric radii (km, from
   *   `Tle.perigeeRadius` / `Tle.apogeeRadius`) and inclination in radians (`Tle.inclination` is
   *   already radians)
   */
  static getOrbitalShell(tle: Tle, id?: string): OrbitalShell {
    return {
      perigee: tle.perigeeRadius,
      apogee: tle.apogeeRadius,
      inclination: tle.inclination as Radians,
      id,
    };
  }

  /**
   * Check if two orbital shells could possibly intersect (apogee/perigee filter).
   *
   * Two orbits can only conjunct if their radial extents, widened by `pad`, overlap. The pair is
   * rejected only when one shell lies entirely above the other by more than the pad:
   * perigee1 - pad > apogee2, or perigee2 - pad > apogee1.
   *
   * @param shell1 - First orbital shell
   * @param shell2 - Second orbital shell
   * @param pad - Radial pad in km (default {@link DEFAULT_SHELL_PAD_KM}); add the screening
   *   distance threshold to it when screening against a miss-distance threshold
   * @returns True if shells could overlap, false if no conjunction is possible
   */
  static shellsOverlap(shell1: OrbitalShell, shell2: OrbitalShell, pad: Kilometers = DEFAULT_SHELL_PAD_KM): boolean {
    return !(shell1.perigee - pad > shell2.apogee || shell2.perigee - pad > shell1.apogee);
  }

  /**
   * Filter candidate secondaries that could conjunct with a primary.
   * Returns indices of secondaries that pass the coarse filter.
   *
   * @param primary - Primary object TLE
   * @param secondaries - Array of secondary TLEs to filter
   * @param pad - Radial pad in km for the apogee/perigee filter (default {@link DEFAULT_SHELL_PAD_KM})
   * @returns Array of indices into secondaries that could conjunct with primary
   */
  static filterCandidates(
    primary: Tle,
    secondaries: Tle[],
    pad: Kilometers = DEFAULT_SHELL_PAD_KM,
  ): number[] {
    const primaryShell = ScreeningFilter.getOrbitalShell(primary);
    const candidates: number[] = [];

    for (let i = 0; i < secondaries.length; i++) {
      const secondaryShell = ScreeningFilter.getOrbitalShell(secondaries[i]);

      if (ScreeningFilter.shellsOverlap(primaryShell, secondaryShell, pad)) {
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
