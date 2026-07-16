/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2026 Kruczek Labs LLC
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

/**
 * Tsiolkovsky rocket-equation helpers for tracking a satellite's propellant
 * budget across a sequence of impulsive burns.
 *
 * All masses are in kilograms, delta-V in meters per second, and specific
 * impulse in seconds.
 */
export class PropellantBudget {
  /** Standard gravity used by the specific-impulse definition (m/s^2). */
  static readonly g0 = 9.80665;

  /**
   * Mass remaining after an impulsive burn: `m * exp(-dv / (isp * g0))`.
   * @param massKg Total mass before the burn. (kg)
   * @param deltaVMs Delta-V of the burn. (m/s)
   * @param ispS Specific impulse of the propulsion system. (s)
   * @returns Total mass after the burn. (kg)
   */
  static massAfterBurn(massKg: number, deltaVMs: number, ispS: number): number {
    return massKg * Math.exp(-deltaVMs / (ispS * PropellantBudget.g0));
  }

  /**
   * Propellant consumed by an impulsive burn.
   * @param massKg Total mass before the burn. (kg)
   * @param deltaVMs Delta-V of the burn. (m/s)
   * @param ispS Specific impulse of the propulsion system. (s)
   * @returns Propellant mass consumed. (kg)
   */
  static propellantUsed(massKg: number, deltaVMs: number, ispS: number): number {
    return massKg - PropellantBudget.massAfterBurn(massKg, deltaVMs, ispS);
  }

  /**
   * Delta-V available before the propellant is exhausted:
   * `isp * g0 * ln(m / dry)`.
   * @param massKg Current total mass. (kg)
   * @param dryMassKg Dry mass (no propellant). (kg)
   * @param ispS Specific impulse of the propulsion system. (s)
   * @returns Remaining delta-V. (m/s)
   */
  static deltaVRemaining(massKg: number, dryMassKg: number, ispS: number): number {
    return ispS * PropellantBudget.g0 * Math.log(massKg / dryMassKg);
  }
}
