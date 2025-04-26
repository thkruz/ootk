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

import { DEG2RAD, Degrees, Matrix, RAD2DEG, Radians, Vector3D } from '../main.js';

// / Class containing Euler angles.
export class EulerAngles {
  // / Roll component _(rad)_.
  roll: number;

  // / Pitch component _(rad)_.
  pitch: number;

  // / Yaw component _(rad)_.
  yaw: number;

  /**
   * Create a new EulerAngles object from roll, pitch, and yaw angles in radians.
   * @param roll Roll angle in radians.
   * @param pitch Pitch angle in radians.
   * @param yaw Yaw angle in radians.
   */
  constructor(roll: Radians, pitch: Radians, yaw: Radians) {
    this.roll = roll;
    this.pitch = pitch;
    this.yaw = yaw;
  }

  /**
   * Create a new EulerAngles object from roll, pitch, and yaw angles.
   * @param rollDeg Roll angle in degrees.
   * @param pitchDeg Pitch angle in degrees.
   * @param yawDeg Yaw angle in degrees.
   * @returns EulerAngles object.
   */
  static fromDegrees(rollDeg: Degrees, pitchDeg: Degrees, yawDeg: Degrees): EulerAngles {
    const roll = rollDeg * DEG2RAD as Radians;
    const pitch = pitchDeg * DEG2RAD as Radians;
    const yaw = yawDeg * DEG2RAD as Radians;

    return new EulerAngles(roll, pitch, yaw);
  }

  /**
   * Create a new EulerAngles object from 3-2-1 ordered direction cosine matrix c.
   * @param c 3-2-1 ordered direction cosine matrix.
   * @returns EulerAngles object.
   */
  static fromDcm321(c: Matrix): EulerAngles {
    const roll = Math.atan(c.elements[1][2] / c.elements[2][2]) as Radians;
    const pitch = -Math.asin(c.elements[0][2]) as Radians;
    const yaw = Math.atan(c.elements[0][1] / c.elements[0][0]) as Radians;

    return new EulerAngles(roll, pitch, yaw);
  }

  /**
   * Gets the roll angle in degrees.
   * @returns The roll angle in degrees.
   */
  get rollDegrees(): Degrees {
    return this.roll * RAD2DEG as Degrees;
  }

  /**
   * Gets the pitch angle in degrees.
   * @returns The pitch angle in degrees.
   */
  get pitchDegrees(): Degrees {
    return this.pitch * RAD2DEG as Degrees;
  }

  /**
   * Gets the yaw angle in degrees.
   * @returns The yaw angle in degrees.
   */
  get yawDegrees(): Degrees {
    return this.yaw * RAD2DEG as Degrees;
  }

  /**
   * Gets the roll angle in radians.
   * @returns The roll angle in radians.
   */
  get phi(): Radians {
    return this.roll as Radians;
  }

  /**
   * Gets the pitch angle in radians.
   * @returns The pitch angle in radians.
   */
  get theta(): Radians {
    return this.pitch as Radians;
  }

  /**
   * Gets the yaw angle in radians.
   * @returns The yaw angle in radians.
   */
  get psi(): Radians {
    return this.yaw as Radians;
  }

  /**
   * Gets the roll component in degrees.
   * @returns The roll component in degrees.
   */
  get phiDegrees(): Degrees {
    return this.phi * RAD2DEG as Degrees;
  }

  /**
   * Gets the pitch component in degrees.
   * @returns The pitch component in degrees.
   */
  get thetaDegrees(): Degrees {
    return this.theta * RAD2DEG as Degrees;
  }

  /**
   * Gets the yaw component in degrees.
   * @returns The yaw component in degrees.
   */
  get psiDegrees(): Degrees {
    return this.psi * RAD2DEG as Degrees;
  }

  /**
   * Returns a string representation of the Euler angles.
   * @param precision The number of decimal places to include in the string representation. Default is 6.
   * @returns A string representation of the Euler angles.
   */
  toString(precision = 6): string {
    const rollStr = this.rollDegrees.toFixed(precision);
    const pitchStr = this.pitchDegrees.toFixed(precision);
    const yawStr = this.yawDegrees.toFixed(precision);

    return `Euler(roll: ${rollStr}°, pitch: ${pitchStr}°, yaw: ${yawStr}°)`;
  }

  /**
   * Calculates the Direction Cosine Matrix (DCM) using the 3-2-1 Euler angles convention.
   * @returns The calculated DCM as a Matrix object.
   */
  dcm321(): Matrix {
    const sPhi = Math.sin(this.phi);
    const cPhi = Math.cos(this.phi);
    const sTheta = Math.sin(this.theta);
    const cTheta = Math.cos(this.theta);
    const sPsi = Math.sin(this.psi);
    const cPsi = Math.cos(this.psi);

    return new Matrix([
      [cTheta * cPsi, cTheta * sPsi, -sTheta],
      [sPhi * sTheta * cPsi - cPhi * sPsi, sPhi * sTheta * sPsi + cPhi * cPsi, sPhi * cTheta],
      [cPhi * sTheta * cPsi + sPhi * sPsi, cPhi * sTheta * sPsi - sPhi * cPsi, cPhi * cTheta],
    ]);
  }

  /**
   * Rotates a 3D vector using a 3-2-1 Euler angle sequence.
   * @param v The vector to rotate.
   * @returns The rotated vector.
   */
  rotateVector321(v: Vector3D): Vector3D {
    return this.dcm321().multiplyVector3D(v);
  }
}
