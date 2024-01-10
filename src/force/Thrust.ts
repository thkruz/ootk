/**
 * @author @thkruz Theodore Kruczek
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2024 Theodore Kruczek
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

import { EpochUTC, J2000, RIC, Vector3D } from 'ootk-core';
import { Force } from './Force';

// / Thrust force model.
export class Thrust implements Force {
  constructor(
    public center: EpochUTC,
    public radial: number,
    public intrack: number,
    public crosstrack: number,
    public durationRate: number = 0.0,
  ) {
    this.deltaV = new Vector3D(radial * 1e-3, intrack * 1e-3, crosstrack * 1e-3);
  }

  deltaV: Vector3D;

  get magnitude(): number {
    return this.deltaV.magnitude() * 1000.0;
  }

  get duration(): number {
    return this.magnitude * this.durationRate;
  }

  get start(): EpochUTC {
    return this.center.roll(-0.5 * this.duration);
  }

  get stop(): EpochUTC {
    return this.center.roll(0.5 * this.duration);
  }

  acceleration(state: J2000): Vector3D {
    const relative = new RIC(Vector3D.origin, this.deltaV.scale(1.0 / this.duration));

    return relative.toJ2000(state).velocity.subtract(state.velocity);
  }

  apply(state: J2000): J2000 {
    const relative = new RIC(Vector3D.origin, this.deltaV);

    return relative.toJ2000(state);
  }

  get isImpulsive(): boolean {
    return this.duration <= 0;
  }
}
