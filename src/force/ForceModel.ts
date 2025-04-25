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

import { Earth, J2000, Vector, Vector3D } from '../main.js';
import { AtmosphericDrag } from './AtmosphericDrag.js';
import { EarthGravity } from './EarthGravity.js';
import { Force } from './Force.js';
import { Gravity } from './Gravity.js';
import { SolarRadiationPressure } from './SolarRadiationPressure.js';
import { ThirdBodyGravity } from './ThirdBodyGravity.js';
import { Thrust } from './Thrust.js';

// / Force model for spacecraft propagation.

export class ForceModel {
  private _centralGravity?: Force;
  private _thirdBodyGravity?: Force;
  private _solarRadiationPressure?: Force;
  private _atmosphericDrag?: Force;
  private _maneuverThrust: Force | null = null;

  setGravity(mu: number = Earth.mu): this {
    this._centralGravity = new Gravity(mu);

    return this;
  }

  setEarthGravity(degree: number, order: number): void {
    this._centralGravity = new EarthGravity(degree, order);
  }

  setThirdBodyGravity({ moon = false, sun = false }): void {
    this._thirdBodyGravity = new ThirdBodyGravity(moon, sun);
  }

  setSolarRadiationPressure(mass: number, area: number, coeff = 1.2): void {
    this._solarRadiationPressure = new SolarRadiationPressure(mass, area, coeff);
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
    this._atmosphericDrag = new AtmosphericDrag(mass, area, coeff, cosine);
  }

  loadManeuver(maneuver: Thrust): void {
    this._maneuverThrust = maneuver;
  }

  clearManeuver(): void {
    this._maneuverThrust = null;
  }

  acceleration(state: J2000): Vector3D {
    let accVec = Vector3D.origin;

    if (this._centralGravity) {
      accVec = accVec.add(this._centralGravity.acceleration(state));
    }
    if (this._thirdBodyGravity) {
      accVec = accVec.add(this._thirdBodyGravity.acceleration(state));
    }
    if (this._solarRadiationPressure) {
      accVec = accVec.add(this._solarRadiationPressure.acceleration(state));
    }
    if (this._atmosphericDrag) {
      accVec = accVec.add(this._atmosphericDrag.acceleration(state));
    }
    if (this._maneuverThrust) {
      accVec = accVec.add(this._maneuverThrust.acceleration(state));
    }

    return accVec;
  }

  derivative(state: J2000): Vector {
    return state.velocity.join(this.acceleration(state));
  }
}
