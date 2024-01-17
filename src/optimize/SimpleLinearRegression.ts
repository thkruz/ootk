/**
 * @author @thkruz Theodore Kruczek
 *
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

// / Simple linear regression _(y = mx + b)_.
export class SimpleLinearRegression {
  /**
   * Create a new [SimpleLinearRegression] object from lists of x and y
   * values.
   */
  constructor(public xs: number[], public ys: number[]) {
    this.update();
  }

  // / Line slope
  private _slope = 0.0;

  // / Y-axis intercept
  private _intercept = 0.0;

  private _error = 0.0;

  // / Line slope
  get slope(): number {
    return this._slope;
  }

  // / Y-axis intercept
  get intercept(): number {
    return this._intercept;
  }

  // / Linear regression standard deviation
  get error(): number {
    return this._error;
  }

  // / Data length
  get length(): number {
    return Math.min(this.xs.length, this.ys.length);
  }

  private _calcError(): void {
    let total = 0.0;

    for (let i = 0; i < this.length; i++) {
      const delta = this.ys[i] - this.evaluate(this.xs[i]);

      total += delta * delta;
    }
    this._error = Math.sqrt(total / (this.length - 1));
  }

  // / Update the linear fit with this object's current [xs] and [ys] values.
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
    this._slope = p * (ySig / xSig);
    this._intercept = yMu - this._slope * xMu;
    this._calcError();
  }

  // / Evaluate this linear fit for y, given an [x] value.
  evaluate(x: number): number {
    return this._slope * x + this._intercept;
  }

  /**
   * Create a new [SimpleLinearRegression] object with outliers above the
   * provided standard deviation [sigma] value removed.
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
