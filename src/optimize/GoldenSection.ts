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

import { DifferentiableFunction } from '../types/types';

/**
 * Golden Section Search optimizer for finding the minimum or maximum of a
 * unimodal function within a bounded interval.
 *
 * ## Algorithm Overview
 *
 * The Golden Section Search is a derivative-free optimization technique that
 * efficiently narrows down the location of an extremum (minimum or maximum)
 * by exploiting the mathematical properties of the golden ratio
 * (φ ≈ 1.618033988749895).
 *
 * The algorithm works by:
 * 1. Maintaining a search interval [a, b] known to contain the optimum
 * 2. Selecting two interior probe points c and d using the golden ratio
 * 3. Evaluating the objective function at c and d
 * 4. Eliminating the subinterval that cannot contain the optimum
 * 5. Repeating until the interval width is below the specified tolerance
 *
 * The golden ratio ensures that one of the probe points from the previous
 * iteration can be reused, requiring only one new function evaluation per
 * iteration (though this implementation evaluates both for simplicity).
 *
 * ## Convergence
 *
 * The interval shrinks by a factor of φ⁻¹ ≈ 0.618 each iteration.
 * For an initial interval of width W and tolerance ε, the number of
 * iterations required is approximately: log(W/ε) / log(φ) ≈ 2.078 × log₁₀(W/ε)
 *
 * ## Requirements
 *
 * The objective function must be **unimodal** on the search interval, meaning:
 * - For minimization: exactly one local minimum exists in [lower, upper]
 * - For maximization: exactly one local maximum exists in [lower, upper]
 *
 * If the function has multiple local extrema, the algorithm may converge to
 * any one of them depending on the initial bounds.
 *
 * @example Finding minimum distance to a target position
 * ```typescript
 * import { GoldenSection } from 'ootk';
 *
 * // Find the time when a satellite is closest to a ground station
 * const distanceToStation = (minutesFromEpoch: number): number => {
 *   const satPosition = satellite.propagate(epoch.addMinutes(minutesFromEpoch));
 *   return satPosition.distanceTo(groundStation);
 * };
 *
 * // Search for minimum distance within a 90-minute orbital period
 * const optimalTime = GoldenSection.search(
 *   distanceToStation,
 *   0,      // start of search window (minutes)
 *   90,     // end of search window (minutes)
 *   { tolerance: 0.001 }  // precision of ~0.001 minutes (~60ms)
 * );
 *
 * console.log(`Closest approach at T+${optimalTime.toFixed(3)} minutes`);
 * ```
 *
 * @example Finding maximum elevation angle
 * ```typescript
 * import { GoldenSection } from 'ootk';
 *
 * // Find when satellite reaches maximum elevation above horizon
 * const elevationAngle = (minutesFromEpoch: number): number => {
 *   const look = groundStation.lookAngles(
 *     satellite.propagate(epoch.addMinutes(minutesFromEpoch))
 *   );
 *   return look.elevation;
 * };
 *
 * // Search for maximum elevation during a pass (solveMax = true)
 * const peakTime = GoldenSection.search(
 *   elevationAngle,
 *   riseTime,   // when satellite rises above horizon
 *   setTime,    // when satellite sets below horizon
 *   { tolerance: 1e-4, solveMax: true }
 * );
 *
 * console.log(`Maximum elevation at T+${peakTime.toFixed(4)} minutes`);
 * ```
 *
 * @see https://en.wikipedia.org/wiki/Golden-section_search
 */
export class GoldenSection {
  /**
   * Inverse of the golden ratio (φ⁻¹ ≈ 0.6180339887).
   *
   * Used to position probe points within the search interval. The golden
   * ratio has the unique property that removing a golden-ratio-sized piece
   * from a segment leaves a segment with the same proportions, enabling
   * efficient reuse of function evaluations.
   */
  private static readonly grInv_: number = 1.0 / (0.5 * (Math.sqrt(5) + 1));

  /**
   * Determines which subinterval to keep based on function values at probe
   * points and the optimization direction.
   * @param fc - Function value at probe point c (closer to lower bound)
   * @param fd - Function value at probe point d (closer to upper bound)
   * @param solveMax - If true, search for maximum; if false, search for minimum
   * @returns True if the interval [a, d] should be kept (discard [c, b]),
   *          false if [c, b] should be kept (discard [a, d])
   */
  private static check_(fc: number, fd: number, solveMax: boolean): boolean {
    return solveMax ? fc > fd : fc < fd;
  }

  /**
   * Searches for the input value that optimizes (minimizes or maximizes) the
   * given objective function within the specified bounds.
   *
   * The search terminates when the remaining interval width falls below the
   * specified tolerance. The returned value is the midpoint of the final
   * interval, guaranteeing the true optimum is within ±(tolerance/2) of the
   * result.
   *
   * @param f - The objective function to optimize. Must be unimodal (have
   *            exactly one local extremum) on the interval [lower, upper].
   * @param lower - Lower bound of the search interval
   * @param upper - Upper bound of the search interval (must be > lower)
   * @param options - Configuration options for the search
   * @param options.tolerance - Convergence threshold for interval width.
   *                            Smaller values yield more precise results but
   *                            require more iterations. Default: 1e-5
   * @param options.solveMax - If true, search for a maximum; if false (default),
   *                           search for a minimum
   * @returns The input value that produces the optimal (minimum or maximum)
   *          output from the objective function
   *
   * @example Basic minimization of a quadratic function
   * ```typescript
   * // Find minimum of f(x) = (x - 3)² on interval [0, 10]
   * const minimum = GoldenSection.search(
   *   (x) => (x - 3) ** 2,
   *   0,
   *   10,
   *   { tolerance: 1e-8 }
   * );
   * console.log(minimum); // ≈ 3.0
   * ```
   */
  static search(
    f: DifferentiableFunction,
    lower: number,
    upper: number,
    {
      tolerance = 1e-5,
      solveMax = false,
    }: {
      tolerance?: number;
      solveMax?: boolean;
    },
  ): number {
    let a = lower;
    let b = upper;
    let c = b - (b - a) * GoldenSection.grInv_;
    let d = a + (b - a) * GoldenSection.grInv_;

    while (Math.abs(b - a) > tolerance) {
      if (GoldenSection.check_(f(c), f(d), solveMax)) {
        b = d;
      } else {
        a = c;
      }
      c = b - (b - a) * GoldenSection.grInv_;
      d = a + (b - a) * GoldenSection.grInv_;
    }

    return 0.5 * (b + a);
  }

  /**
   * Searches for the input value that minimizes the given objective function
   * @param f - The objective function to minimize. Must be unimodal on [lower, upper].
   * @param lower - Lower bound of the search interval
   * @param upper - Upper bound of the search interval (must be > lower)
   * @param tolerance - Convergence threshold for interval width. Smaller values yield more precise results but require more iterations. Default: 1e-5
   * @returns The input value that produces the minimum output from the objective function
   */
  static searchMin(
    f: DifferentiableFunction,
    lower: number,
    upper: number,
    tolerance?: number,
  ): number {
    return GoldenSection.search(f, lower, upper, {
      tolerance,
      solveMax: false,
    });
  }

  /**
   * Searches for the input value that maximizes the given objective function
   * @param f - The objective function to maximize. Must be unimodal on [lower, upper].
   * @param lower - Lower bound of the search interval
   * @param upper - Upper bound of the search interval (must be > lower)
   * @param tolerance - Convergence threshold for interval width. Smaller values yield more precise results but require more iterations. Default: 1e-5
   * @returns The input value that produces the maximum output from the objective function
   */
  static searchMax(
    f: DifferentiableFunction,
    lower: number,
    upper: number,
    tolerance?: number,
  ): number {
    return GoldenSection.search(f, lower, upper, {
      tolerance,
      solveMax: true,
    });
  }
}
