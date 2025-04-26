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

import { EpochUTC, EpochWindow, J2000, Kilometers, KilometersPerSecond, Seconds, Vector3D } from '../main.js';
import { StateInterpolator } from './StateInterpolator.js';

export class LagrangeInterpolator extends StateInterpolator {
  private t_: Float64Array;
  private x_: Float64Array;
  private y_: Float64Array;
  private z_: Float64Array;
  private order: number;

  constructor(t: Float64Array, x: Float64Array, y: Float64Array, z: Float64Array, order = 10) {
    super();
    this.t_ = t;
    this.x_ = x;
    this.y_ = y;
    this.z_ = z;
    this.order = order;
  }

  /**
   * Creates a LagrangeInterpolator from an array of J2000 ephemeris data.
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
    return (64 * 4 * this.t_.length) / 8;
  }

  interpolate(epoch: EpochUTC): J2000 | null {
    if (!this.inWindow(epoch)) {
      return null;
    }
    const posix = epoch.posix;
    const subDex = this.slice_(posix);
    const start = subDex.left;
    const stop = subDex.right;
    const ts = this.t_.subarray(start, stop);
    const xs = this.x_.subarray(start, stop);
    const ys = this.y_.subarray(start, stop);
    const zs = this.z_.subarray(start, stop);
    const position = new Vector3D(
      LagrangeInterpolator.position_(ts, xs, posix) as Kilometers,
      LagrangeInterpolator.position_(ts, ys, posix) as Kilometers,
      LagrangeInterpolator.position_(ts, zs, posix) as Kilometers,
    );
    const velocity = new Vector3D(
      LagrangeInterpolator.velocity_(ts, xs, posix) as KilometersPerSecond,
      LagrangeInterpolator.velocity_(ts, ys, posix) as KilometersPerSecond,
      LagrangeInterpolator.velocity_(ts, zs, posix) as KilometersPerSecond,
    );

    return new J2000(epoch, position, velocity);
  }

  private static position_(xs: Float64Array, ys: Float64Array, x: number): number {
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

  private static velocity_(xs: Float64Array, ys: Float64Array, x: number): number {
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

  private slice_(posix: number): { left: number; right: number } {
    const n = this.t_.length;

    if (posix <= this.t_[0]) {
      return { left: 0, right: this.order };
    }
    if (posix >= this.t_[n - 1]) {
      return { left: n - this.order, right: n };
    }

    let i = 0;
    let j = this.t_.length;
    let mid = 0;

    while (i < j) {
      mid = (i + j) >> 1;
      if (this.t_[mid] === posix) {
        break;
      }
      if (posix < this.t_[mid]) {
        if (mid > 0 && posix > this.t_[mid - 1]) {
          mid = LagrangeInterpolator._getClosest(posix, this.t_[mid - 1], mid - 1, this.t_[mid], mid);
          break;
        }
        j = mid;
      } else {
        if (mid < this.t_.length - 1 && posix < this.t_[mid + 1]) {
          mid = LagrangeInterpolator._getClosest(posix, this.t_[mid], mid, this.t_[mid + 1], mid + 1);
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
    return new EpochWindow(new EpochUTC(this.t_[0] as Seconds), new EpochUTC(this.t_[this.t_.length - 1] as Seconds));
  }
}
