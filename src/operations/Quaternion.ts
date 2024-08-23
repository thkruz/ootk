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

import { Matrix, Radians, RadiansPerSecond, Vector, Vector3D, wrapAngle } from '../main.js';

export class Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;

  constructor(x: number, y: number, z: number, w: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  static readonly zero = new Quaternion(0, 0, 0, 0);
  static readonly one = new Quaternion(0, 0, 0, 1);
  static readonly xAxis = new Quaternion(1, 0, 0, 0);
  static readonly yAxis = new Quaternion(0, 1, 0, 0);
  static readonly zAxis = new Quaternion(0, 0, 1, 0);

  toString(precision = 8): string {
    const xStr = this.x.toFixed(precision);
    const yStr = this.y.toFixed(precision);
    const zStr = this.z.toFixed(precision);
    const wStr = this.w.toFixed(precision);

    return `Q(x: ${xStr}, y: ${yStr}, z: ${zStr}, w: ${wStr})`;
  }

  positivePolar(): Quaternion {
    return this.w >= 0 ? this.normalize() : this.negate().normalize();
  }

  magnitudeSquared(): number {
    return this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z;
  }

  magnitude(): number {
    return Math.sqrt(this.magnitudeSquared());
  }

  scale(n: number): Quaternion {
    return new Quaternion(n * this.x, n * this.y, n * this.z, n * this.w);
  }

  negate(): Quaternion {
    return this.scale(-1);
  }

  normalize(): Quaternion {
    const m = this.magnitude();

    if (m === 0) {
      return Quaternion.zero;
    }

    return this.scale(1 / m);
  }

  conjugate(): Quaternion {
    return new Quaternion(-this.x, -this.y, -this.z, this.w);
  }

  inverse(): Quaternion {
    return this.conjugate().scale(1 / this.magnitudeSquared());
  }

  add(q: Quaternion): Quaternion {
    return new Quaternion(this.x + q.x, this.y + q.y, this.z + q.z, this.w + q.w);
  }

  subtract(q: Quaternion): Quaternion {
    return new Quaternion(this.x - q.x, this.y - q.y, this.z - q.z, this.w - q.w);
  }

  addReal(n: number): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w + n);
  }

  multiply(q: Quaternion): Quaternion {
    const mx = this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y;
    const my = this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x;
    const mz = this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w;
    const mw = this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z;

    return new Quaternion(mx, my, mz, mw);
  }

  dot(q: Quaternion): number {
    return this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;
  }

  rotateVector(v: Vector): Vector {
    const q = this.multiply(new Quaternion(v.x, v.y, v.z, 0)).multiply(this.conjugate());

    return new Vector([q.x, q.y, q.z]);
  }

  rotateVector3D(v: Vector3D): Vector3D {
    const q = this.multiply(new Quaternion(v.x, v.y, v.z, 0)).multiply(this.conjugate());

    return new Vector3D(q.x, q.y, q.z);
  }

  lerp(q: Quaternion, t: number): Quaternion {
    const f = 1.0 - t;

    return new Quaternion(
      f * this.x + t * q.x,
      f * this.y + t * q.y,
      f * this.z + t * q.z,
      f * this.w + t * q.w,
    ).positivePolar();
  }

  slerp(q: Quaternion, t: number): Quaternion {
    let qp = q;
    let dotP = this.dot(qp);

    if (dotP < 0) {
      dotP = -dotP;
      qp = qp.negate();
    }
    if (dotP > 0.9995) {
      return this.lerp(qp, t);
    }
    const theta = Math.acos(dotP);
    const sinTheta = Math.sin(theta);
    const f1 = Math.sin((1.0 - t) * theta) / sinTheta;
    const f2 = Math.sin(t * theta) / sinTheta;

    return new Quaternion(
      f1 * this.x + f2 * qp.x,
      f1 * this.y + f2 * qp.y,
      f1 * this.z + f2 * qp.z,
      f1 * this.w + f2 * qp.w,
    ).positivePolar();
  }

  toVector3D(): Vector3D {
    return new Vector3D(this.x, this.y, this.z);
  }

  angle(q: Quaternion): Radians {
    const c = this.multiply(q.conjugate()).normalize();

    return 2 * Math.atan2(c.toVector3D().magnitude(), c.w) as Radians;
  }

  geodesicAngle(q: Quaternion): Radians {
    const p = this.dot(q);

    return wrapAngle(Math.acos(2 * p * p - 1.0) as Radians);
  }

  distance(q: Quaternion): number {
    const m01 = this.subtract(q).magnitude();
    const p01 = this.add(q).magnitude();

    return m01 < p01 ? m01 : p01;
  }

  delta(qTo: Quaternion): Quaternion {
    return this.inverse().multiply(qTo);
  }

  toDirectionCosineMatrix(): Matrix {
    const w2 = this.w * this.w;
    const x2 = this.x * this.x;
    const y2 = this.y * this.y;
    const z2 = this.z * this.z;
    const m = [
      [w2 + x2 - y2 - z2, 2.0 * (this.x * this.y + this.z * this.w), 2.0 * (this.x * this.z - this.y * this.w)],
      [2.0 * (this.x * this.y - this.z * this.w), w2 - x2 + y2 - z2, 2.0 * (this.y * this.z + this.x * this.w)],
      [2.0 * (this.x * this.z + this.y * this.w), 2.0 * (this.y * this.z - this.x * this.w), w2 - x2 - y2 + z2],
    ];

    return new Matrix(m);
  }

  toRotationMatrix(): Matrix {
    return this.toDirectionCosineMatrix().transpose();
  }

  vectorAngle(observer: Vector3D, target: Vector3D, forward: Vector3D): number {
    const delta = target.subtract(observer);
    const transform = this.toDirectionCosineMatrix().multiplyVector3D(delta);

    return forward.angle(transform);
  }

  kinematics(angularVelocity: Vector3D<RadiansPerSecond>): Quaternion {
    const wPrime = new Vector([0, angularVelocity.x, angularVelocity.y, angularVelocity.z]);
    const qMat = new Matrix([
      [this.x, this.w, -this.z, this.y],
      [this.y, this.z, this.w, -this.x],
      [this.z, -this.y, this.x, this.w],
      [this.w, -this.x, -this.y, -this.z],
    ]);
    const result = qMat.multiplyVector(wPrime).scale(0.5).elements;

    return new Quaternion(result[0], result[1], result[2], result[3]);
  }
}
