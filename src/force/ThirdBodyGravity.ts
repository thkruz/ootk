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

import { J2000 } from '../coordinate/J2000';
import { Vector3D } from '../operations/Vector3D';
import { Moon, MoonBody } from '../body/MoonBody';
import { Sun, SunBody } from '../body/SunBody';
import { Force } from './Force';

// / Third-body gravity model.
export class ThirdBodyGravity implements Force {
  // / Create a new [ThirdBodyGravity] object with the selected bodies enabled.
  constructor(public moon: boolean = false, public sun: boolean = false) {
    // Nothing to do here.
  }

  private static moonGravity_(state: J2000): Vector3D {
    const rMoon = Moon.eci(state.epoch.toDateTime());
    const aNum = rMoon.subtract(state.position);
    const aDen = aNum.magnitude() ** 3;
    const bNum = rMoon;
    const bDen = rMoon.magnitude() ** 3;
    const gravity = aNum.scale(1 / aDen).add(bNum.scale(-1 / bDen));

    return gravity.scale(MoonBody.MU);
  }

  private static sunGravity_(state: J2000): Vector3D {
    const rSun = Sun.eciApparent(state.epoch.toDateTime());
    const aNum = rSun.subtract(state.position);
    const aDen = aNum.magnitude() ** 3;
    const bNum = rSun;
    const bDen = rSun.magnitude() ** 3;
    const gravity = aNum.scale(1 / aDen).add(bNum.scale(-1 / bDen));

    return gravity.scale(SunBody.MU);
  }

  acceleration(state: J2000): Vector3D {
    let accVec = Vector3D.origin;

    if (this.moon) {
      accVec = accVec.add(ThirdBodyGravity.moonGravity_(state));
    }
    if (this.sun) {
      accVec = accVec.add(ThirdBodyGravity.sunGravity_(state));
    }

    return accVec;
  }
}
