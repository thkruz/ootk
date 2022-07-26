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

import * as Types from './types';

class Utils {
  public static Types = Types;

  public static distance(pos1: Types.EciVec3, pos2: Types.EciVec3): Types.Kilometer {
    return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2 + (pos1.z - pos2.z) ** 2);
  }

  private static sign = (value: number) => (value >= 0 ? 1 : -1);

  public static dopplerFactor(
    location: Types.EciVec3,
    position: Types.EciVec3,
    velocity: Types.EciVec3,
  ): Types.Kilometer {
    const mfactor = 7.292115e-5;
    const c = 299792.458; // Speed of light in km/s

    const range = <Types.EciVec3>{
      x: position.x - location.x,
      y: position.y - location.y,
      z: position.z - location.z,
    };
    const distance = Math.sqrt(range.x ** 2 + range.y ** 2 + range.z ** 2);

    const rangeVel = <Types.EciVec3>{
      x: velocity.x + mfactor * location.y,
      y: velocity.y - mfactor * location.x,
      z: velocity.z,
    };

    const rangeRate = (range.x * rangeVel.x + range.y * rangeVel.y + range.z * rangeVel.z) / distance;

    return 1 + (rangeRate / c) * Utils.sign(rangeRate);
  }

  public static createVec(start: number, stop: number, step: number): number[] {
    const array = [];

    for (let i = start; i <= stop; i += step) {
      array.push(i);
    }

    return array;
  }

  public static roundToNDecimalPlaces(value: number, places: number): number {
    return Math.round(value * 10 ** places) / 10 ** places;
  }
}

export { Utils };
