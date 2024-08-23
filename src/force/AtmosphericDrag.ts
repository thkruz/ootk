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

import { DataHandler, DEG2RAD, Earth, ITRF, J2000, Kilometers, KilometersPerSecond, Radians, Sun, Vector3D } from '../main.js';
import { Force } from './Force.js';

/**
 * Harris-Priester atmospheric drag force model.
 * Atmospheric density model assumes mean solar flux.
 */
export class AtmosphericDrag implements Force {
  mass: number;
  area: number;
  dragCoeff: number;
  cosine: number;

  constructor(mass: number, area: number, dragCoeff: number, cosine: number) {
    this.mass = mass;
    this.area = area;
    this.dragCoeff = dragCoeff;
    this.cosine = cosine;
  }

  private static _getHPDensity(state: ITRF, n: number): number {
    const hpa = DataHandler.getInstance().getHpAtmosphere(state.height);

    if (hpa === null) {
      return 0.0;
    }
    const sunPos = Sun.positionApparent(state.epoch);
    const sunVec = new J2000(
      state.epoch,
      sunPos,
      Vector3D.origin as Vector3D<KilometersPerSecond>,
    ).toITRF().position.normalize();
    const bulVec = sunVec.rotZ(-30.0 * DEG2RAD as Radians);
    const cosPsi = bulVec.normalize().dot(state.position.normalize());
    const c2Psi2 = 0.5 * (1.0 + cosPsi);
    const cPsi2 = Math.sqrt(c2Psi2);
    const cosPow = cPsi2 > 1e-12 ? c2Psi2 * cPsi2 ** (n - 2) : 0.0;
    const altitude = hpa.height;
    const [h0, min0, max0] = hpa.hp0;
    const [h1, min1, max1] = hpa.hp1;
    const dH = (h0 - altitude) / (h0 - h1);
    const rhoMin = min0 * (min1 / min0) ** dH;

    if (cosPow === 0) {
      return rhoMin;
    }
    const rhoMax = max0 * (max1 / max0) ** dH;

    return rhoMin + (rhoMax - rhoMin) * cosPow;
  }

  acceleration(state: J2000): Vector3D {
    const itrfState = state.toITRF();
    const density = AtmosphericDrag._getHPDensity(itrfState, this.cosine);

    if (density === 0) {
      return Vector3D.origin;
    }
    const rotation = new ITRF(
      state.epoch,
      // TODO: #26 This is a bit of a hack to get Radians/Second to work with StateVector class
      Earth.rotation as unknown as Vector3D<Kilometers>,
      Vector3D.origin as Vector3D<KilometersPerSecond>,
    ).toJ2000().position;
    // TODO: #26 This is a bit of a hack to get Radians/Second to work with StateVector class
    const vRel = state.velocity.subtract(rotation.cross(state.position) as unknown as Vector3D<KilometersPerSecond>)
      .scale(1000.0 as KilometersPerSecond);
    const vm = vRel.magnitude();
    const fScale = -0.5 * density * ((this.dragCoeff * this.area) / this.mass) * vm;

    return vRel.scale(fScale / 1000.0);
  }
}
