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

import { astronomicalUnit, J2000, Sun, Vector3D } from '../main.js';
import { Force } from './Force.js';

// / Solar radiation pressure model.
export class SolarRadiationPressure extends Force {
  // / Create a new [SolarRadiationPressure] object.
  constructor(public mass: number, public area: number, public reflectCoeff: number) {
    super();
  }

  // / Solar pressure _(N/m²)_;
  private static readonly _kRef: number = 4.56e-6 * astronomicalUnit ** 2;

  acceleration(state: J2000): Vector3D {
    const rSun = Sun.positionApparent(state.epoch);
    const r = state.position.subtract(rSun);
    const rMag = r.magnitude();
    const r2 = rMag * rMag;
    const ratio = Sun.lightingRatio(state.position, rSun);
    const p = (ratio * SolarRadiationPressure._kRef) / r2;
    const flux = r.scale(p / rMag);

    return flux.scale(((this.area * this.reflectCoeff) / this.mass) * 1e-3);
  }
}
