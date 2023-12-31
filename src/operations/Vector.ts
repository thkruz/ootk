import { Matrix } from './Matrix';
import { Vector3D } from './Vector3D';

// / Vector operations.
export class Vector<T extends number = number> {
  // / Create a new [Vector] object from an array of [_elements].
  constructor(private _elements: T[] | Float64Array) {
    this.length = _elements.length;
  }

  // / Create a zero-filled [Vector] of the provided [length];
  static zero(length: number): Vector {
    return new Vector(new Array(length).fill(0));
  }

  /**
   * Create a [Vector] of the provided [length], filled with the
   * provided [value].
   */
  static filled(length: number, value: number): Vector {
    return new Vector(new Array(length).fill(value));
  }

  /**
   * Create a [Vector] from the provided [elements] list.
   */
  static fromList(elements: number[]): Vector {
    return new Vector(elements);
  }

  // / Vector length.
  readonly length: number;

  // / 3-dimensional origin.
  static readonly origin3 = new Vector([0, 0, 0]);

  // / 6-dimensional origin.
  static readonly origin6 = new Vector([0, 0, 0, 0, 0, 0]);

  // / X-axis unit vector.
  static readonly xAxis = new Vector([1, 0, 0]);

  // / Y-axis unit vector.
  static readonly yAxis = new Vector([0, 1, 0]);

  // / Z-axis unit vector.
  static readonly zAxis = new Vector([0, 0, 1]);

  // / Negative x-axis unit vector.
  static readonly xAxisNeg = new Vector([-1, 0, 0]);

  // / Negative y-axis unit vector.
  static readonly yAxisNeg = new Vector([0, -1, 0]);

  // / Negative z-axis unit vector.
  static readonly zAxisNeg = new Vector([0, 0, -1]);

  toString(fixed = -1): string {
    if (fixed < 0) {
      return `[${this._elements.join(', ')}]`;
    }
    const output = this._elements.map((e) => e.toFixed(fixed));

    return `[${output.join(', ')}]`;
  }

  // / X-axis component.
  get x(): number {
    return this._elements[0];
  }

  // / Y-axis component.
  get y(): number {
    return this._elements[1];
  }

  // / Z-axis component.
  get z(): number {
    return this._elements[2];
  }

  // / Convert the elements of this [Vector] to a list object.
  toList(): number[] {
    return Array.from(this._elements);
  }

  // / Copy the elements of this [Vector] to a new array.
  toArray(): Float64Array {
    return new Float64Array(this._elements);
  }

  // / Return the magnitude of this vector.
  magnitude(): number {
    let total = 0;

    for (const x of this._elements) {
      total += x * x;
    }

    return Math.sqrt(total);
  }

  // / Return the result of adding this to another [Vector].
  add(v: Vector): Vector {
    const output = new Array(this.length);

    for (let i = 0; i < this.length; i++) {
      output[i] = this._elements[i] + v._elements[i];
    }

    return new Vector(output);
  }

  // / Return the result of subtracting this and another [Vector].
  subtract(v: Vector): Vector {
    const output = new Array(this.length);

    for (let i = 0; i < this.length; i++) {
      output[i] = this._elements[i] - v._elements[i];
    }

    return new Vector(output);
  }

  // / Return a copy of this [Vector] scaled by [n];
  scale(n: number): Vector {
    const output = new Array(this.length);

    for (let i = 0; i < this.length; i++) {
      output[i] = this._elements[i] * n;
    }

    return new Vector(output);
  }

  // / Return a copy of this [Vector] with the elements negated.
  negate(): Vector {
    return this.scale(-1);
  }

  // / Return the Euclidean distance between this and another [Vector].
  distance(v: Vector): number {
    return this.subtract(v).magnitude();
  }

  // / Convert this to a unit [Vector].
  normalize(): Vector {
    const m = this.magnitude();

    if (m === 0) {
      return Vector.zero(this.length);
    }

    return this.scale(1.0 / m);
  }

  // / Calculate the dot product of this and another [Vector];
  dot(v: Vector): number {
    let total = 0;

    for (let i = 0; i < this.length; i++) {
      total += this._elements[i] * v._elements[i];
    }

    return total;
  }

  // / Calculate the outer product between this and another [Vector].
  outer(v: Vector): Matrix {
    const result: number[][] = [];

    for (let i = 0; i < this.length; i++) {
      result[i] = [];
      for (let j = 0; j < v.length; j++) {
        result[i][j] = this._elements[i] * v._elements[j];
      }
    }

    return new Matrix(result);
  }

  // / Calculate the cross product of this and another [Vector];
  cross(v: Vector): Vector {
    const output = new Array(this.length);

    for (let i = 0; i < this.length; i++) {
      output[i] =
        this._elements[(i + 1) % this.length] * v._elements[(i + 2) % this.length] -
        this._elements[(i + 2) % this.length] * v._elements[(i + 1) % this.length];
    }

    return new Vector(output);
  }

  /**
   * Calculate the skew-symmetric matrix for this [Vector].
   *
   * An error will be thrown if the vector is not length 3.
   */
  skewSymmetric(): Matrix {
    if (this.length !== 3) {
      throw new Error('Skew-symmetric matrix requires a vector of length 3.');
    }

    return new Matrix([
      [0, -this._elements[2], this._elements[1]],
      [this._elements[2], 0, -this._elements[0]],
      [-this._elements[1], this._elements[0], 0],
    ]);
  }

  /**
   * Create a copy of this [Vector] rotated in the x-axis by angle
   * [theta] _(rad)_.
   */
  rotX(theta: number): Vector {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const output = new Array(3);

    output[0] = this._elements[0];
    output[1] = cosT * this._elements[1] + sinT * this._elements[2];
    output[2] = -sinT * this._elements[1] + cosT * this._elements[2];

    return new Vector(output);
  }

  /**
   * Create a copy of this [Vector] rotated in the y-axis by angle
   * [theta] _(rad)_.
   */
  rotY(theta: number): Vector {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const output = new Array(3);

    output[0] = cosT * this._elements[0] + -sinT * this._elements[2];
    output[1] = this._elements[1];
    output[2] = sinT * this._elements[0] + cosT * this._elements[2];

    return new Vector(output);
  }

  /**
   * Create a copy of this [Vector] rotated in the z-axis by angle
   * [theta] _(rad)_.
   */
  rotZ(theta: number): Vector {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const output = new Array(3);

    output[0] = cosT * this._elements[0] + sinT * this._elements[1];
    output[1] = -sinT * this._elements[0] + cosT * this._elements[1];
    output[2] = this._elements[2];

    return new Vector(output);
  }

  // / Calculate the angle _(rad)_ between this and another [Vector].
  angle(v: Vector): number {
    // better than acos for small angles
    const theta = Math.atan2(this.cross(v).magnitude(), this.dot(v));

    if (isNaN(theta)) {
      return 0.0;
    }

    return theta;
  }

  // / Calculate the angle _(°)_ between this and another [Vector].
  angleDegrees(v: Vector): number {
    return this.angle(v) * (180 / Math.PI);
  }

  /**
   * Return `true` if line-of-sight exists between this and another [Vector]
   * with a central body of the given [radius].
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

  // / Return the unit vector that bisects this and another [Vector].
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
   * Returns a new Vector containing a portion of the elements from the specified start index to the specified end index
   * @param start The start index of the slice (inclusive).
   * @param end The end index of the slice (exclusive).
   * @returns A new Vector containing the sliced elements.
   */
  slice(start: number, end: number): Vector {
    return new Vector(this._elements.slice(start, end));
  }

  // / Convert this [Vector] into a row [Matrix].
  row(): Matrix {
    return new Matrix([this.toList()]);
  }

  // / Convert this [Vector] into a column [Matrix].
  column(): Matrix {
    return new Matrix(this.toList().map((e) => [e]));
  }

  /**
   * Converts the elements at the specified index to a Vector3D object.
   * @param index - The index of the elements to convert.
   * @returns A new Vector3D object containing the converted elements.
   */
  toVector3D(index: number): Vector3D {
    return new Vector3D(this._elements[index], this._elements[index + 1], this._elements[index + 2]);
  }
}
