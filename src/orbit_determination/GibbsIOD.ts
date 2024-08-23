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

import { DEG2RAD, Earth, EpochUTC, halfPi, J2000, Kilometers, KilometersPerSecond, Radians, Vector3D } from '../main.js';
import { ForceModel } from './../force/ForceModel.js';
import { RungeKutta89Propagator } from './../propagator/RungeKutta89Propagator.js';

/**
 * Gibbs 3-position inital orbit determination.
 */
export class GibbsIOD {
  constructor(public mu: number = Earth.mu) {
    // Nothing to do here.
  }

  /** Abort solve if position plane exceeds this value. */
  private static readonly coplanarThreshold_: Radians = (5.0 * DEG2RAD) as Radians;

  /**
   * Attempt to create a state estimate from three inertial position vectors.
   *
   * Throws an error if the positions are not coplanar.
   * @param r1 Position vector 1.
   * @param r2 Position vector 2.
   * @param r3 Position vector 3.
   * @param t2 Time of position 2.
   * @param t3 Time of position 3.
   * @returns State estimate at time t2.
   */
  solve(
    r1: Vector3D<Kilometers>,
    r2: Vector3D<Kilometers>,
    r3: Vector3D<Kilometers>,
    t2: EpochUTC,
    t3: EpochUTC,
  ): J2000 {
    const num = r1.normalize().dot(r2.normalize().cross(r3.normalize()));
    const alpha = halfPi - Math.acos(num);

    if (Math.abs(alpha) > GibbsIOD.coplanarThreshold_) {
      throw new Error('Orbits are not coplanar.');
    }

    const r1m = r1.magnitude();
    const r2m = r2.magnitude();
    const r3m = r3.magnitude();

    const d = r1.cross(r2).add(r2.cross(r3).add(r3.cross(r1)));
    const n = r2.cross(r3).scale(r1m).add(r3.cross(r1).scale(r2m)).add(r1.cross(r2).scale(r3m));
    const b = d.cross(r2);
    const s = r1.scale(r2m - r3m).add(r2.scale(r3m - r1m).add(r3.scale(r1m - r2m)));

    const nm = n.magnitude();
    const dm = d.magnitude();

    const vm = Math.sqrt(this.mu / (nm * dm)) as KilometersPerSecond;
    const vlEci = b.scale((vm / r2m) as KilometersPerSecond).add(s.scale(vm));

    const pv = new J2000(t2, r2, vlEci);

    const forceModel = new ForceModel().setGravity(this.mu);
    const orbit = new RungeKutta89Propagator(pv, forceModel);

    const pv2 = new J2000(t2, r2, vlEci.negate());
    const orbit2 = new RungeKutta89Propagator(pv2, forceModel);

    const estP3 = orbit.propagate(t3).position;
    const dist = estP3.subtract(r3).magnitude();
    const estP3b = orbit2.propagate(t3).position;
    const dist2 = estP3b.subtract(r3).magnitude();

    if (dist <= dist2) {
      orbit.reset();

      return orbit.propagate(t2);
    }
    orbit2.reset();

    return orbit2.propagate(t2);
  }
}
