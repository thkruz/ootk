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

import { EpochUTC, Quaternion, Vector3D } from '../main.js';
import { Seconds } from '../types/types.js';
import { Attitude, AttitudeState } from './Attitude.js';

/**
 * Spacecraft moment of inertia tensor (kg·m²).
 */
export interface MomentOfInertia {
  /** Moment of inertia about X-axis */
  Ixx: number;
  /** Moment of inertia about Y-axis */
  Iyy: number;
  /** Moment of inertia about Z-axis */
  Izz: number;
  /** Product of inertia (default: 0 for principal axes) */
  Ixy?: number;
  /** Product of inertia (default: 0 for principal axes) */
  Ixz?: number;
  /** Product of inertia (default: 0 for principal axes) */
  Iyz?: number;
}

/**
 * External torque vector (N·m).
 */
export type Torque = Vector3D<number>;

/**
 * Attitude propagator using Euler's equations of motion.
 */
export class AttitudePropagator {
  private inertia_: MomentOfInertia;
  private initialState_: AttitudeState;

  constructor(initialState: AttitudeState, inertia: MomentOfInertia) {
    this.initialState_ = initialState;
    this.inertia_ = inertia;
  }

  /**
   * Propagate attitude to a new epoch.
   * Uses RK4 integration of Euler's equations and quaternion kinematics.
   * @param targetEpoch - Target epoch
   * @param externalTorque - External torque function (optional)
   * @param stepSize - Integration step size in seconds (default: 1)
   * @returns Attitude state at target epoch
   */
  propagate(
    targetEpoch: EpochUTC,
    externalTorque?: (state: AttitudeState) => Torque,
    stepSize: Seconds = 1 as Seconds,
  ): AttitudeState {
    const dt = (targetEpoch.toJulianDate() - this.initialState_.epoch.toJulianDate()) * 86400;

    if (Math.abs(dt) < 1e-6) {
      return this.initialState_;
    }

    let state = this.initialState_;
    const steps = Math.ceil(Math.abs(dt) / stepSize);
    const h = dt / steps;

    for (let i = 0; i < steps; i++) {
      state = this.stepRK4_(state, h as Seconds, externalTorque);
    }

    return state;
  }

  /**
   * Propagate torque-free motion (no external torques).
   * @param targetEpoch - Target epoch
   * @param stepSize - Integration step size in seconds (default: 1)
   * @returns Attitude state at target epoch
   */
  propagateTorqueFree(targetEpoch: EpochUTC, stepSize: Seconds = 1 as Seconds): AttitudeState {
    return this.propagate(targetEpoch, undefined, stepSize);
  }

  /**
   * Single RK4 integration step.
   */
  private stepRK4_(state: AttitudeState, h: Seconds, torqueFunc?: (state: AttitudeState) => Torque): AttitudeState {
    const k1 = this.derivative_(state, torqueFunc);
    const k2 = this.derivative_(this.addDerivative_(state, k1, h / 2), torqueFunc);
    const k3 = this.derivative_(this.addDerivative_(state, k2, h / 2), torqueFunc);
    const k4 = this.derivative_(this.addDerivative_(state, k3, h), torqueFunc);

    // Combine derivatives
    const dq = new Quaternion(
      (k1.dq.x + 2 * k2.dq.x + 2 * k3.dq.x + k4.dq.x) / 6,
      (k1.dq.y + 2 * k2.dq.y + 2 * k3.dq.y + k4.dq.y) / 6,
      (k1.dq.z + 2 * k2.dq.z + 2 * k3.dq.z + k4.dq.z) / 6,
      (k1.dq.w + 2 * k2.dq.w + 2 * k3.dq.w + k4.dq.w) / 6,
    );

    const dw = new Vector3D(
      (k1.dw.x + 2 * k2.dw.x + 2 * k3.dw.x + k4.dw.x) / 6,
      (k1.dw.y + 2 * k2.dw.y + 2 * k3.dw.y + k4.dw.y) / 6,
      (k1.dw.z + 2 * k2.dw.z + 2 * k3.dw.z + k4.dw.z) / 6,
    );

    // Update state
    const newQ = new Quaternion(
      state.quaternion.x + dq.x * h,
      state.quaternion.y + dq.y * h,
      state.quaternion.z + dq.z * h,
      state.quaternion.w + dq.w * h,
    ).normalize();

    const newW = new Vector3D(
      state.angularVelocity.x + dw.x * h,
      state.angularVelocity.y + dw.y * h,
      state.angularVelocity.z + dw.z * h,
    );

    const newEpoch = state.epoch.roll(h);

    return {
      epoch: newEpoch,
      quaternion: newQ,
      angularVelocity: newW,
    };
  }

  /**
   * Calculate state derivative (dq/dt and dw/dt).
   */
  private derivative_(
    state: AttitudeState,
    torqueFunc?: (state: AttitudeState) => Torque,
  ): { dq: Quaternion; dw: Vector3D<number> } {
    const q = state.quaternion;
    const w = state.angularVelocity;

    // Quaternion derivative: dq/dt = 0.5 * q * w
    const wQuat = new Quaternion(w.x, w.y, w.z, 0);
    const dq = q.multiply(wQuat).scale(0.5);

    // Euler's equations: I·dω/dt = τ - ω × (I·ω)
    const Ixx = this.inertia_.Ixx;
    const Iyy = this.inertia_.Iyy;
    const Izz = this.inertia_.Izz;

    // For principal axes (products of inertia = 0)
    const Iw = new Vector3D(Ixx * w.x, Iyy * w.y, Izz * w.z);
    const wCrossIw = w.cross(Iw);

    // External torque
    const torque = torqueFunc ? torqueFunc(state) : new Vector3D(0, 0, 0);

    // dω/dt
    const dw = new Vector3D(
      (torque.x - wCrossIw.x) / Ixx,
      (torque.y - wCrossIw.y) / Iyy,
      (torque.z - wCrossIw.z) / Izz,
    );

    return { dq, dw };
  }

  /**
   * Add derivative to state for intermediate RK4 steps.
   */
  private addDerivative_(state: AttitudeState, deriv: { dq: Quaternion; dw: Vector3D<number> }, h: number): AttitudeState {
    const newQ = new Quaternion(
      state.quaternion.x + deriv.dq.x * h,
      state.quaternion.y + deriv.dq.y * h,
      state.quaternion.z + deriv.dq.z * h,
      state.quaternion.w + deriv.dq.w * h,
    ).normalize();

    const newW = new Vector3D(
      state.angularVelocity.x + deriv.dw.x * h,
      state.angularVelocity.y + deriv.dw.y * h,
      state.angularVelocity.z + deriv.dw.z * h,
    );

    return {
      epoch: state.epoch.roll(h as Seconds),
      quaternion: newQ,
      angularVelocity: newW,
    };
  }

  /**
   * Create a gravity gradient torque function.
   * This torque causes spacecraft to naturally align with the local vertical.
   * @param orbitalRadius - Orbital radius in meters
   * @returns Torque function
   */
  static gravityGradientTorque(orbitalRadius: number): (state: AttitudeState) => Torque {
    const mu = 3.986004418e14; // Earth's gravitational parameter (m³/s²)
    const n = Math.sqrt(mu / orbitalRadius ** 3); // Orbital rate

    return (state: AttitudeState): Torque => {
      // Simplified gravity gradient torque for nadir-pointing
      // τ = 3n²(Izz - Iyy)sin(θ)cos(θ) (for small angles)
      const attitude = new Attitude(state.quaternion, state.epoch);
      const euler = attitude.toEulerAngles();

      const Ixx = 100; // Placeholder - should use actual inertia
      const Iyy = 150;
      const Izz = 200;

      // Approximate torque (simplified)
      const torqueX = 3 * n * n * (Izz - Iyy) * Math.sin(euler.pitch) * Math.cos(euler.pitch);
      const torqueY = 3 * n * n * (Ixx - Izz) * Math.sin(euler.roll) * Math.cos(euler.roll);
      const torqueZ = 3 * n * n * (Iyy - Ixx) * Math.sin(euler.yaw) * Math.cos(euler.yaw);

      return new Vector3D(torqueX, torqueY, torqueZ);
    };
  }
}
