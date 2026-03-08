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

/**
 * Result container for polynomial regression optimization.
 *
 * This class encapsulates the output of fitting a polynomial curve to data points
 * using the {@link PolynomialRegression} optimizer. It provides three key pieces
 * of information needed to evaluate and use the fitted polynomial.
 *
 * ## Properties Explained
 *
 * - **coefficients**: The polynomial coefficients in descending power order.
 *   For a polynomial `y = ax² + bx + c`, coefficients would be `[a, b, c]`.
 *   Use with `evalPoly(x, coefficients)` to evaluate the polynomial at any point.
 *
 * - **rss** (Root Sum of Squares): A measure of how well the polynomial fits the data.
 *   Calculated as `√(Σ(yᵢ - ŷᵢ)²)` where yᵢ are observed values and ŷᵢ are predicted.
 *   Lower values indicate a better fit. Units match the y-data units.
 *
 * - **bic** (Bayesian Information Criterion): A model selection metric that balances
 *   fit quality against complexity. Lower BIC indicates a better model. Use this
 *   when comparing polynomials of different orders to avoid overfitting.
 *
 * ## Use Cases
 *
 * - Evaluating fitted polynomials at new x-values for interpolation/extrapolation
 * - Comparing multiple polynomial fits to select the best model
 * - Assessing fit quality before using coefficients for trajectory prediction
 * - Storing/transmitting compact polynomial representations of orbital data
 *
 * @example
 * ```typescript
 * import { PolynomialRegression, evalPoly } from 'ootk';
 *
 * // Fit a quadratic to satellite altitude data over time
 * const times = new Float64Array([0, 60, 120, 180, 240, 300]); // seconds
 * const altitudes = new Float64Array([400.1, 400.8, 402.3, 404.6, 407.7, 411.6]); // km
 *
 * const result = PolynomialRegression.solve(times, altitudes, 2);
 *
 * // Access the result properties
 * console.log('Coefficients:', result.coefficients);
 * // e.g., [0.00001, 0.002, 400] for y = 0.00001t² + 0.002t + 400
 *
 * console.log('RSS Error:', result.rss.toFixed(4), 'km');
 * // e.g., 0.0523 km - the polynomial fits within ~52 meters
 *
 * console.log('BIC Score:', result.bic.toFixed(2));
 * // e.g., -45.32 - use to compare with other polynomial orders
 *
 * // Predict altitude at t=360 seconds using the fitted polynomial
 * const predictedAlt = evalPoly(360, result.coefficients);
 * console.log('Predicted altitude at t=360s:', predictedAlt.toFixed(2), 'km');
 *
 * // Compare with a cubic fit to see if higher order is justified
 * const cubicResult = PolynomialRegression.solve(times, altitudes, 3);
 * if (cubicResult.bic < result.bic) {
 *   console.log('Cubic model is better (lower BIC)');
 * } else {
 *   console.log('Quadratic model is sufficient');
 * }
 * ```
 * @internal
 * @see PolynomialRegression - The optimizer that produces this result
 */
export class PolynomicalRegressionResult {
  /**
   * Polynomial coefficients in descending power order.
   *
   * For a polynomial of order n: `y = c[0]xⁿ + c[1]xⁿ⁻¹ + ... + c[n-1]x + c[n]`
   *
   * The length of this array is `order + 1` (e.g., quadratic has 3 coefficients).
   */
  coefficients: Float64Array;

  /**
   * Root sum of squared errors (RSS) between the polynomial and observed data.
   *
   * Computed as `√(Σ(observed - predicted)²)`. Lower values indicate a better fit.
   * This value is in the same units as the y-data used for fitting.
   */
  rss: number;

  /**
   * Bayesian Information Criterion (BIC) score for model selection.
   *
   * Computed as `n * ln(SSE) + k * ln(n)` where n is the number of data points,
   * k is the polynomial order, and SSE is the sum of squared errors.
   *
   * Lower BIC values indicate a better balance between fit quality and model
   * simplicity. Use this to compare polynomials of different orders - the model
   * with the lowest BIC is preferred as it avoids overfitting.
   */
  bic: number;

  /**
   * Creates a new polynomial regression result.
   *
   * This constructor is typically called internally by {@link PolynomialRegression.solve}
   * or {@link PolynomialRegression.solveOrder} rather than directly by user code.
   *
   * @param coefficients - Polynomial coefficients in descending power order.
   * @param rss - Root sum of squared errors measuring fit quality.
   * @param bic - Bayesian Information Criterion for model comparison.
   */
  constructor(coefficients: Float64Array, rss: number, bic: number) {
    this.coefficients = coefficients;
    this.rss = rss;
    this.bic = bic;
  }
}
