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

import { Degrees, Matrix, Radians, Vector3D } from '../main.js';

/**
 * A Vector is a mathematical object that has both magnitude and direction.
 */
export class Vector<T extends number = number> {
  /**
   * The length of the vector.
   */
  readonly length: number;

  /**
   * Represents a 3-dimensional vector.
   */
  static readonly origin3 = new Vector([0, 0, 0]);

  /**
   * Represents a vector with all elements set to zero.
   */
  static readonly origin6 = new Vector([0, 0, 0, 0, 0, 0]);

  /**
   * Represents the x-axis vector.
   */
  static readonly xAxis = new Vector([1, 0, 0]);

  /**
   * Represents the y-axis vector.
   */
  static readonly yAxis = new Vector([0, 1, 0]);

  /**
   * Represents the z-axis vector.
   */
  static readonly zAxis = new Vector([0, 0, 1]);

  /**
   * Represents a vector pointing along the negative x-axis.
   */
  static readonly xAxisNeg = new Vector([-1, 0, 0]);

  /**
   * Represents a vector pointing along the negative y-axis.
   */
  static readonly yAxisNeg = new Vector([0, -1, 0]);

  /**
   * Represents a vector pointing along the negative z-axis.
   */
  static readonly zAxisNeg = new Vector([0, 0, -1]);

  constructor(public elements: T[] | Float64Array) {
    this.length = elements.length;
  }

  /**
   * Creates a zero vector of the specified length.
   * @param length The length of the vector.
   * @returns A new Vector object representing the zero vector.
   */
  static zero(length: number): Vector {
    return new Vector(new Array(length).fill(0));
  }

  /**
   * Creates a new Vector with the specified length, filled with the specified
   * value.
   * @param length The length of the new Vector.
   * @param value The value to fill the Vector with.
   * @returns A new Vector filled with the specified value.
   */
  static filled(length: number, value: number): Vector {
    return new Vector(new Array(length).fill(value));
  }

  /**
   * Creates a new Vector instance from an array of elements.
   * @param elements - The array of elements to create the Vector from.
   * @returns A new Vector instance.
   */
  static fromList(elements: number[]): Vector {
    return new Vector(elements);
  }

  /**
   * Returns a string representation of the vector.
   * @param fixed - The number of digits to appear after the decimal point.
   * Defaults to -1.
   * @returns A string representation of the vector.
   */
  toString(fixed = -1): string {
    if (fixed < 0) {
      return `[${this.elements.join(', ')}]`;
    }
    const output = (this.elements as number[]).map((e) => e.toFixed(fixed));

    return `[${output.join(', ')}]`;
  }

  /**
   * Returns a string representation of the x value of the vector.
   * @returns A string representation of the x value of the vector.
   */
  get x(): number {
    return this.elements[0];
  }

  /**
   * Returns a string representation of the y value of the vector.
   * @returns A string representation of the y value of the vector.
   */
  get y(): number {
    return this.elements[1];
  }

  /**
   * Returns a string representation of the z value of the vector.
   * @returns A string representation of the z value of the vector.
   */
  get z(): number {
    return this.elements[2];
  }

  /**
   * Converts the vector elements to an array.
   * @returns An array containing the vector elements.
   */
  toList(): number[] {
    return Array.from(this.elements);
  }

  /**
   * Converts the vector to a Float64Array.
   * @returns The vector as a Float64Array.
   */
  toArray(): Float64Array {
    return new Float64Array(this.elements);
  }

  /**
   * Calculates the magnitude of the vector.
   * @returns The magnitude of the vector.
   */
  magnitude(): number {
    let total = 0;

    for (const x of this.elements) {
      total += x * x;
    }

    return Math.sqrt(total);
  }

  /**
   * Adds the elements of another vector to this vector and returns a new
   * vector.
   * @param v - The vector to add.
   * @returns A new vector containing the sum of the elements.
   */
  add(v: Vector): Vector {
    const output = new Array(this.length);

    for (let i = 0; i < this.length; i++) {
      output[i] = this.elements[i] + v.elements[i];
    }

    return new Vector(output);
  }

  /**
   * Subtracts a vector from the current vector.
   * @param v The vector to subtract.
   * @returns A new vector representing the result of the subtraction.
   */
  subtract(v: Vector): Vector {
    const output = new Array(this.length);

    for (let i = 0; i < this.length; i++) {
      output[i] = this.elements[i] - v.elements[i];
    }

    return new Vector(output);
  }

  /**
   * Scales the vector by a given factor.
   * @param n The scaling factor.
   * @returns A new Vector object representing the scaled vector.
   */
  scale(n: number): Vector {
    const output = new Array(this.length);

    for (let i = 0; i < this.length; i++) {
      output[i] = this.elements[i] * n;
    }

    return new Vector(output);
  }

  /**
   * Negates the vector by scaling it by -1.
   * @returns A new Vector object representing the negated vector.
   */
  negate(): Vector {
    return this.scale(-1);
  }

  /**
   * Return the Euclidean distance between this and another Vector.
   * @param v The vector to calculate the distance to.
   * @returns The distance between the two vectors.
   */
  distance(v: Vector): number {
    return this.subtract(v).magnitude();
  }

  /**
   * Normalizes the vector, making it a unit vector with the same direction but
   * a magnitude of 1. If the vector has a magnitude of 0, it returns a zero
   * vector of the same length.
   * @returns The normalized vector.
   */
  normalize(): Vector {
    const m = this.magnitude();

    if (m === 0) {
      return Vector.zero(this.length);
    }

    return this.scale(1.0 / m);
  }

  /**
   * Calculates the dot product of this vector and another vector.
   * @param v - The vector to calculate the dot product with.
   * @returns The dot product of the two vectors.
   */
  dot(v: Vector): number {
    let total = 0;

    for (let i = 0; i < this.length; i++) {
      total += this.elements[i] * v.elements[i];
    }

    return total;
  }

  /**
   * Calculates the outer product of this vector with another vector.
   * @param v The vector to calculate the outer product with.
   * @returns A matrix representing the outer product of the two vectors.
   */
  outer(v: Vector): Matrix {
    const result: number[][] = [];

    for (let i = 0; i < this.length; i++) {
      result[i] = [];
      for (let j = 0; j < v.length; j++) {
        result[i][j] = this.elements[i] * v.elements[j];
      }
    }

    return new Matrix(result);
  }

  /**
   * Calculates the cross product of this vector and the given vector.
   * @param v - The vector to calculate the cross product with.
   * @returns The resulting vector.
   */
  cross(v: Vector): Vector {
    const output = new Array(this.length);

    for (let i = 0; i < this.length; i++) {
      output[i] =
        this.elements[(i + 1) % this.length] * v.elements[(i + 2) % this.length] -
        this.elements[(i + 2) % this.length] * v.elements[(i + 1) % this.length];
    }

    return new Vector(output);
  }

  /**
   * Calculate the skew-symmetric matrix for this [Vector].
   * @returns The skew-symmetric matrix.
   * @throws [Error] if the vector is not of length 3.
   */
  skewSymmetric(): Matrix {
    if (this.length !== 3) {
      throw new Error('Skew-symmetric matrix requires a vector of length 3.');
    }

    return new Matrix([
      [0, -this.elements[2], this.elements[1]],
      [this.elements[2], 0, -this.elements[0]],
      [-this.elements[1], this.elements[0], 0],
    ]);
  }

  /**
   * Rotates the vector around the X-axis by the specified angle.
   * @param theta The angle in radians.
   * @returns The rotated vector.
   */
  rotX(theta: Radians): Vector {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const output = new Array(3);

    output[0] = this.elements[0];
    output[1] = cosT * this.elements[1] + sinT * this.elements[2];
    output[2] = -sinT * this.elements[1] + cosT * this.elements[2];

    return new Vector(output);
  }

  /**
   * Rotates the vector around the Y-axis by the specified angle.
   * @param theta The angle of rotation in radians.
   * @returns A new Vector representing the rotated vector.
   */
  rotY(theta: Radians): Vector {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const output = new Array(3);

    output[0] = cosT * this.elements[0] + -sinT * this.elements[2];
    output[1] = this.elements[1];
    output[2] = sinT * this.elements[0] + cosT * this.elements[2];

    return new Vector(output);
  }

  /**
   * Rotates the vector around the Z-axis by the specified angle.
   * @param theta The angle of rotation in radians.
   * @returns A new Vector representing the rotated vector.
   */
  rotZ(theta: Radians): Vector {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const output = new Array(3);

    output[0] = cosT * this.elements[0] + sinT * this.elements[1];
    output[1] = -sinT * this.elements[0] + cosT * this.elements[1];
    output[2] = this.elements[2];

    return new Vector(output);
  }

  /**
   * Calculates the angle between this vector and another vector.
   * @param v The other vector.
   * @returns The angle between the two vectors in radians.
   */
  angle(v: Vector): Radians {
    // better than acos for small angles
    const theta = Math.atan2(this.cross(v).magnitude(), this.dot(v));

    if (isNaN(theta)) {
      return 0.0 as Radians;
    }

    return theta as Radians;
  }

  /**
   * Calculates the angle between this vector and another vector in degrees.
   * @param v The other vector.
   * @returns The angle between the two vectors in degrees.
   */
  angleDegrees(v: Vector): Degrees {
    return (this.angle(v) * (180 / Math.PI)) as Degrees;
  }

  /**
   * Determines if there is line of sight between this vector and another vector
   * within a given radius.
   * @param v - The vector to check line of sight with.
   * @param radius - The radius within which line of sight is considered.
   * @returns True if there is line of sight, false otherwise.
   */
  sight(v: Vector, radius: number): boolean {
    const r1Mag2 = this.magnitude() ** 2;
    const r2Mag2 = v.magnitude() ** 2;
    const rDot = this.dot(v);
    const tMin = (r1Mag2 - rDot) / (r1Mag2 + r2Mag2 - 2.0 * rDot);
    let los = false;

    if (tMin < 0 || tMin > 1) {
      los = true;
    } else {
      const c = (1.0 - tMin) * r1Mag2 + rDot * tMin;

      if (c >= radius * radius) {
        los = true;
      }
    }

    return los;
  }

  /**
   * Returns the bisect vector between this vector and the given vector. The
   * bisect vector is calculated by scaling this vector's magnitude by the
   * magnitude of the given vector, adding the result to the product of scaling
   * the given vector's magnitude by this vector's magnitude, and then
   * normalizing the resulting vector.
   * @param v - The vector to calculate the bisect with.
   * @returns The bisect vector.
   */
  bisect(v: Vector): Vector {
    return this.scale(v.magnitude()).add(v.scale(this.magnitude())).normalize();
  }

  /**
   * Joins the current vector with another vector.
   * @param v The vector to join with.
   * @returns A new vector that contains the elements of both vectors.
   */
  join(v: Vector): Vector {
    return new Vector(this.toList().concat(v.toList()));
  }

  /**
   * Returns a new Vector containing a portion of the elements from the
   * specified start index to the specified end index
   * @param start The start index of the slice (inclusive).
   * @param end The end index of the slice (exclusive).
   * @returns A new Vector containing the sliced elements.
   */
  slice(start: number, end: number): Vector {
    return new Vector(this.elements.slice(start, end));
  }

  /**
   * Returns a new Matrix object representing the row vector.
   * @returns The row vector as a Matrix object.
   */
  row(): Matrix {
    return new Matrix([this.toList()]);
  }

  /**
   * Returns a new Matrix object representing the column vector of this Vector.
   * @returns The column vector as a Matrix object.
   */
  column(): Matrix {
    return new Matrix(this.toList().map((e) => [e]));
  }

  /**
   * Converts the elements at the specified index to a Vector3D object.
   * @param index - The index of the elements to convert.
   * @returns A new Vector3D object containing the converted elements.
   */
  toVector3D(index: number): Vector3D {
    return new Vector3D(this.elements[index], this.elements[index + 1], this.elements[index + 2]);
  }
}
