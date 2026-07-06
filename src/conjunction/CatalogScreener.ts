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
import type { StateCovariance } from '../covariance/StateCovariance';
import type { ForceModel } from '../force/ForceModel';
import type { EpochUTC } from '../time/EpochUTC';
import type { Kilometers, Seconds } from '../types/types';
import { ConjunctionAssessment } from './ConjunctionAssessment';
import type { ConjunctionEvent } from './ConjunctionEvent';
import { ScreeningFilter } from './ScreeningFilter';

/**
 * Input for a catalog object in screening operations.
 */
export interface CatalogObject {
  /** Two-Line Element set for the object */
  tle: Tle;
  /** Object name/identifier (derived from TLE satnum if not provided) */
  name?: string;
  /** Hard body radius in km (optional, for Pc calculation) */
  radius?: Kilometers;
  /** Covariance matrix (optional, for Pc calculation) */
  covariance?: StateCovariance;
}

/**
 * Configuration options for catalog screening operations.
 */
export interface CatalogScreeningOptions {
  /** Search window start time */
  startTime: EpochUTC;
  /** Search window end time */
  endTime: EpochUTC;
  /** Step size for TCA search in seconds (default: 60s) */
  searchStepSize?: Seconds;
  /** TCA tolerance in seconds (default: 0.001s) */
  tcaTolerance?: Seconds;
  /** Use high-fidelity propagation (RungeKutta89 instead of SGP4) */
  useHighFidelity?: boolean;
  /** Force model for high-fidelity propagation */
  forceModel?: ForceModel;
  /** Skip coarse orbital shell filtering (default: false) */
  skipCoarseFilter?: boolean;
  /** Use inclination-based filtering in addition to radial (default: false) */
  useInclinationFilter?: boolean;
  /** Maximum number of results to return (default: unlimited) */
  maxResults?: number;
  /** Distance scale factor for risk scoring in km (default: 1.0 km) */
  riskScaleFactor?: Kilometers;
}

/**
 * Result from a catalog screening operation.
 */
export interface ScreeningResult {
  /** Primary object identifier */
  primaryId: string;
  /** Secondary object identifier */
  secondaryId: string;
  /** Conjunction event with TCA and miss distance details */
  event: ConjunctionEvent;
  /** Risk score (0-1+, higher = more dangerous) */
  riskScore: number;
}

/**
 * High-performance catalog screening for conjunction assessment.
 *
 * Provides methods to screen one or more objects against a catalog of TLEs
 * to identify potential conjunctions. Uses a two-phase approach:
 * 1. Coarse filter: Eliminate impossible pairs based on orbital geometry
 * 2. Fine assessment: Detailed conjunction assessment on candidate pairs
 *
 * @example
 * ```typescript
 * // Screen a high-value asset against debris catalog
 * const primary: CatalogObject = { tle: issTle, name: 'ISS', radius: 0.05 as Kilometers };
 * const debris: CatalogObject[] = debrisfTles.map(tle => ({ tle }));
 *
 * const results = CatalogScreener.screenOneToMany(primary, debris, {
 *   startTime: EpochUTC.fromDateTime(new Date()),
 *   endTime: EpochUTC.fromDateTime(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
 * });
 *
 * // Results sorted by risk (highest first)
 * results.slice(0, 10).forEach(r => console.log(r.event.toString()));
 * ```
 */
export class CatalogScreener {
  private constructor() {
    // Static-only utility class
  }

  /**
   * Get object identifier from a CatalogObject.
   * Uses name if provided, otherwise satellite number from TLE.
   */
  private static getObjectId_(obj: CatalogObject): string {
    return obj.name ?? obj.tle.satnum.toString();
  }

  /**
   * Screen one primary object against an array of secondary objects.
   * Returns all conjunction events sorted by risk (highest risk first).
   *
   * @param primary - Primary object to screen
   * @param secondaries - Array of secondary objects to screen against
   * @param options - Screening configuration options
   * @returns Array of screening results sorted by risk score (descending)
   */
  static screenOneToMany(
    primary: CatalogObject,
    secondaries: CatalogObject[],
    options: CatalogScreeningOptions,
  ): ScreeningResult[] {
    const results: ScreeningResult[] = [];
    const primaryId = CatalogScreener.getObjectId_(primary);

    // Phase 1: Coarse filtering
    let candidateIndices: number[];

    if (options.skipCoarseFilter) {
      candidateIndices = secondaries.map((_, i) => i);
    } else {
      candidateIndices = ScreeningFilter.filterCandidates(
        primary.tle,
        secondaries.map((s) => s.tle),
        options.useInclinationFilter,
      );
    }

    // Phase 2: Fine assessment on candidates
    const riskScaleFactor = options.riskScaleFactor ?? 1.0 as Kilometers;

    for (const idx of candidateIndices) {
      const secondary = secondaries[idx];
      const secondaryId = CatalogScreener.getObjectId_(secondary);

      try {
        const assessment = new ConjunctionAssessment(
          {
            tle: primary.tle,
            name: primaryId,
            radius: primary.radius,
            covariance: primary.covariance,
          },
          {
            tle: secondary.tle,
            name: secondaryId,
            radius: secondary.radius,
            covariance: secondary.covariance,
          },
        );

        const event = assessment.assess({
          startTime: options.startTime,
          endTime: options.endTime,
          searchStepSize: options.searchStepSize,
          tcaTolerance: options.tcaTolerance,
          useHighFidelity: options.useHighFidelity,
          forceModel: options.forceModel,
        });

        if (event) {
          results.push({
            primaryId,
            secondaryId,
            event,
            riskScore: ScreeningFilter.computeRiskScore(event, riskScaleFactor),
          });
        }
      } catch {
        // Skip pairs that fail assessment (e.g., propagation errors)
        continue;
      }
    }

    // Sort by risk score (highest first)
    results.sort((a, b) => b.riskScore - a.riskScore);

    // Apply maxResults limit if specified
    if (options.maxResults !== undefined && results.length > options.maxResults) {
      return results.slice(0, options.maxResults);
    }

    return results;
  }

  /**
   * Screen multiple primary objects against multiple secondary objects.
   * Avoids duplicate pair assessments (A vs B is same as B vs A).
   *
   * @param primaries - Array of primary objects
   * @param secondaries - Array of secondary objects
   * @param options - Screening configuration options
   * @returns Array of screening results sorted by risk score (descending)
   */
  static screenManyToMany(
    primaries: CatalogObject[],
    secondaries: CatalogObject[],
    options: CatalogScreeningOptions,
  ): ScreeningResult[] {
    const results: ScreeningResult[] = [];
    const processedPairs = new Set<string>();
    const riskScaleFactor = options.riskScaleFactor ?? 1.0 as Kilometers;

    for (const primary of primaries) {
      const primaryId = CatalogScreener.getObjectId_(primary);

      // Phase 1: Coarse filtering for this primary
      let candidateIndices: number[];

      if (options.skipCoarseFilter) {
        candidateIndices = secondaries.map((_, i) => i);
      } else {
        candidateIndices = ScreeningFilter.filterCandidates(
          primary.tle,
          secondaries.map((s) => s.tle),
          options.useInclinationFilter,
        );
      }

      // Phase 2: Fine assessment on candidates
      for (const idx of candidateIndices) {
        const secondary = secondaries[idx];
        const secondaryId = CatalogScreener.getObjectId_(secondary);

        // Skip self-conjunction
        if (primaryId === secondaryId) {
          continue;
        }

        // Skip already processed pairs
        const pairId = ScreeningFilter.getPairId(primaryId, secondaryId);

        if (processedPairs.has(pairId)) {
          continue;
        }
        processedPairs.add(pairId);

        try {
          const assessment = new ConjunctionAssessment(
            {
              tle: primary.tle,
              name: primaryId,
              radius: primary.radius,
              covariance: primary.covariance,
            },
            {
              tle: secondary.tle,
              name: secondaryId,
              radius: secondary.radius,
              covariance: secondary.covariance,
            },
          );

          const event = assessment.assess({
            startTime: options.startTime,
            endTime: options.endTime,
            searchStepSize: options.searchStepSize,
            tcaTolerance: options.tcaTolerance,
            useHighFidelity: options.useHighFidelity,
            forceModel: options.forceModel,
          });

          if (event) {
            results.push({
              primaryId,
              secondaryId,
              event,
              riskScore: ScreeningFilter.computeRiskScore(event, riskScaleFactor),
            });
          }
        } catch {
          // Skip pairs that fail assessment
          continue;
        }
      }
    }

    // Sort by risk score (highest first)
    results.sort((a, b) => b.riskScore - a.riskScore);

    // Apply maxResults limit if specified
    if (options.maxResults !== undefined && results.length > options.maxResults) {
      return results.slice(0, options.maxResults);
    }

    return results;
  }

  /**
   * Screen all objects in a catalog against each other.
   * Convenience method that calls screenManyToMany with the same array
   * for both primaries and secondaries.
   *
   * @param catalog - Array of objects to screen against each other
   * @param options - Screening configuration options
   * @returns Array of screening results sorted by risk score (descending)
   */
  static screenCatalog(
    catalog: CatalogObject[],
    options: CatalogScreeningOptions,
  ): ScreeningResult[] {
    return CatalogScreener.screenManyToMany(catalog, catalog, options);
  }
}
