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

import { Kilometers, KilometersPerSecond, Radians, linearDistance } from '../main.js';
import { Matrix } from './Matrix.js';
import { Vector } from './Vector.js';

// / 3-dimensional vector.
export class Vector3D<T extends number = number> {
  constructor(
    public x: T,
    public y: T,
    public z: T,
  ) {
    // Nothing to do here.
  }

  /**
   * Create a new Vector3D object from the first three elements of a Vector
   * object.
   * @param v The Vector object to convert.
   * @returns A new Vector3D object.
   */
  static fromVector<U extends number>(v: Vector<U>): Vector3D<U> {
    return new Vector3D<U>(v.x as U, v.y as U, v.z as U);
  }

  // / Origin vector.
  static readonly origin = new Vector3D<number>(0, 0, 0);

  // / X-axis unit vector.
  static readonly xAxis = new Vector3D<number>(1, 0, 0);

  // / Y-axis unit vector.
  static readonly yAxis = new Vector3D<number>(0, 1, 0);

  // / Z-axis unit vector.
  static readonly zAxis = new Vector3D<number>(0, 0, 1);

  // / Negative x-axis unit vector.
  static readonly xAxisNeg = new Vector3D<number>(-1, 0, 0);

  // / Negative y-axis unit vector.
  static readonly yAxisNeg = new Vector3D<number>(0, -1, 0);

  // / Negative z-axis unit vector.
  static readonly zAxisNeg = new Vector3D<number>(0, 0, -1);

  // / Convert this to a [List] of doubles.
  toList() {
    return [this.x, this.y, this.z];
  }

  // / Convert this to a [Float64List] object.
  toArray() {
    return new Float64Array([this.x, this.y, this.z]);
  }

  /**
   * Return the Vector3D element at the provided index.
   * @deprecated don't do this
   * @param index The index of the element to return.
   * @returns The element at the provided index.
   */
  public getElement(index: number): number {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      default:
        throw new Error(`Index ${index} outside 3D vector bounds.`);
    }
  }

  // / Convert this to a [Vector] object.
  toVector() {
    return new Vector(this.toList());
  }

  toString(fixed = -1): string {
    if (fixed < 0) {
      return `[${this.toList().join(', ')}]`;
    }
    const output = this.toList().map((e) => e.toFixed(fixed));

    return `[${output.join(', ')}]`;
  }

  // / Return the magnitude of this vector.
  magnitude(): T {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z) as T;
  }

  // / Return the result of adding this to another [Vector3D].
  add(v: Vector3D<T>): Vector3D<T> {
    return new Vector3D<T>((this.x + v.x) as T, (this.y + v.y) as T, (this.z + v.z) as T);
  }

  // / Return the result of subtracting this and another [Vector3D].
  subtract(v: Vector3D<T>): Vector3D<T> {
    return new Vector3D<T>((this.x - v.x) as T, (this.y - v.y) as T, (this.z - v.z) as T);
  }

  // / Return a copy of this [Vector3D] scaled by [n];
  scale<U extends number>(n: U): Vector3D<U> {
    return new Vector3D<U>(this.x * n as U, this.y * n as U, this.z * n as U);
  }

  // / Return a copy of this [Vector3D] with the elements negated.
  negate(): Vector3D<T> {
    return this.scale(-1 as T);
  }

  /**
   * Return the Euclidean distance between this and another Vector3D.
   * @param v The other Vector3D.
   * @returns The distance between this and the other Vector3D.
   */
  distance(v: Vector3D<T>): T {
    return linearDistance(this, v);
  }

  /**
   * Convert this to a unit Vector3D.
   * @returns A unit Vector3D.
   */
  normalize(): Vector3D<T> {
    const m = this.magnitude();

    if (m === 0) {
      return Vector3D.origin as Vector3D<T>;
    }

    return new Vector3D<T>(this.x / m as T, this.y / m as T, this.z / m as T);
  }

  // Calculate the dot product of this and another [Vector3D].
  dot<T extends number>(v: Vector3D<T>): T {
    return this.x * v.x + this.y * v.y + this.z * v.z as T;
  }

  // Calculate the outer product between this and another [Vector3D].
  outer(v: Vector3D): Matrix {
    return new Matrix([
      [this.x * v.x, this.x * v.y, this.x * v.z],
      [this.y * v.x, this.y * v.y, this.y * v.z],
      [this.z * v.x, this.z * v.y, this.z * v.z],
    ]);
  }

  // Calculate the cross product of this and another [Vector3D].
  cross<U extends number>(v: Vector3D<U>): Vector3D<U> {
    return new Vector3D<U>(
      (this.y * v.z - this.z * v.y) as U,
      (this.z * v.x - this.x * v.z) as U,
      (this.x * v.y - this.y * v.x) as U,
    );
  }

  // Calculate the skew-symmetric matrix for this [Vector3D].
  skewSymmetric(): Matrix {
    return new Matrix([
      [0, -this.z, this.y],
      [this.z, 0, -this.x],
      [-this.y, this.x, 0],
    ]);
  }

  /*
   * Create a copy of this [Vector3D] rotated in the x-axis by angle [theta]
   * _(rad)_.
   */
  rotX(theta: number): Vector3D {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    return new Vector3D(this.x, cosT * this.y + sinT * this.z, -sinT * this.y + cosT * this.z);
  }

  /*
   * Create a copy of this [Vector3D] rotated in the y-axis by angle [theta]
   * _(rad)_.
   */
  rotY(theta: Radians): Vector3D<T> {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    return new Vector3D<T>((cosT * this.x + -sinT * this.z) as T, this.y, (sinT * this.x + cosT * this.z) as T);
  }

  /*
   * Create a copy of this [Vector3D] rotated in the z-axis by angle [theta]
   * _(rad)_.
   */
  rotZ(theta: Radians): Vector3D<T> {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    return new Vector3D((cosT * this.x + sinT * this.y) as T, (-sinT * this.x + cosT * this.y) as T, this.z);
  }

  // Calculate the angle _(rad)_ between this and another [Vector3D].
  angle<U extends number>(v: Vector3D<U>): Radians {
    const theta = Math.atan2(this.cross(v).magnitude(), this.dot(v)) as Radians;

    return isNaN(theta) ? 0 as Radians : theta;
  }

  // Calculate the angle _(°)_ between this and another [Vector3D].
  angleDegrees(v: Vector3D<T>): number {
    return this.angle(v) * (180 / Math.PI);
  }

  /*
   * Return `true` if line-of-sight exists between this and another [Vector3D]
   * with a central body of the given [radius].
   */
  sight(v: Vector3D<KilometersPerSecond>, radius: Kilometers): boolean {
    const r1Mag2 = this.magnitude() ** 2;
    const r2Mag2 = v.magnitude() ** 2;
    const rDot = this.dot(v);
    const tMin = (r1Mag2 - rDot) / (r1Mag2 + r2Mag2 - 2 * rDot);
    let los = false;

    if (tMin < 0 || tMin > 1) {
      los = true;
    } else {
      const c = (1 - tMin) * r1Mag2 + rDot * tMin;

      if (c >= radius * radius) {
        los = true;
      }
    }

    return los;
  }

  // / Return the unit vector that bisects this and another [Vector3D].
  bisect(v: Vector3D<T>): Vector3D<T> {
    return this.scale(v.magnitude()).add(v.scale(this.magnitude())).normalize();
  }

  // / Convert this [Vector3D] into a row [Matrix].
  row(): Matrix {
    return new Matrix([[this.x, this.y, this.z]]);
  }

  // / Convert this [Vector3D] into a column [Matrix].
  column(): Matrix {
    return new Matrix([[this.x], [this.y], [this.z]]);
  }

  // / Join this and another [Vector3D] into a new [Vector] object.
  join(v: Vector3D): Vector {
    const output = new Float64Array(6);

    output[0] = this.x;
    output[1] = this.y;
    output[2] = this.z;
    output[3] = v.x;
    output[4] = v.y;
    output[5] = v.z;

    return new Vector(output);
  }
}
