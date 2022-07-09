/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The Utils module.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

type vec3K = {
  x: number;
  y: number;
  z: number;
};

class Utils {
  public static distance(pos1: vec3K, pos2: vec3K): number {
    return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2 + (pos1.z - pos2.z) ** 2);
  }

  public static dopplerFactor(location: vec3K, position: vec3K, velocity: vec3K): number {
    const mfactor = 7.292115e-5;
    const c = 299792.458; // Speed of light in km/s

    const range = {
      x: position.x - location.x,
      y: position.y - location.y,
      z: position.z - location.z,
      w: 0,
    };
    range.w = Math.sqrt(range.x ** 2 + range.y ** 2 + range.z ** 2);

    const rangeVel = {
      x: velocity.x + mfactor * location.y,
      y: velocity.y - mfactor * location.x,
      z: velocity.z,
    };

    const sign = (value) => (value >= 0 ? 1 : -1);

    const rangeRate =
      (range.x * rangeVel.x + range.y * rangeVel.y + range.z * rangeVel.z) / range.w;

    return 1 + (rangeRate / c) * sign(rangeRate);
  }

  public static createVec(start: number, stop:number, step:number): number[] {
    let array = [];
    for (let i = start; i <= stop; i += step) {
      array.push(i);
    }
    return array;
  }
}

export { Utils };
