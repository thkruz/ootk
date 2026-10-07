/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
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

import { Thrust } from '../force/Thrust';
import { Earth } from '../body/Earth';
import { EpochUTC } from '../time/EpochUTC';
import { MetersPerSecond, Radians, Seconds, SecondsPerMeterPerSecond } from '../types/types';

// / Which burn of a two-burn transfer carries the plane change.
export type PlaneChangeAssignment = 'burn1' | 'burn2' | 'none';

// / Result of a Hohmann transfer with an optional combined plane change.
export interface HohmannTransferWithPlaneChangeResult {
  /** Circular speed of the initial orbit (km/s). */
  vInit: number;
  /** Circular speed of the final orbit (km/s). */
  vFinal: number;
  /** Delta-V magnitude of the first burn (km/s). */
  deltaV1: number;
  /** Delta-V magnitude of the second burn (km/s). */
  deltaV2: number;
  /** Total delta-V for both burns (km/s). */
  deltaVTotal: number;
  /** Coast time between the two burns (s). */
  tTrans: Seconds;
  /** Which burn carries the plane change. */
  planeChangeBurn: PlaneChangeAssignment;
}

// / Container for a two-burn orbit transfer.
export class TwoBurnOrbitTransfer {
  // / Create a new [TwoBurnOrbitTransfer] object.
  constructor(
    public vInit: number,
    public vFinal: number,
    public vTransA: number,
    public vTransB: number,
    public tTrans: Seconds,
  ) {
    // Nothing to do here.
  }

  /**
   * Calculates the parameters for a Hohmann transfer orbit between two circular orbits.
   * @param rInit The initial radius of the orbit. (km)
   * @param rFinal The final radius of the orbit. (km)
   * @returns An instance of TwoBurnOrbitTransfer containing the calculated parameters.
   */
  static hohmannTransfer(rInit: number, rFinal: number): TwoBurnOrbitTransfer {
    const vInit = Math.sqrt(Earth.mu / rInit);
    const vFinal = Math.sqrt(Earth.mu / rFinal);
    const vTransA = vInit * (Math.sqrt((2.0 * rFinal) / (rInit + rFinal)) - 1.0);
    const vTransB = vFinal * (1.0 - Math.sqrt((2 * rInit) / (rInit + rFinal)));
    const tTrans = Math.PI * Math.sqrt((rInit + rFinal) ** 3 / (8.0 * Earth.mu)) as Seconds;

    return new TwoBurnOrbitTransfer(vInit, vFinal, vTransA, vTransB, tTrans);
  }

  /**
   * Calculates a Hohmann transfer between two circular orbits with an optional
   * inclination change folded into one of the two burns as a single combined
   * impulse.
   *
   * The plane change is cheapest where the orbital velocity is lowest. For a
   * raising transfer that is the second burn (at rFinal); for a lowering
   * transfer it is the first burn (at rInit). The plane change is auto-assigned
   * to the cheaper burn and the assignment is reported in the result. A
   * combined burn costs `sqrt(v1^2 + v2^2 - 2 * v1 * v2 * cos(deltaInc))`
   * (law of cosines between the pre- and post-burn velocity vectors).
   * @param rInit The initial orbit radius. (km)
   * @param rFinal The final orbit radius. (km)
   * @param deltaIncRad The inclination change. (rad)
   * @returns Per-burn delta-V magnitudes, total, transfer time, and the plane-change assignment.
   */
  static hohmannTransferWithPlaneChange(rInit: number, rFinal: number, deltaIncRad: Radians): HohmannTransferWithPlaneChangeResult {
    const vInit = Math.sqrt(Earth.mu / rInit);
    const vFinal = Math.sqrt(Earth.mu / rFinal);
    // Speeds on the transfer ellipse at the initial and final radii
    const vTransInit = Math.sqrt(Earth.mu * (2 / rInit - 2 / (rInit + rFinal)));
    const vTransFinal = Math.sqrt(Earth.mu * (2 / rFinal - 2 / (rInit + rFinal)));
    const tTrans = Math.PI * Math.sqrt((rInit + rFinal) ** 3 / (8.0 * Earth.mu)) as Seconds;

    const combined = (v1: number, v2: number): number => Math.sqrt(v1 ** 2 + v2 ** 2 - 2 * v1 * v2 * Math.cos(deltaIncRad));

    let planeChangeBurn: PlaneChangeAssignment;
    let deltaV1: number;
    let deltaV2: number;

    if (deltaIncRad === 0) {
      planeChangeBurn = 'none';
      deltaV1 = Math.abs(vTransInit - vInit);
      deltaV2 = Math.abs(vFinal - vTransFinal);
    } else if (rFinal >= rInit) {
      planeChangeBurn = 'burn2';
      deltaV1 = Math.abs(vTransInit - vInit);
      deltaV2 = combined(vTransFinal, vFinal);
    } else {
      planeChangeBurn = 'burn1';
      deltaV1 = combined(vInit, vTransInit);
      deltaV2 = Math.abs(vFinal - vTransFinal);
    }

    return {
      vInit,
      vFinal,
      deltaV1,
      deltaV2,
      deltaVTotal: deltaV1 + deltaV2,
      tTrans,
      planeChangeBurn,
    };
  }

  // / Return the total delta-velocity magnitude for both maneuvers _(km/s)_.
  get deltaV(): number {
    return Math.abs(this.vTransA) + Math.abs(this.vTransB);
  }

  /**
   * Calculates the two maneuver thrusts required for a two-burn orbit transfer.
   * @param epoch The epoch of the maneuver.
   * @param durationRate The duration rate of the maneuver (s/m/s).
   * @returns An array containing the two thrust objects representing the maneuvers.
   */
  toManeuvers(epoch: EpochUTC, durationRate = 0.0 as SecondsPerMeterPerSecond): [Thrust, Thrust] {
    const mA = new Thrust(
      epoch,
      0.0 as MetersPerSecond,
      this.vTransA * 1000.0 as MetersPerSecond,
      0.0 as MetersPerSecond,
      durationRate,
    );
    const mB = new Thrust(
      epoch.roll(this.tTrans),
      0.0 as MetersPerSecond,
      this.vTransB * 1000.0 as MetersPerSecond,
      0.0 as MetersPerSecond,
      durationRate,
    );

    return [mA, mB];
  }
}
