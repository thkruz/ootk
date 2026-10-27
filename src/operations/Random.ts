/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Many of the classes are based off of the work of @david-rc-dayton and his
 * Pious Squid library (https://github.com/david-rc-dayton/pious_squid) which
 * is licensed under the MIT license.
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
 * The default implementation is the linear congruential generator
 * s' = (9301 s + 49297) mod 233280 (Press et al., Numerical Recipes in C, 2nd
 * ed., section 7.1, table of "quick and dirty" generators). Its period is at
 * most 233280 states, so it is only suitable for small Monte Carlo runs and
 * never for cryptographic purposes.
 */
export class Random {
  /** LCG modulus. */
  private static readonly modulus_ = 233280;
  private _seed: number;

  /**
   * Create a new generator.
   * @param seed Initial state. Any finite number is accepted; it is truncated to
   * an integer and reduced into [0, 233280) so that negative or large seeds still
   * produce values in the documented ranges.
   */
  constructor(seed = 0) {
    const m = Random.modulus_;
    const s = Math.trunc(Number.isFinite(seed) ? seed : 0);

    this._seed = ((s % m) + m) % m;
  }

  /**
   * Returns a pseudorandom float uniformly distributed in [0, max).
   *
   * The underlying state can be 0, so 0 itself is a possible return value.
   * @param max Upper bound (exclusive). Default is 1.
   * @returns A value in [0, max).
   */
  nextFloat(max = 1): number {
    this._seed = (this._seed * 9301 + 49297) % Random.modulus_;

    return (this._seed / Random.modulus_) * max;
  }

  /**
   * Returns a non-negative pseudorandom integer uniformly distributed in
   * [0, max), computed as floor(u * max) with u uniform in [0, 1).
   * @param max The bound on the random number to be returned. Must be a
   * positive integer.
   * @returns A pseudorandom, uniformly distributed integer between 0 (inclusive)
   * and max (exclusive).
   */
  nextInt(max = 1): number {
    return Math.floor(this.nextFloat() * max);
  }

  /**
   * Returns a pseudorandom boolean, true when the next uniform draw exceeds 0.5.
   * @returns A pseudorandom boolean.
   */
  nextBool(): boolean {
    return this.nextFloat() > 0.5;
  }
}
