/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
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

import { Vector, Vector3D } from '../main.js';
import { BoxMuller } from './BoxMuller.js';

export class RandomGaussianSource {
  private readonly boxMuller_: BoxMuller;

  constructor(seed = 0) {
    this.boxMuller_ = new BoxMuller(0, 1, seed);
  }

  nextGauss(): number {
    return this.boxMuller_.nextGauss();
  }

  gaussVector(n: number): Vector {
    if (n < 1) {
      throw new Error('n must be greater than 0');
    }

    const result = new Vector([this.nextGauss()]);

    for (let i = 0; i < n; i++) {
      if (i > 0) {
        result.add(new Vector([this.nextGauss()]));
      }
    }

    return result;
  }

  gaussSphere(radius = 1.0): Vector3D {
    return this.gaussVector(3).toVector3D(0).normalize().scale(radius);
  }
}
