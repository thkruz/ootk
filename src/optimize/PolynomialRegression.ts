/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
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

import { evalPoly } from '../main.js';
import { DownhillSimplex } from './DownhillSimplex.js';
import { PolynomicalRegressionResult } from './PolynomicalRegressionResult.js';
// / Polynomial regression optimizer.
export class PolynomialRegression {
  private constructor() {
    // disable constructor
  }

  private static _bayesInformationCriterea(n: number, k: number, sse: number): number {
    return n * Math.log(sse) + k * Math.log(n);
  }

  /**
   * Optimize polynomial coefficients to fit data series [xs] and [ys] for the
   * provided polynomial [order].
   * @param xs x values
   * @param ys y values
   * @param order Polynomial order
   * @param root0 Root0
   * @param root0.printIter Root0.printIter
   * @returns The optimal input value.
   */
  static solve(
    xs: Float64Array,
    ys: Float64Array,
    order: number,
    { printIter = false }: { printIter?: boolean } = {},
  ): PolynomicalRegressionResult {
    const simplex = DownhillSimplex.generateSimplex(Float64Array.from(Array(order + 1).fill(1.0)));

    /**
     * Sum of squared errors.
     * @param coeffs Polynomial coefficients
     * @returns Sum of squared errors
     */
    function f(coeffs: Float64Array): number {
      let sse = 0.0;

      for (let i = 0; i < xs.length; i++) {
        const diff = ys[i] - evalPoly(xs[i], coeffs);

        sse += diff * diff;
      }

      return sse;
    }

    const result = DownhillSimplex.solveSimplex(f, simplex, {
      adaptive: true,
      printIter,
    });
    const sse = f(result);

    return new PolynomicalRegressionResult(
      result,
      Math.sqrt(sse),
      PolynomialRegression._bayesInformationCriterea(xs.length, order, sse),
    );
  }

  /**
   * Optimize polynomial coefficients to fit data series [xs] and [ys], and
   * attempt to find an optimal order within the [minOrder] and
   * [maxOrder] bounds.
   * @param xs x values
   * @param ys y values
   * @param minOrder Minimum polynomial order
   * @param maxOrder Maximum polynomial order
   * @param root0 Root0
   * @param root0.printIter Root0.printIter
   * @returns The optimal input value.
   */
  static solveOrder(
    xs: Float64Array,
    ys: Float64Array,
    minOrder: number,
    maxOrder: number,
    { printIter = false }: { printIter?: boolean } = {},
  ): PolynomicalRegressionResult {
    const cache: PolynomicalRegressionResult[] = [];

    for (let order = minOrder; order <= maxOrder; order++) {
      cache.push(PolynomialRegression.solve(xs, ys, order, { printIter }));
    }
    cache.sort((a, b) => a.bic - b.bic);

    return cache[0];
  }
}
