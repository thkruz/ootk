/* eslint-disable class-methods-use-this */
import { RungeKuttaAdaptive } from './RungeKuttaAdaptive';

export class DormandPrince54Propagator extends RungeKuttaAdaptive {
  private _a: Float64Array = Float64Array.from([0.0, 1.0 / 5.0, 3.0 / 10.0, 4.0 / 5.0, 8.0 / 9.0, 1.0, 1.0]);

  private _b: Float64Array[] = [
    new Float64Array(),
    Float64Array.from([1.0 / 5.0]),
    Float64Array.from([3.0 / 40.0, 9.0 / 40.0]),
    Float64Array.from([44.0 / 45.0, -56.0 / 15.0, 32.0 / 9.0]),
    Float64Array.from([19372.0 / 6561.0, -25360.0 / 2187.0, 64448.0 / 6561.0, -212.0 / 729.0]),
    Float64Array.from([9017.0 / 3168.0, -355.0 / 33.0, 46732.0 / 5247.0, 49.0 / 176.0, -5103.0 / 18656.0]),
    Float64Array.from([35.0 / 384.0, 0.0, 500.0 / 1113.0, 125.0 / 192.0, -2187.0 / 6784.0, 11.0 / 84.0]),
  ];

  private _ch: Float64Array = Float64Array.from([
    35.0 / 384.0,
    0.0,
    500.0 / 1113.0,
    125.0 / 192.0,
    -2187.0 / 6784.0,
    11.0 / 84.0,
    0.0,
  ]);

  private _c: Float64Array = Float64Array.from([
    5179.0 / 57600.0,
    0.0,
    7571.0 / 16695.0,
    393.0 / 640.0,
    -92097.0 / 339200.0,
    187.0 / 2100.0,
    1.0 / 40.0,
  ]);

  get a(): Float64Array {
    return this._a;
  }

  get b(): Float64Array[] {
    return this._b;
  }

  get ch(): Float64Array {
    return this._ch;
  }

  get c(): Float64Array {
    return this._c;
  }

  get order(): number {
    return 5;
  }
}
