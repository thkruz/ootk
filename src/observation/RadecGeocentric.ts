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

import { J2000 } from '../coordinate/J2000.js';
import { AngularDistanceMethod } from '../enums/AngularDistanceMethod.js';
import { Degrees, DegreesPerSecond, Kilometers, KilometersPerSecond, Radians, RadiansPerSecond } from '../main.js';
import { Vector3D } from '../operations/Vector3D.js';
import { EpochUTC } from '../time/EpochUTC.js';
import { DEG2RAD, RAD2DEG, TAU } from '../utils/constants.js';
import { angularDistance } from '../utils/functions.js';
import { radecToPosition, radecToVelocity } from './ObservationUtils.js';

/**
 * Represents a geocentric right ascension and declination observation.
 *
 * In geocentric coordinates, observations are considered from the Earth's center. This approach simplifies calculations
 * for distant celestial objects, as it assumes a uniform observation point that ignores the observer's specific
 * location on Earth.
 */
export class RadecGeocentric {
  constructor(
    public epoch: EpochUTC,
    public rightAscension: Radians,
    public declination: Radians,
    public range?: Kilometers,
    public rightAscensionRate?: RadiansPerSecond | null,
    public declinationRate?: RadiansPerSecond | null,
    public rangeRate?: KilometersPerSecond | null,
  ) {
    // Nothing to do here.
  }

  /**
   * Creates a RadecGeocentric object from the given parameters in degrees.
   * @param epoch - The epoch in UTC.
   * @param rightAscensionDegrees - The right ascension in degrees.
   * @param declinationDegrees - The declination in degrees.
   * @param range - The range in kilometers (optional).
   * @param rightAscensionRateDegrees - The right ascension rate in degrees per second (optional).
   * @param declinationRateDegrees - The declination rate in degrees per second (optional).
   * @param rangeRate - The range rate in kilometers per second (optional).
   * @returns A new RadecGeocentric object.
   */
  static fromDegrees(
    epoch: EpochUTC,
    rightAscensionDegrees: Degrees,
    declinationDegrees: Degrees,
    range?: Kilometers,
    rightAscensionRateDegrees?: Degrees,
    declinationRateDegrees?: Degrees,
    rangeRate?: KilometersPerSecond,
  ): RadecGeocentric {
    const rightAscensionRate = rightAscensionRateDegrees
      ? rightAscensionRateDegrees * DEG2RAD as RadiansPerSecond
      : null;
    const declinationRate = declinationRateDegrees ? declinationRateDegrees * DEG2RAD as RadiansPerSecond : null;

    return new RadecGeocentric(
      epoch,
      rightAscensionDegrees * DEG2RAD as Radians,
      declinationDegrees * DEG2RAD as Radians,
      range,
      rightAscensionRate,
      declinationRate,
      rangeRate,
    );
  }

  /**
   * Creates a RadecGeocentric object from a state vector in J2000 coordinates.
   * @param state - The J2000 state vector.
   * @returns A new RadecGeocentric object.
   */
  static fromStateVector(state: J2000): RadecGeocentric {
    const rI = state.position.x;
    const rJ = state.position.y;
    const rK = state.position.z;
    const vI = state.velocity.x;
    const vJ = state.velocity.y;
    const vK = state.velocity.z;
    const rMag = state.position.magnitude();
    const declination = Math.asin(rK / rMag);
    const rIJMag = Math.sqrt(rI * rI + rJ * rJ);
    let rightAscension;

    if (rIJMag !== 0) {
      rightAscension = Math.atan2(rJ, rI);
    } else {
      rightAscension = Math.atan2(vJ, vI);
    }
    const rangeRate = state.position.dot(state.velocity) / rMag as KilometersPerSecond;
    const rightAscensionRate = (vI * rJ - vJ * rI) / (-(rJ * rJ) - rI * rI);
    const declinationRate = (vK - rangeRate * (rK / rMag)) / rIJMag;

    return new RadecGeocentric(
      state.epoch,
      rightAscension % TAU as Radians,
      declination as Radians,
      rMag,
      rightAscensionRate as RadiansPerSecond,
      declinationRate as RadiansPerSecond,
      rangeRate,
    );
  }

  /**
   * Gets the right ascension in degrees.
   * @returns The right ascension in degrees.
   */
  get rightAscensionDegrees(): Degrees {
    return this.rightAscension * RAD2DEG as Degrees;
  }

  /**
   * Gets the declination in degrees.
   * @returns The declination in degrees.
   */
  get declinationDegrees(): Degrees {
    return this.declination * RAD2DEG as Degrees;
  }

  /**
   * Gets the right ascension rate in degrees per second.
   * @returns The right ascension rate in degrees per second, or null if it is not available.
   */
  get rightAscensionRateDegrees(): DegreesPerSecond | null {
    return this.rightAscensionRate ? this.rightAscensionRate * RAD2DEG as DegreesPerSecond : null;
  }

  /**
   * Gets the rate of change of declination in degrees per second.
   * @returns The rate of change of declination in degrees per second, or null if not available.
   */
  get declinationRateDegrees(): DegreesPerSecond | null {
    return this.declinationRate ? this.declinationRate * RAD2DEG as DegreesPerSecond : null;
  }

  /**
   * Calculates the position vector in geocentric coordinates.
   * @param range - The range in kilometers (optional). If not provided, it uses the default range or 1.0 kilometer.
   * @returns The position vector in geocentric coordinates.
   */
  position(range?: Kilometers): Vector3D<Kilometers> {
    const r = range ?? this.range ?? 1.0 as Kilometers;

    return radecToPosition(this.rightAscension, this.declination, r);
  }

  /**
   * Calculates the velocity vector of the celestial object.
   * @param range - The range of the celestial object in kilometers. If not provided, it uses the stored range value.
   * @param rangeRate - The range rate of the celestial object in kilometers per second.
   * If not provided, it uses the stored range rate value.
   * @returns The velocity vector of the celestial object in kilometers per second.
   * @throws Error if the right ascension rate or declination rate is missing.
   */
  velocity(range?: Kilometers, rangeRate?: KilometersPerSecond): Vector3D<KilometersPerSecond> {
    if (!this.rightAscensionRate || !this.declinationRate) {
      throw new Error('Velocity unsolvable, missing ra/dec rates.');
    }
    const r = range ?? this.range ?? 1.0 as Kilometers;
    const rd = rangeRate ?? this.rangeRate ?? 0.0 as KilometersPerSecond;

    return radecToVelocity(this.rightAscension, this.declination, r, this.rightAscensionRate, this.declinationRate, rd);
  }

  /**
   * Calculates the angular distance between two celestial coordinates (RA and Dec).
   * @param radec - The celestial coordinates to compare with.
   * @param method - The method to use for calculating the angular distance. Default is `AngularDistanceMethod.Cosine`.
   * @returns The angular distance between the two celestial coordinates in radians.
   */
  angle(radec: RadecGeocentric, method: AngularDistanceMethod = AngularDistanceMethod.Cosine): Radians {
    return angularDistance(this.rightAscension, this.declination, radec.rightAscension, radec.declination, method);
  }

  /**
   * Calculates the angle in degrees between two RadecGeocentric objects.
   * @param radec - The RadecGeocentric object to calculate the angle with.
   * @param method - The method to use for calculating the angular distance. Default is AngularDistanceMethod.Cosine.
   * @returns The angle in degrees.
   */
  angleDegrees(radec: RadecGeocentric, method: AngularDistanceMethod = AngularDistanceMethod.Cosine): Degrees {
    return this.angle(radec, method) * RAD2DEG as Degrees;
  }
}
