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

import { EpochUTC, Matrix, Vector3D } from '../main.js';
import { Kilometers, KilometersPerSecond, Seconds } from '../types/types.js';
import { Satellite } from '../objects/Satellite.js';

/**
 * Represents a close approach event between two satellites.
 */
export interface CloseApproach {
  /** Time of closest approach */
  tca: EpochUTC;
  /** Miss distance in kilometers */
  missDistance: Kilometers;
  /** Relative velocity at TCA in km/s */
  relativeVelocity: KilometersPerSecond;
  /** Position of primary satellite at TCA */
  primaryPosition: Vector3D<Kilometers>;
  /** Position of secondary satellite at TCA */
  secondaryPosition: Vector3D<Kilometers>;
  /** Velocity of primary satellite at TCA */
  primaryVelocity: Vector3D<KilometersPerSecond>;
  /** Velocity of secondary satellite at TCA */
  secondaryVelocity: Vector3D<KilometersPerSecond>;
}

/**
 * Options for conjunction analysis.
 */
export interface ConjunctionOptions {
  /** Start epoch for analysis */
  startEpoch: EpochUTC;
  /** Duration to analyze in seconds */
  duration: Seconds;
  /** Initial time step for coarse search in seconds (default: 60) */
  coarseStepSize?: Seconds;
  /** Maximum miss distance to consider a conjunction in kilometers (default: 10) */
  maxMissDistance?: Kilometers;
  /** Whether to refine TCA using interpolation (default: true) */
  refineTca?: boolean;
}

/**
 * Conjunction analyzer for detecting close approaches between satellites.
 */
export class ConjunctionAnalysis {
  private primary_: Satellite;
  private secondary_: Satellite;

  constructor(primary: Satellite, secondary: Satellite) {
    this.primary_ = primary;
    this.secondary_ = secondary;
  }

  /**
   * Find all close approaches during the specified time period.
   * @param options - Conjunction analysis options
   * @returns Array of close approach events
   */
  findConjunctions(options: ConjunctionOptions): CloseApproach[] {
    const {
      startEpoch,
      duration,
      coarseStepSize = 60 as Seconds,
      maxMissDistance = 10 as Kilometers,
      refineTca = true,
    } = options;

    const conjunctions: CloseApproach[] = [];
    const steps = Math.floor(duration / coarseStepSize);

    let lastDistance: Kilometers | null = null;
    let lastEpoch: EpochUTC | null = null;
    let decreasingDistance = false;

    // Coarse search for local minima in distance
    for (let i = 0; i <= steps; i++) {
      const offset = (i * coarseStepSize) as Seconds;
      const epoch = startEpoch.roll(offset);

      const distance = this.calculateDistance_(epoch);

      if (distance === null) {
        lastDistance = null;
        continue;
      }

      if (lastDistance !== null && lastEpoch !== null) {
        if (distance < lastDistance) {
          decreasingDistance = true;
        } else if (decreasingDistance && distance > lastDistance) {
          // Found a local minimum - potential TCA
          if (lastDistance <= maxMissDistance) {
            let tca = lastEpoch;
            let missDistance = lastDistance;

            // Refine TCA if requested
            if (refineTca) {
              const refined = this.refineTca_(lastEpoch, coarseStepSize);

              tca = refined.tca;
              missDistance = refined.missDistance;
            }

            const approach = this.createCloseApproach_(tca, missDistance);

            if (approach) {
              conjunctions.push(approach);
            }
          }
          decreasingDistance = false;
        }
      }

      lastDistance = distance;
      lastEpoch = epoch;
    }

    return conjunctions;
  }

  /**
   * Find the next close approach after a given epoch.
   * @param startEpoch - Epoch to start searching from
   * @param maxSearchDuration - Maximum time to search in seconds (default: 7 days)
   * @param maxMissDistance - Maximum miss distance in kilometers (default: 10)
   * @returns Next close approach or null if none found
   */
  findNextConjunction(
    startEpoch: EpochUTC,
    maxSearchDuration: Seconds = 604800 as Seconds,
    maxMissDistance: Kilometers = 10 as Kilometers,
  ): CloseApproach | null {
    const conjunctions = this.findConjunctions({
      startEpoch,
      duration: maxSearchDuration,
      maxMissDistance,
    });

    return conjunctions.length > 0 ? conjunctions[0] : null;
  }

  /**
   * Calculate the current distance between the two satellites.
   * @param epoch - Epoch to calculate distance
   * @returns Distance in kilometers or null if propagation fails
   */
  private calculateDistance_(epoch: EpochUTC): Kilometers | null {
    const state1 = this.primary_.toJ2000(epoch.toDateTime());
    const state2 = this.secondary_.toJ2000(epoch.toDateTime());

    if (!state1 || !state2) {
      return null;
    }

    const dx = state2.position.x - state1.position.x;
    const dy = state2.position.y - state1.position.y;
    const dz = state2.position.z - state1.position.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz) as Kilometers;
  }

  /**
   * Refine the time of closest approach using golden section search.
   * @param approximateTca - Approximate TCA from coarse search
   * @param searchWindow - Window around approximate TCA to search (in seconds)
   * @returns Refined TCA and miss distance
   */
  private refineTca_(
    approximateTca: EpochUTC,
    searchWindow: Seconds,
  ): { tca: EpochUTC; missDistance: Kilometers } {
    const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
    const resphi = 2 - phi;

    let a = -searchWindow / 2;
    let b = searchWindow / 2;

    let x1 = a + resphi * (b - a);
    let x2 = b - resphi * (b - a);

    let f1 = this.calculateDistance_(approximateTca.roll(x1 as Seconds));
    let f2 = this.calculateDistance_(approximateTca.roll(x2 as Seconds));

    const tolerance = 0.1; // 0.1 second tolerance

    while (Math.abs(b - a) > tolerance) {
      if (f1 !== null && f2 !== null && f1 < f2) {
        b = x2;
        x2 = x1;
        f2 = f1;
        x1 = a + resphi * (b - a);
        f1 = this.calculateDistance_(approximateTca.roll(x1 as Seconds));
      } else {
        a = x1;
        x1 = x2;
        f1 = f2;
        x2 = b - resphi * (b - a);
        f2 = this.calculateDistance_(approximateTca.roll(x2 as Seconds));
      }
    }

    const tcaOffset = ((a + b) / 2) as Seconds;
    const tca = approximateTca.roll(tcaOffset);
    const missDistance = this.calculateDistance_(tca) ?? (0 as Kilometers);

    return { tca, missDistance };
  }

  /**
   * Create a close approach object with full state information.
   */
  private createCloseApproach_(tca: EpochUTC, missDistance: Kilometers): CloseApproach | null {
    const state1 = this.primary_.toJ2000(tca.toDateTime());
    const state2 = this.secondary_.toJ2000(tca.toDateTime());

    if (!state1 || !state2) {
      return null;
    }

    const relVel = new Vector3D(
      (state2.velocity.x - state1.velocity.x) as KilometersPerSecond,
      (state2.velocity.y - state1.velocity.y) as KilometersPerSecond,
      (state2.velocity.z - state1.velocity.z) as KilometersPerSecond,
    );
    const relSpeed = relVel.magnitude() as KilometersPerSecond;

    return {
      tca,
      missDistance,
      relativeVelocity: relSpeed,
      primaryPosition: state1.position,
      secondaryPosition: state2.position,
      primaryVelocity: state1.velocity,
      secondaryVelocity: state2.velocity,
    };
  }
}
