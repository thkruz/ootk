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


import { evalPoly } from '../utils/functions';
import { DownhillSimplex } from './DownhillSimplex';
import { PolynomicalRegressionResult } from './internal/PolynomicalRegressionResult';

/**
 * Polynomial regression optimizer using the Downhill Simplex (Nelder-Mead) method.
 *
 * This class fits polynomial curves to data by finding coefficients that minimize
 * the sum of squared errors (SSE) between the polynomial and the observed data points.
 * It uses derivative-free optimization, making it robust for noisy data.
 *
 * ## How It Works
 *
 * 1. **Polynomial Model**: Fits a polynomial of the form:
 *    `y = c[0]*x^n + c[1]*x^(n-1) + ... + c[n-1]*x + c[n]`
 *    where n is the polynomial order.
 *
 * 2. **Optimization**: Uses the Downhill Simplex algorithm to iteratively adjust
 *    coefficients until the sum of squared errors is minimized.
 *
 * 3. **Model Selection**: The `solveOrder` method uses Bayesian Information Criterion (BIC)
 *    to balance fit quality against model complexity, preventing overfitting.
 *
 * ## Use Cases
 *
 * - Smoothing noisy orbital ephemeris data
 * - Fitting satellite position/velocity trends over time
 * - Interpolating between sparse observation points
 * - Compressing trajectory data into polynomial representations
 *
 * @example
 * ```typescript
 * // Fit a quadratic (order 2) polynomial to noisy position data
 * const times = new Float64Array([0, 1, 2, 3, 4, 5]);
 * const positions = new Float64Array([0.1, 1.9, 4.2, 8.8, 16.1, 25.3]);
 *
 * // Solve for quadratic coefficients: y = ax² + bx + c
 * const result = PolynomialRegression.solve(times, positions, 2);
 *
 * console.log(result.coefficients); // ~[1, 0, 0] for y ≈ x²
 * console.log(result.rss);          // Root sum of squared errors
 * console.log(result.bic);          // Bayesian Information Criterion
 *
 * // Use coefficients to predict new values
 * import { evalPoly } from 'ootk';
 * const predicted = evalPoly(6, result.coefficients); // Predict at t=6
 * ```
 *
 * @example
 * ```typescript
 * // Automatically find optimal polynomial order
 * const xs = new Float64Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
 * const ys = new Float64Array([1.2, 2.8, 5.1, 8.9, 14.2, 21.0, 29.8, 40.1, 52.0, 65.8]);
 *
 * // Find best order between 1 (linear) and 4 (quartic)
 * const result = PolynomialRegression.solveOrder(xs, ys, 1, 4);
 *
 * console.log(result.coefficients.length - 1); // Optimal order found
 * console.log(result.bic); // Lower BIC = better model
 * ```
 */
export class PolynomialRegression {
  private constructor() {
    // disable constructor
  }

  /**
   * Computes the Bayesian Information Criterion (BIC) for model selection.
   *
   * BIC penalizes model complexity to prevent overfitting. Lower BIC values indicate
   * a better balance between goodness-of-fit and model simplicity.
   *
   * Formula: BIC = n * ln(SSE) + k * ln(n)
   *
   * @param n - Number of data points in the sample.
   * @param k - Number of parameters (polynomial order).
   * @param sse - Sum of squared errors from the fit.
   * @returns The BIC score (lower is better).
   */
  private static bayesInformationCriterea_(n: number, k: number, sse: number): number {
    return n * Math.log(sse) + k * Math.log(n);
  }

  /**
   * Fits a polynomial of the specified order to the given data points.
   *
   * Uses the Downhill Simplex (Nelder-Mead) optimization algorithm to find
   * polynomial coefficients that minimize the sum of squared errors between
   * the polynomial curve and the observed y-values.
   *
   * The resulting polynomial has the form:
   * `y = coeffs[0]*x^order + coeffs[1]*x^(order-1) + ... + coeffs[order]`
   *
   * @param xs - Independent variable values (e.g., time points).
   * @param ys - Dependent variable values (e.g., positions or measurements).
   * @param order - Degree of the polynomial to fit (1=linear, 2=quadratic, 3=cubic, etc.).
   * @param options - Optional configuration.
   * @param options.printIter - If true, prints optimization progress to console.
   * @returns Result containing fitted coefficients, RSS error, and BIC score.
   *
   * @example
   * ```typescript
   * // Fit a cubic polynomial (order 3) to data
   * const result = PolynomialRegression.solve(xData, yData, 3);
   * // coefficients: [a, b, c, d] for y = ax³ + bx² + cx + d
   * ```
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
      PolynomialRegression.bayesInformationCriterea_(xs.length, order, sse),
    );
  }

  /**
   * Automatically finds the optimal polynomial order and fits coefficients.
   *
   * This method performs polynomial regression for each order in the specified range,
   * then selects the best model using Bayesian Information Criterion (BIC). BIC
   * penalizes model complexity, helping to find the simplest polynomial that
   * adequately describes the data without overfitting.
   *
   * Use this when you don't know the appropriate polynomial degree for your data.
   * The method will test all orders from minOrder to maxOrder and return the
   * result with the lowest BIC score.
   *
   * @param xs - Independent variable values (e.g., time points).
   * @param ys - Dependent variable values (e.g., positions or measurements).
   * @param minOrder - Minimum polynomial degree to try (e.g., 1 for linear).
   * @param maxOrder - Maximum polynomial degree to try (e.g., 5 for quintic).
   * @param options - Optional configuration.
   * @param options.printIter - If true, prints optimization progress to console.
   * @returns Result for the optimal order with fitted coefficients, RSS, and BIC.
   *
   * @example
   * ```typescript
   * // Let the algorithm find the best polynomial order (1 to 5)
   * const result = PolynomialRegression.solveOrder(xData, yData, 1, 5);
   *
   * // Check what order was selected
   * const selectedOrder = result.coefficients.length - 1;
   * console.log(`Optimal order: ${selectedOrder}`);
   * ```
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
