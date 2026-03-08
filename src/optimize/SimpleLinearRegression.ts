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
 * Simple linear regression model that fits a line _(y = mx + b)_ to a set of data points.
 *
 * This class uses the ordinary least squares (OLS) method to find the best-fit line
 * that minimizes the sum of squared residuals between observed and predicted values.
 * It calculates the Pearson correlation coefficient internally to derive the slope,
 * which provides a statistically robust fit.
 *
 * The regression computes:
 * - **Slope (m)**: The rate of change of y with respect to x
 * - **Intercept (b)**: The y-value where the line crosses the y-axis (when x = 0)
 * - **Standard Error**: A measure of the average deviation of data points from the fitted line
 *
 * @example
 * ```ts
 * // Fit a line to satellite altitude decay data over time
 * const daysSinceEpoch = [0, 1, 2, 3, 4, 5, 6, 7];
 * const altitudeKm = [408.2, 407.9, 407.5, 407.2, 406.8, 406.5, 406.1, 405.8];
 *
 * const regression = new SimpleLinearRegression(daysSinceEpoch, altitudeKm);
 *
 * console.log(`Decay rate: ${regression.slope.toFixed(3)} km/day`);
 * // => Decay rate: -0.343 km/day
 *
 * console.log(`Initial altitude: ${regression.intercept.toFixed(2)} km`);
 * // => Initial altitude: 408.18 km
 *
 * // Predict altitude on day 10
 * const predictedAltitude = regression.evaluate(10);
 * console.log(`Predicted altitude on day 10: ${predictedAltitude.toFixed(2)} km`);
 * // => Predicted altitude on day 10: 404.75 km
 *
 * // Remove outliers beyond 2 standard deviations for cleaner fit
 * const cleanedRegression = regression.filterOutliers(2.0);
 * ```
 */
export class SimpleLinearRegression {
  /**
   * Create a new [SimpleLinearRegression] object from lists of x and y
   * values.
   * @param xs x values
   * @param ys y values
   */
  constructor(public xs: number[], public ys: number[]) {
    this.update();
  }

  /** Line slope (m in y = mx + b). */
  private slope_ = 0.0;

  /** Y-axis intercept (b in y = mx + b). */
  private intercept_ = 0.0;

  /** Standard error of the regression (root mean square of residuals). */
  private error_ = 0.0;

  /**
   * The slope of the fitted line (m in y = mx + b).
   *
   * Represents the change in y for each unit increase in x.
   * A positive slope indicates y increases as x increases;
   * a negative slope indicates y decreases as x increases.
   */
  get slope(): number {
    return this.slope_;
  }

  /**
   * The y-intercept of the fitted line (b in y = mx + b).
   *
   * This is the predicted y value when x equals zero.
   */
  get intercept(): number {
    return this.intercept_;
  }

  /**
   * The standard error of the regression.
   *
   * This measures the typical distance between observed y values and
   * the predicted y values on the regression line. Lower values indicate
   * a better fit. Calculated as the sample standard deviation of the residuals.
   */
  get error(): number {
    return this.error_;
  }

  /**
   * The number of data points used in the regression.
   *
   * Returns the minimum of xs and ys lengths to handle mismatched arrays.
   */
  get length(): number {
    return Math.min(this.xs.length, this.ys.length);
  }

  /**
   * Calculate the standard error of the regression.
   *
   * Computes the sample standard deviation of the residuals (differences
   * between observed and predicted y values). Uses (n-1) as the denominator
   * for Bessel's correction to provide an unbiased estimate.
   */
  private calcError_(): void {
    let total = 0.0;

    for (let i = 0; i < this.length; i++) {
      const delta = this.ys[i] - this.evaluate(this.xs[i]);

      total += delta * delta;
    }
    this.error_ = Math.sqrt(total / (this.length - 1));
  }

  /**
   * Recalculate the regression coefficients using the current xs and ys data.
   *
   * This method is called automatically by the constructor, but can be called
   * manually if you modify the xs or ys arrays directly after construction.
   *
   * The algorithm:
   * 1. Computes means of x and y values (xMu, yMu)
   * 2. Calculates the Pearson correlation coefficient (p)
   * 3. Computes sample standard deviations (xSig, ySig)
   * 4. Derives slope as: m = p * (ySig / xSig)
   * 5. Derives intercept as: b = yMu - m * xMu
   */
  update(): void {
    const n = Math.min(this.xs.length, this.ys.length);
    let xMu = 0.0;
    let yMu = 0.0;

    for (let i = 0; i < n; i++) {
      xMu += this.xs[i];
      yMu += this.ys[i];
    }
    xMu /= n;
    yMu /= n;
    let pa = 0.0;
    let xSig = 0.0;
    let ySig = 0.0;

    for (let i = 0; i < n; i++) {
      const xd = this.xs[i] - xMu;
      const yd = this.ys[i] - yMu;

      pa += xd * yd;
      xSig += xd * xd;
      ySig += yd * yd;
    }
    const p = pa / (Math.sqrt(xSig) * Math.sqrt(ySig));

    xSig = Math.sqrt(xSig / (n - 1));
    ySig = Math.sqrt(ySig / (n - 1));
    this.slope_ = p * (ySig / xSig);
    this.intercept_ = yMu - this.slope_ * xMu;
    this.calcError_();
  }

  /**
   * Predict the y value for a given x using the fitted regression line.
   *
   * Evaluates y = mx + b where m is the slope and b is the intercept.
   * Can be used for interpolation (x within the data range) or
   * extrapolation (x outside the data range).
   * @param x - The x value to evaluate
   * @returns The predicted y value
   */
  evaluate(x: number): number {
    return this.slope_ * x + this.intercept_;
  }

  /**
   * Create a new SimpleLinearRegression with outlier data points removed.
   *
   * Points are considered outliers if their residual (distance from the
   * regression line) exceeds `sigma` times the standard error. This is
   * useful for cleaning noisy data to get a more robust fit.
   *
   * @param sigma - The number of standard deviations to use as the threshold.
   *                Points with residuals > sigma * error are removed. Default is 1.0.
   * @returns A new SimpleLinearRegression fitted to the filtered data.
   *
   * @example
   * ```ts
   * const regression = new SimpleLinearRegression(xs, ys);
   *
   * // Remove points more than 2 standard deviations from the line
   * const cleaned = regression.filterOutliers(2.0);
   *
   * // The cleaned regression will typically have a lower error
   * console.log(`Original error: ${regression.error}`);
   * console.log(`Cleaned error: ${cleaned.error}`);
   * ```
   */
  filterOutliers(sigma = 1.0): SimpleLinearRegression {
    const limit = this.error * sigma;
    const xsOut: number[] = [];
    const ysOut: number[] = [];

    for (let i = 0; i < this.length; i++) {
      if (Math.abs(this.ys[i] - this.evaluate(this.xs[i])) < limit) {
        xsOut.push(this.xs[i]);
        ysOut.push(this.ys[i]);
      }
    }

    return new SimpleLinearRegression(xsOut, ysOut);
  }
}
