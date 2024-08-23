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
