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

import { Earth, J2000, Vector3D } from '../main.js';
import { Force } from './Force.js';

// / Simple central-body gravity model.
export class Gravity implements Force {
  // / Gravitational parameter _(km²/s³)_.
  mu: number;

  /**
   * Create a new [Gravity] object with optional gravitational
   * @param mu Gravitational parameter _(km²/s³)_.
   */
  constructor(mu: number = Earth.mu) {
    this.mu = mu;
  }

  /**
   * Calculates the gravitational force in spherical coordinates.
   * @param state The J2000 state containing the position and velocity vectors.
   * @returns The gravitational force vector in spherical coordinates.
   */
  private _spherical(state: J2000): Vector3D {
    const rMag = state.position.magnitude();

    return state.position.scale(-this.mu / (rMag * rMag * rMag));
  }

  /**
   * Calculates the acceleration due to gravity at a given state.
   * @param state The J2000 state at which to calculate the acceleration.
   * @returns The acceleration vector.
   */
  acceleration(state: J2000): Vector3D {
    return this._spherical(state);
  }
}
