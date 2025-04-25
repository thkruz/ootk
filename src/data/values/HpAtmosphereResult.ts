/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2025 Theodore Kruczek Permission is
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

import { HpAtmosphereEntry } from './HpAtmosphereData.js';

// / Harris-Priester atmospheric density bracket.
export class HpAtmosphereResult {
  // / Height above Earth's surface _(km)_.
  height: number;
  // / Lower bound for atmospheric parameters.
  hp0: HpAtmosphereEntry;
  // / Upper bound for atmospheric parameters.
  hp1: HpAtmosphereEntry;

  // / Create a new [HpAtmosphereResult] object.
  constructor(height: number, hp0: HpAtmosphereEntry, hp1: HpAtmosphereEntry) {
    this.height = height;
    this.hp0 = hp0;
    this.hp1 = hp1;
  }
}
