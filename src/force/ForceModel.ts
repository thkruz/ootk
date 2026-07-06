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

  setGravity(mu: number = Earth.mu): this {
    this.centralGravity_ = new Gravity(mu);

    return this;
  }

  setEarthGravity(degree: number, order: number): void {
    this.centralGravity_ = new EarthGravity(degree, order);
  }

  setThirdBodyGravity({ moon = false, sun = false }): void {
    this.thirdBodyGravity_ = new ThirdBodyGravity(moon, sun);
  }

  setSolarRadiationPressure(mass: number, area: number, coeff = 1.2): void {
    this.solarRadiationPressure_ = new SolarRadiationPressure(mass, area, coeff);
  }

  /**
   * Sets the atmospheric drag for the force model.
   * @deprecated This is still a work in progress!
   * @param mass - The mass of the object.
   * @param area - The cross-sectional area of the object.
   * @param coeff - The drag coefficient. Default value is 2.2.
   * @param cosine - The cosine of the angle between the object's velocity vector and the drag force vector.
   */
  setAtmosphericDrag(mass: number, area: number, coeff = 2.2, cosine = 4): void {
    this.atmosphericDrag_ = new AtmosphericDrag(mass, area, coeff, cosine);
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
