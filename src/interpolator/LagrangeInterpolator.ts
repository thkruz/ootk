import { EpochUTC, EpochWindow, J2000, Vector3D } from 'ootk-core';
import { StateInterpolator } from './StateInterpolator';

export class LagrangeInterpolator extends StateInterpolator {
  private _t: Float64Array;
  private _x: Float64Array;
  private _y: Float64Array;
  private _z: Float64Array;
  private order: number;

  constructor(t: Float64Array, x: Float64Array, y: Float64Array, z: Float64Array, order = 10) {
    super();
    this._t = t;
    this._x = x;
    this._y = y;
    this._z = z;
    this.order = order;
  }

  /**
   * Creates a LagrangeInterpolator from an array of J2000 ephemeris data.
   *
   * @param ephemeris - The array of J2000 ephemeris data.
   * @param order - The order of the LagrangeInterpolator. Default is 10.
   * @returns A new LagrangeInterpolator instance.
   */
  static fromEphemeris(ephemeris: J2000[], order = 10): LagrangeInterpolator {
    const k = ephemeris.length;
    const t = new Float64Array(k);
    const x = new Float64Array(k);
    const y = new Float64Array(k);
    const z = new Float64Array(k);

    for (let i = 0; i < k; i++) {
      const state = ephemeris[i];

      t[i] = state.epoch.posix;
      x[i] = state.position.x;
      y[i] = state.position.y;
      z[i] = state.position.z;
    }

    return new LagrangeInterpolator(t, x, y, z, order);
  }

  get sizeBytes(): number {
    return (64 * 4 * this._t.length) / 8;
  }

  interpolate(epoch: EpochUTC): J2000 | null {
    if (!this.inWindow(epoch)) {
      return null;
    }
    const posix = epoch.posix;
    const subDex = this._slice(posix);
    const start = subDex.left;
    const stop = subDex.right;
    const ts = this._t.subarray(start, stop);
    const xs = this._x.subarray(start, stop);
    const ys = this._y.subarray(start, stop);
    const zs = this._z.subarray(start, stop);
    const position = new Vector3D(
      LagrangeInterpolator._position(ts, xs, posix),
      LagrangeInterpolator._position(ts, ys, posix),
      LagrangeInterpolator._position(ts, zs, posix),
    );
    const velocity = new Vector3D(
      LagrangeInterpolator._velocity(ts, xs, posix),
      LagrangeInterpolator._velocity(ts, ys, posix),
      LagrangeInterpolator._velocity(ts, zs, posix),
    );

    return new J2000(epoch, position, velocity);
  }

  private static _position(xs: Float64Array, ys: Float64Array, x: number): number {
    const k = xs.length - 1;
    let result = 0.0;

    for (let j = 0; j < k; j++) {
      let product = ys[j];

      for (let m = 0; m < k; m++) {
        if (j === m) {
          continue;
        }
        product *= (x - xs[m]) / (xs[j] - xs[m]);
      }
      result += product;
    }

    return result;
  }

  private static _velocity(xs: Float64Array, ys: Float64Array, x: number): number {
    const k = xs.length;
    let result = 0.0;

    for (let j = 0; j < k; j++) {
      let total = 0.0;

      for (let i = 0; i < k; i++) {
        if (i === j) {
          continue;
        }
        let product = 1 / (xs[j] - xs[i]);

        for (let m = 0; m < k; m++) {
          if (m === i || m === j) {
            continue;
          }
          product *= (x - xs[m]) / (xs[j] - xs[m]);
        }
        total += product;
      }
      result += ys[j] * total;
    }

    return result;
  }

  private static _getClosest(target: number, t1: number, d1: number, t2: number, d2: number): number {
    return target - t1 >= t2 - target ? d2 : d1;
  }

  private _slice(posix: number): { left: number; right: number } {
    const n = this._t.length;

    if (posix <= this._t[0]) {
      return { left: 0, right: this.order };
    }
    if (posix >= this._t[n - 1]) {
      return { left: n - this.order, right: n };
    }

    let i = 0;
    let j = this._t.length;
    let mid = 0;

    while (i < j) {
      mid = (i + j) >> 1;
      if (this._t[mid] === posix) {
        break;
      }
      if (posix < this._t[mid]) {
        if (mid > 0 && posix > this._t[mid - 1]) {
          mid = LagrangeInterpolator._getClosest(posix, this._t[mid - 1], mid - 1, this._t[mid], mid);
          break;
        }
        j = mid;
      } else {
        if (mid < this._t.length - 1 && posix < this._t[mid + 1]) {
          mid = LagrangeInterpolator._getClosest(posix, this._t[mid], mid, this._t[mid + 1], mid + 1);
          break;
        }
        i = mid + 1;
      }
    }
    const offset = Math.floor(this.order / 2);
    const left = mid - offset;
    const right = mid + offset - (this.order % 2 === 1 ? 1 : 0);

    if (left < 0) {
      return { left: 0, right: this.order };
    }
    if (right > n) {
      return { left: n - this.order, right: n };
    }

    return { left, right };
  }

  window(): EpochWindow {
    return new EpochWindow(new EpochUTC(this._t[0]), new EpochUTC(this._t[this._t.length - 1]));
  }
}
