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

import { Vector } from '../../operations/Vector';

/**
 * A cost function that evaluates a set of parameters and returns a score.
 *
 * Lower scores indicate better solutions. The function takes a Float64Array
 * of N parameters and returns a single numeric score representing how well
 * those parameters satisfy the optimization objective.
 *
 * @example
 * ```ts
 * // Cost function to find values closest to (3, 5)
 * const costFn: CostFunction = (params: Float64Array) => {
 *   const dx = params[0] - 3;
 *   const dy = params[1] - 5;
 *   return dx * dx + dy * dy; // squared distance from target
 * };
 * ```
 */
export type CostFunction = (points: Float64Array) => number;

/**
 * Represents a single vertex (point) in the Nelder-Mead simplex optimization algorithm.
 *
 * In the Nelder-Mead method, optimization occurs by manipulating a geometric shape called
 * a "simplex" - a polygon with N+1 vertices in N-dimensional parameter space. For example:
 * - 1D optimization uses a line segment (2 vertices)
 * - 2D optimization uses a triangle (3 vertices)
 * - 3D optimization uses a tetrahedron (4 vertices)
 *
 * Each `SimplexEntry` stores:
 * - The parameter values for this vertex (`points`)
 * - The cost function evaluation at this point (`score`)
 * - A reference to the cost function for creating new vertices
 *
 * The class provides geometric operations (`modify`, `distance`) that enable the
 * Nelder-Mead algorithm to transform the simplex through reflection, expansion,
 * contraction, and shrink operations.
 *
 * @example
 * ```ts
 * // Define a cost function (minimize distance from origin)
 * const costFn: CostFunction = (p: Float64Array) => p[0] ** 2 + p[1] ** 2;
 *
 * // Create simplex vertices for 2D optimization (triangle)
 * const v1 = new SimplexEntry(costFn, new Float64Array([1.0, 0.0])); // score = 1.0
 * const v2 = new SimplexEntry(costFn, new Float64Array([0.0, 1.0])); // score = 1.0
 * const v3 = new SimplexEntry(costFn, new Float64Array([1.0, 1.0])); // score = 2.0
 *
 * // v3 has the worst score; reflect it through the centroid direction
 * // The centroid would be computed from v1 and v2
 * const centroid = new SimplexEntry(costFn, new Float64Array([0.5, 0.5]));
 *
 * // Reflect v3: move centroid in direction (centroid - v3), scaled by 1.0
 * const reflected = centroid.modify(1.0, centroid, v3);
 * // reflected.points ≈ [0.0, 0.0], reflected.score ≈ 0.0 (optimal!)
 * ```
 * @internal
 * @see DownhillSimplex - The optimizer that uses SimplexEntry vertices
 */
export class SimplexEntry {
  /**
   * The cost function score at this vertex.
   *
   * Lower values indicate better solutions. This is computed once during
   * construction by evaluating the cost function on the parameter values.
   */
  score: number;

  /** Internal vector representation for geometric operations. */
  private readonly x_: Vector;

  /**
   * Creates a new simplex vertex with the given parameters.
   *
   * The cost function is immediately evaluated on the provided points,
   * and the result is stored in the `score` property.
   * @param f_ - The cost function to evaluate (stored for creating new vertices)
   * @param points - The parameter values for this vertex
   */
  constructor(private readonly f_: CostFunction, public points: Float64Array) {
    this.x_ = new Vector(points);
    this.score = this.f_(points);
  }

  /**
   * Returns a copy of the parameter values at this vertex.
   * @returns A new Float64Array containing the parameter values.
   */
  getPoints(): Float64Array {
    return this.x_.toArray();
  }

  /**
   * Returns the cost function score at this vertex.
   * @returns The score (lower is better).
   */
  getScore(): number {
    return this.score;
  }

  /**
   * Creates a new vertex by moving this point along a direction vector.
   *
   * Computes: `this + n * (xa - xb)`
   *
   * This operation is the foundation of all Nelder-Mead simplex transformations:
   *
   * - **Reflection**: Move the centroid away from the worst point
   *   `centroid.modify(1.0, centroid, worst)` → reflects worst through centroid
   *
   * - **Expansion**: If reflection found a good point, try going further
   *   `centroid.modify(2.0, reflected, centroid)` → extends past reflected point
   *
   * - **Contraction**: If reflection was poor, try closer to centroid
   *   `centroid.modify(0.5, reflected, centroid)` → halfway between centroid and reflected
   *
   * - **Shrink**: Move all vertices toward the best vertex
   *   `best.modify(0.5, vertex, best)` → halfway between best and vertex
   * @param n - Scale factor for the direction vector
   * @param xa - The "toward" point (direction goes toward this point)
   * @param xb - The "from" point (direction goes away from this point)
   * @returns A new SimplexEntry at the computed position with its score evaluated.
   * @example
   * ```ts
   * // Reflect worst point through centroid (standard reflection with α=1)
   * const reflected = centroid.modify(1.0, centroid, worstVertex);
   *
   * // Expand further in the reflection direction (γ=2)
   * const expanded = centroid.modify(2.0, reflected, centroid);
   *
   * // Contract toward centroid (ρ=0.5)
   * const contracted = centroid.modify(0.5, reflected, centroid);
   * ```
   */
  modify(n: number, xa: SimplexEntry, xb: SimplexEntry): SimplexEntry {
    return new SimplexEntry(this.f_, this.x_.add(xa.x_.subtract(xb.x_).scale(n)).toArray());
  }

  /**
   * Computes the Euclidean distance between this vertex and another.
   *
   * Used to check convergence - when all vertices are within a small
   * distance of the centroid, the simplex has collapsed to a point
   * and optimization is complete.
   * @param se - The other simplex entry to measure distance to.
   * @returns The Euclidean distance in parameter space.
   */
  distance(se: SimplexEntry): number {
    return this.x_.distance(se.x_);
  }
}
