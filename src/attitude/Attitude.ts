/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
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

import { EpochUTC, Matrix, Quaternion, Vector3D } from '../main.js';
import { Degrees, Radians, Seconds } from '../types/types.js';
import { DEG2RAD, RAD2DEG } from '../utils/constants.js';

/**
 * Euler angles representation (3-2-1 sequence).
 */
export interface AttitudeEulerAngles {
  /** Roll angle in radians */
  roll: Radians;
  /** Pitch angle in radians */
  pitch: Radians;
  /** Yaw angle in radians */
  yaw: Radians;
}

/**
 * Attitude state including orientation and angular velocity.
 */
export interface AttitudeState {
  /** Epoch of the state */
  epoch: EpochUTC;
  /** Orientation quaternion */
  quaternion: Quaternion;
  /** Angular velocity in rad/s */
  angularVelocity: Vector3D<number>;
}

/**
 * Attitude representation and manipulation.
 * Handles spacecraft orientation using quaternions and Euler angles.
 */
export class Attitude {
  private quaternion_: Quaternion;
  private epoch_: EpochUTC;

  constructor(quaternion: Quaternion, epoch: EpochUTC) {
    this.quaternion_ = quaternion.normalize();
    this.epoch_ = epoch;
  }

  /**
   * Get the orientation quaternion.
   * @returns Orientation quaternion
   */
  get quaternion(): Quaternion {
    return this.quaternion_;
  }

  /**
   * Get the epoch.
   * @returns Epoch
   */
  get epoch(): EpochUTC {
    return this.epoch_;
  }

  /**
   * Convert quaternion to Euler angles (3-2-1 sequence).
   * @returns Euler angles
   */
  toEulerAngles(): AttitudeEulerAngles {
    const q = this.quaternion_;
    const q0 = q.w;
    const q1 = q.x;
    const q2 = q.y;
    const q3 = q.z;

    // 3-2-1 (yaw-pitch-roll) sequence
    const roll = Math.atan2(2 * (q0 * q1 + q2 * q3), 1 - 2 * (q1 * q1 + q2 * q2)) as Radians;
    const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (q0 * q2 - q3 * q1)))) as Radians;
    const yaw = Math.atan2(2 * (q0 * q3 + q1 * q2), 1 - 2 * (q2 * q2 + q3 * q3)) as Radians;

    return { roll, pitch, yaw };
  }

  /**
   * Convert quaternion to direction cosine matrix (DCM).
   * @returns Direction cosine matrix
   */
  toDCM(): Matrix {
    const q = this.quaternion_;
    const q0 = q.w;
    const q1 = q.x;
    const q2 = q.y;
    const q3 = q.z;

    const m11 = 1 - 2 * (q2 * q2 + q3 * q3);
    const m12 = 2 * (q1 * q2 + q0 * q3);
    const m13 = 2 * (q1 * q3 - q0 * q2);

    const m21 = 2 * (q1 * q2 - q0 * q3);
    const m22 = 1 - 2 * (q1 * q1 + q3 * q3);
    const m23 = 2 * (q2 * q3 + q0 * q1);

    const m31 = 2 * (q1 * q3 + q0 * q2);
    const m32 = 2 * (q2 * q3 - q0 * q1);
    const m33 = 1 - 2 * (q1 * q1 + q2 * q2);

    return new Matrix([
      [m11, m12, m13],
      [m21, m22, m23],
      [m31, m32, m33],
    ]);
  }

  /**
   * Rotate a vector from body frame to inertial frame.
   * @param bodyVector - Vector in body frame
   * @returns Vector in inertial frame
   */
  bodyToInertial(bodyVector: Vector3D<number>): Vector3D<number> {
    return this.quaternion_.rotateVector3D(bodyVector);
  }

  /**
   * Rotate a vector from inertial frame to body frame.
   * @param inertialVector - Vector in inertial frame
   * @returns Vector in body frame
   */
  inertialToBody(inertialVector: Vector3D<number>): Vector3D<number> {
    return this.quaternion_.conjugate().rotateVector3D(inertialVector);
  }

  /**
   * Create attitude from Euler angles (3-2-1 sequence).
   * @param roll - Roll angle in radians
   * @param pitch - Pitch angle in radians
   * @param yaw - Yaw angle in radians
   * @param epoch - Epoch
   * @returns Attitude object
   */
  static fromEulerAngles(roll: Radians, pitch: Radians, yaw: Radians, epoch: EpochUTC): Attitude {
    const cr = Math.cos(roll / 2);
    const sr = Math.sin(roll / 2);
    const cp = Math.cos(pitch / 2);
    const sp = Math.sin(pitch / 2);
    const cy = Math.cos(yaw / 2);
    const sy = Math.sin(yaw / 2);

    const w = cr * cp * cy + sr * sp * sy;
    const x = sr * cp * cy - cr * sp * sy;
    const y = cr * sp * cy + sr * cp * sy;
    const z = cr * cp * sy - sr * sp * cy;

    return new Attitude(new Quaternion(x, y, z, w), epoch);
  }

  /**
   * Create attitude from direction cosine matrix.
   * @param dcm - Direction cosine matrix
   * @param epoch - Epoch
   * @returns Attitude object
   */
  static fromDCM(dcm: Matrix, epoch: EpochUTC): Attitude {
    const trace = dcm.elements[0][0] + dcm.elements[1][1] + dcm.elements[2][2];

    let w: number, x: number, y: number, z: number;

    if (trace > 0) {
      const s = Math.sqrt(trace + 1) * 2;

      w = 0.25 * s;
      x = (dcm.elements[2][1] - dcm.elements[1][2]) / s;
      y = (dcm.elements[0][2] - dcm.elements[2][0]) / s;
      z = (dcm.elements[1][0] - dcm.elements[0][1]) / s;
    } else if (dcm.elements[0][0] > dcm.elements[1][1] && dcm.elements[0][0] > dcm.elements[2][2]) {
      const s = Math.sqrt(1 + dcm.elements[0][0] - dcm.elements[1][1] - dcm.elements[2][2]) * 2;

      w = (dcm.elements[2][1] - dcm.elements[1][2]) / s;
      x = 0.25 * s;
      y = (dcm.elements[0][1] + dcm.elements[1][0]) / s;
      z = (dcm.elements[0][2] + dcm.elements[2][0]) / s;
    } else if (dcm.elements[1][1] > dcm.elements[2][2]) {
      const s = Math.sqrt(1 + dcm.elements[1][1] - dcm.elements[0][0] - dcm.elements[2][2]) * 2;

      w = (dcm.elements[0][2] - dcm.elements[2][0]) / s;
      x = (dcm.elements[0][1] + dcm.elements[1][0]) / s;
      y = 0.25 * s;
      z = (dcm.elements[1][2] + dcm.elements[2][1]) / s;
    } else {
      const s = Math.sqrt(1 + dcm.elements[2][2] - dcm.elements[0][0] - dcm.elements[1][1]) * 2;

      w = (dcm.elements[1][0] - dcm.elements[0][1]) / s;
      x = (dcm.elements[0][2] + dcm.elements[2][0]) / s;
      y = (dcm.elements[1][2] + dcm.elements[2][1]) / s;
      z = 0.25 * s;
    }

    return new Attitude(new Quaternion(x, y, z, w), epoch);
  }

  /**
   * Create nadir-pointing attitude.
   * Points the -Z axis toward Earth's center.
   * @param position - Satellite position vector (ECI)
   * @param velocity - Satellite velocity vector (ECI)
   * @param epoch - Epoch
   * @returns Nadir-pointing attitude
   */
  static nadirPointing(position: Vector3D<number>, velocity: Vector3D<number>, epoch: EpochUTC): Attitude {
    // Nadir pointing: -Z axis toward Earth center
    const nadir = position.normalize().scale(-1);

    // Velocity direction (approximate along-track)
    const alongTrack = velocity.normalize();

    // Cross-track (orbit normal)
    const crossTrack = position.cross(velocity).normalize();

    // Recompute along-track to ensure orthogonality
    const alongTrackOrth = crossTrack.cross(nadir);

    // Create DCM with body axes aligned to orbital frame
    const dcm = new Matrix([
      [alongTrackOrth.x, crossTrack.x, nadir.x],
      [alongTrackOrth.y, crossTrack.y, nadir.y],
      [alongTrackOrth.z, crossTrack.z, nadir.z],
    ]);

    return Attitude.fromDCM(dcm, epoch);
  }

  /**
   * Create Sun-pointing attitude.
   * Points the +X axis toward the Sun.
   * @param sunVector - Vector from satellite to Sun (ECI)
   * @param orbitNormal - Orbit normal vector (ECI)
   * @param epoch - Epoch
   * @returns Sun-pointing attitude
   */
  static sunPointing(sunVector: Vector3D<number>, orbitNormal: Vector3D<number>, epoch: EpochUTC): Attitude {
    // Point +X toward Sun
    const xAxis = sunVector.normalize();

    // Keep orbit normal in Y-Z plane
    const zAxis = orbitNormal.normalize();

    // Y axis completes right-handed system
    const yAxis = zAxis.cross(xAxis).normalize();

    // Recompute Z to ensure orthogonality
    const zAxisOrth = xAxis.cross(yAxis);

    const dcm = new Matrix([
      [xAxis.x, yAxis.x, zAxisOrth.x],
      [xAxis.y, yAxis.y, zAxisOrth.y],
      [xAxis.z, yAxis.z, zAxisOrth.z],
    ]);

    return Attitude.fromDCM(dcm, epoch);
  }

  /**
   * Create inertially fixed attitude.
   * @param epoch - Epoch
   * @returns Identity attitude (no rotation)
   */
  static inertial(epoch: EpochUTC): Attitude {
    return new Attitude(new Quaternion(0, 0, 0, 1), epoch);
  }
}
