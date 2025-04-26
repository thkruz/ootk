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

import { Earth, EpochUTC, J2000, Kilometers, KilometersPerSecond, Vector3D } from '../main.js';

/**
 * Herrik-Gibbs 3-position initial orbit determination.
 *
 * Possibly better than regular Gibbs IOD for closely spaced position
 * vectors (less than 5°).
 */
export class HerrickGibbsIOD {
  /**
   * Create a new [HerrickGibbsIOD] object with optional
   * gravitational parameter [mu].
   * @param mu Gravitational parameter (default: Earth.mu)
   */
  constructor(public mu: number = Earth.mu) {
    // Nothing to do here.
  }

  // / Attempt to create a state estimate from three inertial position vectors.
  solve(r1: Vector3D, t1: EpochUTC, r2: Vector3D<Kilometers>, t2: EpochUTC, r3: Vector3D, t3: EpochUTC): J2000 {
    const dt31 = t3.difference(t1);
    const dt32 = t3.difference(t2);
    const dt21 = t2.difference(t1);
    const r1m = r1.magnitude();
    const r2m = r2.magnitude();
    const r3m = r3.magnitude();
    const vA = r1.scale(-dt32 * (1.0 / (dt21 * dt31) + this.mu / (12.0 * r1m * r1m * r1m)));
    const vB = r2.scale((dt32 - dt21) * (1.0 / (dt21 * dt32) + this.mu / (12.0 * r2m * r2m * r2m)));
    const vC = r3.scale(dt21 * (1.0 / (dt32 * dt31) + this.mu / (12.0 * r3m * r3m * r3m)));
    const v2 = vA.add(vB).add(vC) as Vector3D<KilometersPerSecond>;

    return new J2000(t2, r2, v2);
  }
}
