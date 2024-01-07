import { PositionVelocity, Vector3D } from 'ootk-core';

// / Chebyshev compressed ephemeris coefficients.
export class ChebyshevCoefficients {
  _cxd: Float64Array;
  _cyd: Float64Array;
  _czd: Float64Array;
  // / Create a new [ChebyshevCoefficients] object.
  constructor(
    public a: number,
    public b: number,
    private _cx: Float64Array,
    private _cy: Float64Array,
    private _cz: Float64Array,
  ) {
    this._cxd = ChebyshevCoefficients._derivative(a, b, _cx);
    this._cyd = ChebyshevCoefficients._derivative(a, b, _cy);
    this._czd = ChebyshevCoefficients._derivative(a, b, _cz);
  }

  /**
   * Calculates the derivative of a polynomial represented by Chebyshev coefficients.
   *
   * @param a - The lower bound of the polynomial's domain.
   * @param b - The upper bound of the polynomial's domain.
   * @param c - The Chebyshev coefficients of the polynomial.
   * @returns The derivative of the polynomial as an array of coefficients.
   */
  private static _derivative(a: number, b: number, c: Float64Array): Float64Array {
    const n = c.length;
    const d = new Float64Array(n);

    d[n - 1] = 0;
    d[n - 2] = 2 * (n - 1) * c[n - 1];
    for (let k = n - 3; k >= 0; k--) {
      d[k] = d[k + 2] + 2 * (k + 1) * c[k + 1];
    }
    for (let k = 0; k < n; k++) {
      d[k] *= 2 / (b - a);
    }

    return d;
  }

  // / Return the size _(bytes)_ of this coefficient set's cached data.
  get sizeBytes(): number {
    return (64 * 2 + 64 * 3 * this._cx.length) / 8;
  }

  /**
   * Evaluates the Chebyshev polynomial represented by the given coefficients at the specified value.
   *
   * @param c - The coefficients of the Chebyshev polynomial.
   * @param t - The value at which to evaluate the polynomial _(POSIX seconds)_.
   * @returns The result of evaluating the polynomial at the specified value.
   */
  evaluate(c: Float64Array, t: number): number {
    const n = c.length;
    const x = (t - 0.5 * (this.b + this.a)) / (0.5 * (this.b - this.a));
    const alpha = 2 * x;
    const beta = -1;
    let y1 = 0.0;
    let y2 = 0.0;

    for (let k = n - 1; k >= 1; k--) {
      const tmp = y1;

      y1 = alpha * y1 + beta * y2 + c[k];
      y2 = tmp;
    }

    return x * y1 - y2 + 0.5 * c[0];
  }

  /**
   * Interpolates the position and velocity at a given time (km, km/s).
   *
   * @param t - The time value to interpolate at _(POSIX seconds)_.
   * @returns An object containing the interpolated position and velocity.
   */
  interpolate(t: number): PositionVelocity {
    const pos = new Vector3D(this.evaluate(this._cx, t), this.evaluate(this._cy, t), this.evaluate(this._cz, t));
    const vel = new Vector3D(this.evaluate(this._cxd, t), this.evaluate(this._cyd, t), this.evaluate(this._czd, t));

    return { position: pos, velocity: vel };
  }
}
