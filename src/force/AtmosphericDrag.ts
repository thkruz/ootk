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

import { DEG2RAD } from '../utils/constants';
import { DataHandler } from '../data/DataHandler';
import { Earth } from '../body/Earth';
import { ITRF } from '../coordinate/ITRF';
import { J2000 } from '../coordinate/J2000';
import { Kilometers, KilometersPerSecond, Radians } from '../types/types';
import { Vector3D } from '../operations/Vector3D';
import { Sun } from '../body/SunBody';
import { Force } from './Force';

/**
 * Harris-Priester atmospheric drag force model.
 *
 * The F10.7 solar radio flux index can be provided to scale atmospheric
 * density based on solar activity. Typical values:
 * - Solar minimum: ~70 SFU
 * - Mean solar activity: ~150 SFU (default)
 * - Solar maximum: ~250 SFU
 *
 * F10.7 data is available from:
 * - CelesTrak: https://celestrak.org/SpaceData/
 * - NOAA SWPC: https://www.swpc.noaa.gov/
 */
export class AtmosphericDrag implements Force {
  mass: number;
  area: number;
  dragCoeff: number;
  cosine: number;
  /** F10.7 solar radio flux index in solar flux units (SFU). */
  f107: number;

  /**
   * Creates an atmospheric drag force model.
   * @param mass Spacecraft mass in kg.
   * @param area Cross-sectional area in m².
   * @param dragCoeff Drag coefficient (typically 2.0-2.5).
   * @param cosine Cosine exponent for HP model (typically 2-6).
   * @param f107 F10.7 solar radio flux in SFU (default: 150 for mean solar activity).
   */
  constructor(mass: number, area: number, dragCoeff: number, cosine: number, f107 = 150) {
    this.mass = mass;
    this.area = area;
    this.dragCoeff = dragCoeff;
    this.cosine = cosine;
    this.f107 = f107;
  }

  private static _getHPDensity(state: ITRF, n: number, f107: number): number {
    const hpa = DataHandler.getInstance().getHpAtmosphere(state.height);

    if (hpa === null) {
      return 0.0;
    }
    const sunPos = Sun.eciApparent(state.epoch.toDateTime());
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
    const rhoMax = max0 * (max1 / max0) ** dH;

    // Scale density based on F10.7 solar activity
    // solarScale: 0 at solar minimum (F10.7=70), 1 at solar maximum (F10.7=250)
    const solarScale = Math.max(0, Math.min(1, (f107 - 70) / 180));

    // Combine solar activity scaling with diurnal variation (cosPow)
    return rhoMin + (rhoMax - rhoMin) * solarScale * cosPow;
  }

  acceleration(state: J2000): Vector3D {
    const itrfState = state.toITRF();
    const density = AtmosphericDrag._getHPDensity(itrfState, this.cosine, this.f107);

    if (density === 0) {
      return Vector3D.origin;
    }
    const rotation = new ITRF(
      state.epoch,
      Earth.rotation as unknown as Vector3D<Kilometers>,
      Vector3D.origin as Vector3D<KilometersPerSecond>,
    ).toJ2000().position;
    const vRel = state.velocity.subtract(rotation.cross(state.position) as unknown as Vector3D<KilometersPerSecond>)
      .scale(1000.0 as KilometersPerSecond);
    const vm = vRel.magnitude();
    const fScale = -0.5 * density * ((this.dragCoeff * this.area) / this.mass) * vm;

    return vRel.scale(fScale / 1000.0);
  }
}
