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

import { Thrust } from '../force/Thrust.js';
import { Earth, EpochUTC, MetersPerSecond, Seconds, SecondsPerMeterPerSecond } from '../main.js';

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
