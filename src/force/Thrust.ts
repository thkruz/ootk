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

import { EpochUTC, J2000, Kilometers, KilometersPerSecond, MetersPerSecond, RIC, Seconds, SecondsPerMeterPerSecond, Vector3D } from '../main.js';
import { Force } from './Force.js';

// / Thrust force model.
export class Thrust implements Force {
  constructor(
    public center: EpochUTC,
    public radial: MetersPerSecond,
    public intrack: MetersPerSecond,
    public crosstrack: MetersPerSecond,
    public durationRate = 0.0 as SecondsPerMeterPerSecond,
  ) {
    this.deltaV = new Vector3D<KilometersPerSecond>(
      radial * 1e-3 as KilometersPerSecond,
      intrack * 1e-3 as KilometersPerSecond,
      crosstrack * 1e-3 as KilometersPerSecond,
    );
  }

  deltaV: Vector3D<KilometersPerSecond>;

  get magnitude(): MetersPerSecond {
    return this.deltaV.magnitude() * 1000.0 as MetersPerSecond;
  }

  get duration(): Seconds {
    return this.magnitude * this.durationRate as Seconds;
  }

  get start(): EpochUTC {
    return this.center.roll(-0.5 * this.duration as Seconds);
  }

  get stop(): EpochUTC {
    return this.center.roll(0.5 * this.duration as Seconds);
  }

  acceleration(state: J2000): Vector3D {
    const relative = new RIC(
      Vector3D.origin as Vector3D<Kilometers>,
      this.deltaV.scale(1.0 / this.duration as KilometersPerSecond),
    );

    return relative.toJ2000(state).velocity.subtract(state.velocity);
  }

  apply(state: J2000): J2000 {
    const relative = new RIC(Vector3D.origin as Vector3D<Kilometers>, this.deltaV);

    return relative.toJ2000(state);
  }

  get isImpulsive(): boolean {
    return this.duration <= 0;
  }
}
