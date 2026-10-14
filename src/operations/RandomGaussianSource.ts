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

import { Vector } from './Vector';
import { Vector3D } from './Vector3D';
import { BoxMuller } from './BoxMuller';

/** Source of standard normal (mean 0, standard deviation 1) random numbers. */
export class RandomGaussianSource {
  private readonly boxMuller_: BoxMuller;

  /**
   * Create a new Gaussian source.
   * @param seed Random seed for the underlying uniform generator.
   */
  constructor(seed = 0) {
    this.boxMuller_ = new BoxMuller(0, 1, seed);
  }

  /**
   * Draw one standard normal number.
   * @returns A standard normal variate.
   */
  nextGauss(): number {
    return this.boxMuller_.nextGauss();
  }

  /**
   * Draw a vector of n independent standard normal numbers.
   * @param n Vector length; must be at least 1.
   * @returns A Vector of length n.
   */
  gaussVector(n: number): Vector {
    if (n < 1) {
      throw new Error('n must be greater than 0');
    }

    const result: number[] = [];

    for (let i = 0; i < n; i++) {
      result.push(this.nextGauss());
    }

    return new Vector(result);
  }

  /**
   * Draw a point uniformly distributed on a sphere by normalizing a 3-element
   * standard normal vector (Muller, 1959, "A note on a method for generating
   * points uniformly on n-dimensional spheres").
   * @param radius Sphere radius. Default is 1.
   * @returns A Vector3D of magnitude radius.
   */
  gaussSphere(radius = 1.0): Vector3D {
    return this.gaussVector(3).toVector3D(0).normalize().scale(radius);
  }
}
