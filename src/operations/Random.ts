/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2024 Theodore Kruczek Permission is
 * hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
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
