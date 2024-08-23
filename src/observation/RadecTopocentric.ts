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
 * Represents a topocentric right ascension and declination observation.
 *
 * Topocentric coordinates take into account the observer's exact location on the Earth's surface. This model is crucial
 * for precise measurements of local astronomical events and nearby celestial objects, where the observer's latitude,
 * longitude, and altitude can significantly affect the observed position due to parallax. Topocentric coordinates are
 * particularly important for observations of the Moon, planets, and artificial satellites.
 */
export class RadecTopocentric {
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
   * Create a new RadecTopocentric object, using degrees for the angular values.
   * @param epoch UTC epoch.
   * @param rightAscensionDegrees Right-ascension in degrees.
   * @param declinationDegrees Declination in degrees.
   * @param range Range in km.
   * @param rightAscensionRateDegrees Right-ascension rate in degrees per second.
   * @param declinationRateDegrees Declination rate in degrees per second.
   * @param rangeRate Range rate in km/s.
   * @returns A new RadecTopocentric object.
   */
  static fromDegrees(
    epoch: EpochUTC,
    rightAscensionDegrees: Degrees,
    declinationDegrees: Degrees,
    range?: Kilometers,
    rightAscensionRateDegrees?: DegreesPerSecond,
    declinationRateDegrees?: DegreesPerSecond,
    rangeRate?: KilometersPerSecond,
  ): RadecTopocentric {
    const rightAscensionRate = rightAscensionRateDegrees
      ? rightAscensionRateDegrees * DEG2RAD as RadiansPerSecond
      : null;
    const declinationRate = declinationRateDegrees
      ? declinationRateDegrees * DEG2RAD as RadiansPerSecond
      : null;

    return new RadecTopocentric(
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
   * Create a new RadecTopocentric object from a J2000 state vector.
   * @param state Inertial state vector.
   * @param site Site vector.
   * @returns A new RadecTopocentric object.
   */
  static fromStateVector(state: J2000, site: J2000): RadecTopocentric {
    const p = state.position.subtract(site.position);
    const pI = p.x;
    const pJ = p.y;
    const pK = p.z;
    const pMag = p.magnitude();
    const declination = Math.asin(pK / pMag);
    const pDot = state.velocity.subtract(site.velocity);
    const pIDot = pDot.x;
    const pJDot = pDot.y;
    const pKDot = pDot.z;
    const pIJMag = Math.sqrt(pI * pI + pJ * pJ);
    let rightAscension;

    if (pIJMag !== 0) {
      rightAscension = Math.atan2(pJ, pI);
    } else {
      rightAscension = Math.atan2(pJDot, pIDot);
    }
    const rangeRate = p.dot(pDot) / pMag;
    const rightAscensionRate = (pIDot * pJ - pJDot * pI) / (-(pJ * pJ) - pI * pI);
    const declinationRate = (pKDot - rangeRate * Math.sin(declination)) / pIJMag;

    return new RadecTopocentric(
      state.epoch,
      rightAscension % TAU as Radians,
      declination as Radians,
      pMag,
      rightAscensionRate as RadiansPerSecond,
      declinationRate as RadiansPerSecond,
      rangeRate as KilometersPerSecond,
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
    return this.rightAscensionRate
      ? this.rightAscensionRate * RAD2DEG as DegreesPerSecond
      : null;
  }

  /**
   * Gets the rate of change of declination in degrees per second.
   * @returns The rate of change of declination in degrees per second, or null if the declination rate is not defined.
   */
  get declinationRateDegrees(): DegreesPerSecond | null {
    return this.declinationRate
      ? this.declinationRate * RAD2DEG as DegreesPerSecond
      : null;
  }

  /**
   * Return the position relative to the observer site.
   *
   * An optional range value can be passed to override the value contained in this observation.
   * @param site Observer site.
   * @param range Range in km.
   * @returns A Vector3D object.
   */
  position(site: J2000, range?: Kilometers): Vector3D<Kilometers> {
    const r = range ?? this.range ?? 1.0 as Kilometers;

    return radecToPosition(this.rightAscension, this.declination, r).add(site.position);
  }

  /**
   * Return the velocity relative to the observer site.
   *
   * An optional range and rangeRate value can be passed to override the values contained in this observation.
   * @param site Observer site.
   * @param range Range in km.
   * @param rangeRate Range rate in km/s.
   * @returns A Vector3D object.
   */
  velocity(site: J2000, range?: Kilometers, rangeRate?: KilometersPerSecond): Vector3D<KilometersPerSecond> {
    if (!this.rightAscensionRate || !this.declinationRate) {
      throw new Error('Velocity unsolvable, missing ra/dec rates.');
    }
    const r = range ?? this.range ?? 1.0 as Kilometers;
    const rd = rangeRate ?? this.rangeRate ?? 0.0 as KilometersPerSecond;

    return radecToVelocity(
      this.rightAscension,
      this.declination,
      r,
      this.rightAscensionRate,
      this.declinationRate,
      rd,
    ).add(site.velocity);
  }

  /**
   * Calculates the line of sight vector in the topocentric coordinate system.
   * The line of sight vector points from the observer's location towards the celestial object.
   * @returns The line of sight vector as a Vector3D object.
   */
  lineOfSight(): Vector3D {
    const ca = Math.cos(this.rightAscension);
    const cd = Math.cos(this.declination);
    const sa = Math.sin(this.rightAscension);
    const sd = Math.sin(this.declination);

    return new Vector3D(cd * ca, cd * sa, sd);
  }

  /**
   * Calculate the angular distance between this and another RadecTopocentric object.
   * @param radec - The other RadecTopocentric object.
   * @param method - The angular distance method to use.
   * @returns The angular distance.
   */
  angle(radec: RadecTopocentric, method: AngularDistanceMethod = AngularDistanceMethod.Cosine): Radians {
    return angularDistance(this.rightAscension, this.declination, radec.rightAscension, radec.declination, method);
  }

  /**
   * Calculate the angular distance between this and another RadecTopocentric object.
   * @param radec - The other RadecTopocentric object.
   * @param method - The angular distance method to use.
   * @returns The angular distance
   */
  angleDegrees(radec: RadecTopocentric, method: AngularDistanceMethod = AngularDistanceMethod.Cosine): Degrees {
    return this.angle(radec, method) * RAD2DEG as Degrees;
  }
}
