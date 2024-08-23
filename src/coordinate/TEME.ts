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

import { Earth } from '../body/Earth.js';
import { Kilometers, KilometersPerSecond, Radians, Vector3D } from '../main.js';
import type { ClassicalElements } from './ClassicalElements.js';
import { J2000 } from './J2000.js';
import { StateVector } from './StateVector.js';

/**
 * True Equator Mean Equinox (TEME) is a coordinate system commonly used in satellite tracking and orbit prediction. It
 * is a reference frame that defines the position and orientation of an object relative to the Earth's equator and
 * equinox.
 *
 * By using the True Equator Mean Equinox (TEME) coordinate system, we can accurately describe the position and motion
 * of satellites relative to the Earth's equator and equinox. This is particularly useful for tracking and predicting
 * satellite orbits in various applications, such as satellite communication, navigation, and remote sensing.
 */
export class TEME extends StateVector {
  /**
   * Gets the name of the coordinate system.
   * @returns The name of the coordinate system.
   */
  get name(): string {
    return 'TEME';
  }

  /**
   * Gets a value indicating whether the coordinate is inertial.
   * @returns A boolean value indicating whether the coordinate is inertial.
   */
  get inertial(): boolean {
    return true;
  }

  /**
   * Creates a TEME (True Equator Mean Equinox) object from classical orbital elements.
   * @param elements - The classical orbital elements.
   * @returns A new TEME object.
   */
  static fromClassicalElements(elements: ClassicalElements): TEME {
    const rv = elements.toPositionVelocity();

    return new TEME(elements.epoch, rv.position, rv.velocity);
  }

  /**
   * Converts the TEME (True Equator Mean Equinox) coordinates to J2000 coordinates.
   * @returns The J2000 coordinates.
   */
  toJ2000(): J2000 {
    const p = Earth.precession(this.epoch);
    const n = Earth.nutation(this.epoch);
    const eps = n.mEps + n.dEps;
    const dPsiCosEps = n.dPsi * Math.cos(eps);
    const rMOD = this.position
      .rotZ(-dPsiCosEps as Radians)
      .rotX(eps)
      .rotZ(n.dPsi)
      .rotX(-n.mEps);
    const vMOD = this.velocity
      .rotZ(-dPsiCosEps as Radians)
      .rotX(eps)
      .rotZ(n.dPsi)
      .rotX(-n.mEps);
    const rJ2K = rMOD
      .rotZ(p.zed)
      .rotY(-p.theta as Radians)
      .rotZ(p.zeta) as Vector3D<Kilometers>;
    const vJ2K = vMOD
      .rotZ(p.zed)
      .rotY(-p.theta as Radians)
      .rotZ(p.zeta) as Vector3D<KilometersPerSecond>;

    return new J2000(this.epoch, rJ2K, vJ2K);
  }
}
