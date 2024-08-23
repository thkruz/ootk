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

/**
 * A generator of random bool, int, or double values.
 *
 * The default implementation supplies a stream of pseudo-random bits that are not suitable for cryptographic purposes.
 */
export class Random {
  private _seed: number;

  constructor(seed = 0) {
    this._seed = seed;
  }

  nextFloat(max = 1): number {
    this._seed = (this._seed * 9301 + 49297) % 233280;

    return (this._seed / 233280) * max;
  }

  /**
   * To create a non-negative random integer uniformly distributed in the range from 0,
   * inclusive, to max, exclusive, use nextInt(int max).
   * @param max The bound on the random number to be returned. Must be positive.
   * @returns A pseudorandom, uniformly distributed int value between 0 (inclusive) and the specified value (exclusive).
   */
  nextInt(max = 1): number {
    return Math.round(this.nextFloat(max) * max);
  }
  nextBool(): boolean {
    return this.nextFloat() > 0.5;
  }
}
