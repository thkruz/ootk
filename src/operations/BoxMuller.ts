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

import { Random, TAU, Vector } from '../main.js';

// / Box-Muller random Gaussian number generator.
export class BoxMuller {
  private _index = 0;
  private _cache = new Float64Array(2);
  // / Mean value.
  mu: number;
  // / Standard deviation.
  sigma: number;
  // / Uniform random number generator.
  rand: Random;

  /**
   * Create a new [BoxMuller] object with mean [mu], standard deviation
   * [sigma], and [seed] number.
   * @param mu Mean value.
   * @param sigma Standard deviation.
   * @param seed Random seed.
   */
  constructor(mu: number, sigma: number, seed = 0) {
    this.mu = mu;
    this.sigma = sigma;
    this.rand = new Random(seed);
    this._generate();
  }

  // / Refill the cache with random Gaussian numbers.
  _generate() {
    this._index = 0;
    const u1 = this.rand.nextFloat();
    const u2 = this.rand.nextFloat();
    const mag = this.sigma * Math.sqrt(-2.0 * Math.log(u1));

    this._cache[0] = mag * Math.cos(TAU * u2) + this.mu;
    this._cache[1] = mag * Math.sin(TAU * u2) + this.mu;
  }

  /**
   * Generate a gaussian number, with mean [mu] and standard
   * deviation [sigma].
   * @returns A gaussian number.
   */
  nextGauss(): number {
    if (this._index > 1) {
      this._generate();
    }
    const result = this._cache[this._index];

    this._index++;

    return result;
  }

  /**
   * Generate a [Vector] of gaussian numbers, with mean [mu] and standard
   * deviation [sigma].
   * @param n Number of gaussian numbers to generate.
   * @returns A [Vector] of gaussian numbers.
   */
  gaussVector(n: number): Vector {
    const result = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      result[i] = this.nextGauss();
    }

    return new Vector(result);
  }
}
