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

import { Earth } from '../body/Earth';
import { J2000 } from '../coordinate/J2000';
import { Vector } from '../operations/Vector';
import { Vector3D } from '../operations/Vector3D';
import { AtmosphericDrag } from './AtmosphericDrag';
import { EarthGravity } from './EarthGravity';
import { Force } from './Force';
import { Gravity } from './Gravity';
import { SolarRadiationPressure } from './SolarRadiationPressure';
import { ThirdBodyGravity } from './ThirdBodyGravity';
import { Thrust } from './Thrust';

// / Force model for spacecraft propagation.

export class ForceModel {
  private centralGravity_?: Force;
  private thirdBodyGravity_?: Force;
  private solarRadiationPressure_?: Force;
  private atmosphericDrag_?: Force;
  private maneuverThrust_: Force | null = null;

  /**
   * Use point-mass central gravity.
   * @param mu Gravitational parameter in km^3/s^2 (default Earth.mu).
   * @returns This force model, for chaining.
   */
  setGravity(mu: number = Earth.mu): this {
    this.centralGravity_ = new Gravity(mu);

    return this;
  }

  /**
   * Use the EGM96 spherical-harmonic Earth gravity field.
   * @param degree Maximum degree.
   * @param order Maximum order.
   * @returns This force model, for chaining.
   */
  setEarthGravity(degree: number, order: number): this {
    this.centralGravity_ = new EarthGravity(degree, order);

    return this;
  }

  /**
   * Add third-body point-mass gravity from the Moon and/or the Sun.
   * @param bodies Which bodies to include.
   * @param bodies.moon Include the Moon.
   * @param bodies.sun Include the Sun.
   * @returns This force model, for chaining.
   */
  setThirdBodyGravity({ moon = false, sun = false }): this {
    this.thirdBodyGravity_ = new ThirdBodyGravity(moon, sun);

    return this;
  }

  /**
   * Add solar radiation pressure.
   * @param mass Spacecraft mass in kg.
   * @param area Sun-facing area in m^2.
   * @param coeff Reflectivity coefficient (default 1.2).
   * @returns This force model, for chaining.
   */
  setSolarRadiationPressure(mass: number, area: number, coeff = 1.2): this {
    this.solarRadiationPressure_ = new SolarRadiationPressure(mass, area, coeff);

    return this;
  }

  /**
   * Add Harris-Priester atmospheric drag.
   * @deprecated This is still a work in progress!
   * @param mass Spacecraft mass in kg.
   * @param area Cross-sectional area in m^2.
   * @param coeff Drag coefficient (default 2.2).
   * @param cosine Harris-Priester cosine exponent n in cos^n(psi / 2), not an angle cosine
   * (default 4; Montenbruck and Gill suggest 2 for low inclination, 6 for polar orbits).
   * @param f107 F10.7 solar radio flux in SFU (default 150, the mean-activity HP table).
   * @returns This force model, for chaining.
   */
  setAtmosphericDrag(mass: number, area: number, coeff = 2.2, cosine = 4, f107 = 150): this {
    this.atmosphericDrag_ = new AtmosphericDrag(mass, area, coeff, cosine, f107);

    return this;
  }

  loadManeuver(maneuver: Thrust): void {
    this.maneuverThrust_ = maneuver;
  }

  clearManeuver(): void {
    this.maneuverThrust_ = null;
  }

  acceleration(state: J2000): Vector3D {
    let accVec = Vector3D.origin;

    if (this.centralGravity_) {
      accVec = accVec.add(this.centralGravity_.acceleration(state));
    }
    if (this.thirdBodyGravity_) {
      accVec = accVec.add(this.thirdBodyGravity_.acceleration(state));
    }
    if (this.solarRadiationPressure_) {
      accVec = accVec.add(this.solarRadiationPressure_.acceleration(state));
    }
    if (this.atmosphericDrag_) {
      accVec = accVec.add(this.atmosphericDrag_.acceleration(state));
    }
    if (this.maneuverThrust_) {
      accVec = accVec.add(this.maneuverThrust_.acceleration(state));
    }

    return accVec;
  }

  derivative(state: J2000): Vector {
    return state.velocity.join(this.acceleration(state));
  }
}
