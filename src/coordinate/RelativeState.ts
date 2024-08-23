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

import { Kilometers, KilometersPerSecond } from '../main.js';
import { Matrix } from '../operations/Matrix.js';
import { Vector3D } from '../operations/Vector3D.js';
import { J2000 } from './J2000.js';

/**
 * Represents the relative state of an object in 3D space.
 */
export abstract class RelativeState {
  position: Vector3D<Kilometers>;
  velocity: Vector3D<KilometersPerSecond>;
  constructor(position: Vector3D<Kilometers>, velocity: Vector3D<KilometersPerSecond>) {
    this.position = position;
    this.velocity = velocity;
  }

  /**
   * Gets the name of the coordinate system.
   * @returns The name of the coordinate system.
   */
  abstract get name(): string;

  /**
   * Returns a string representation of the RelativeState object. The string includes the name, position, and velocity
   * of the object.
   * @returns A string representation of the RelativeState object.
   */
  toString(): string {
    return [
      `[${this.name}]`,
      `  Position: ${this.position.toString(6)} km`,
      `  Velocity: ${this.velocity.toString(9)} km/s`,
    ].join('\n');
  }

  /**
   * Transforms the current RelativeState coordinate to the J2000 coordinate
   * @param origin The origin J2000 coordinate.
   * @returns The transformed J2000 coordinate.
   */
  abstract toJ2000(origin: J2000): J2000;

  /**
   * Creates a matrix based on the given position and velocity vectors. The matrix represents the relative state of an
   * object in 3D space.
   * @param position - The position vector.
   * @param velocity - The velocity vector.
   * @returns The matrix representing the relative state.
   */
  static createMatrix(position: Vector3D, velocity: Vector3D): Matrix {
    const ru = position.normalize();
    const cu = position.cross(velocity).normalize();
    const iu = cu.cross(ru).normalize();

    return new Matrix([
      [ru.x, ru.y, ru.z],
      [iu.x, iu.y, iu.z],
      [cu.x, cu.y, cu.z],
    ]);
  }

  /**
   * Calculates the range of the relative state.
   * @returns The range in kilometers.
   */
  get range(): Kilometers {
    return this.position.magnitude();
  }

  /**
   * Calculates the range rate of the relative state. Range rate is the dot product of the position and velocity divided
   * by the range.
   * @returns The range rate in Kilometers per second.
   */
  get rangeRate(): number {
    return this.position.dot(this.velocity) / this.range;
  }
}
