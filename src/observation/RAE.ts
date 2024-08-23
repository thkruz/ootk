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

/* eslint-disable no-undefined */
import { ITRF } from '../coordinate/ITRF.js';
import { J2000 } from '../coordinate/J2000.js';
import { AngularDistanceMethod } from '../enums/AngularDistanceMethod.js';
import { Degrees, Kilometers, KilometersPerSecond, Radians } from '../main.js';
import { Vector3D } from '../operations/Vector3D.js';
import { EpochUTC } from '../time/EpochUTC.js';
import { DEG2RAD, halfPi, RAD2DEG, TAU } from '../utils/constants.js';
import { angularDistance } from '../utils/functions.js';

// / Range, azimuth, and elevation.
export class RAE {
  constructor(
    public epoch: EpochUTC,
    public rng: Kilometers,
    public azRad: Radians,
    public elRad: Radians,
    /** The range rate of the satellite relative to the observer in kilometers per second. */
    public rngRate?: number,
    /** The azimuth rate of the satellite relative to the observer in radians per second. */
    public azRateRad?: number,
    /** The elevation rate of the satellite relative to the observer in radians per second. */
    public elRateRad?: number,
  ) {
    // Do nothing
  }

  // / Create a new [Razel] object, using degrees for the angular values.
  static fromDegrees(
    epoch: EpochUTC,
    range: Kilometers,
    azimuth: Degrees,
    elevation: Degrees,
    rangeRate?: number,
    azimuthRate?: number,
    elevationRate?: number,
  ): RAE {
    const azimuthRateRad = azimuthRate ? azimuthRate * DEG2RAD : undefined;
    const elevationRateRad = elevationRate ? elevationRate * DEG2RAD : undefined;

    return new RAE(
      epoch,
      range,
      (azimuth * DEG2RAD) as Radians,
      (elevation * DEG2RAD) as Radians,
      rangeRate,
      azimuthRateRad,
      elevationRateRad,
    );
  }

  /**
   * Create a [Razel] object from an inertial [state] and [site] vector.
   * @param state The inertial [state] vector.
   * @param site The observer [site] vector.
   * @returns A new [Razel] object.
   */
  static fromStateVector(state: J2000, site: J2000): RAE {
    const stateEcef = state.toITRF();
    const siteEcef = site.toITRF();
    const po2 = halfPi;
    const r = stateEcef.position.subtract(siteEcef.position);
    const rDot = stateEcef.velocity;
    const geo = siteEcef.toGeodetic();
    const p = r.rotZ(geo.lon).rotY((po2 - geo.lat) as Radians);
    const pDot = rDot.rotZ(geo.lon).rotY((po2 - geo.lat) as Radians);
    const pS = p.x;
    const pE = p.y;
    const pZ = p.z;
    const pSDot = pDot.x;
    const pEDot = pDot.y;
    const pZDot = pDot.z;
    const pMag = p.magnitude();
    const pSEMag = Math.sqrt(pS * pS + pE * pE);
    const elevation = Math.asin(pZ / pMag);
    let azimuth;

    if (elevation !== po2) {
      azimuth = Math.atan2(-pE, pS) + Math.PI;
    } else {
      azimuth = Math.atan2(-pEDot, pSDot) + Math.PI;
    }
    const rangeRate = p.dot(pDot) / pMag;
    const azimuthRate = (pSDot * pE - pEDot * pS) / (pS * pS + pE * pE);
    const elevationRate = (pZDot - rangeRate * Math.sin(elevation)) / pSEMag;

    return new RAE(
      state.epoch,
      pMag,
      (azimuth % TAU) as Radians,
      elevation as Radians,
      rangeRate,
      azimuthRate,
      elevationRate,
    );
  }

  /**
   * Gets the azimuth in degrees.
   * @returns The azimuth in degrees.
   */
  get az(): Degrees {
    return this.azRad * RAD2DEG as Degrees;
  }

  /**
   * Gets the elevation angle in degrees.
   * @returns The elevation angle in degrees.
   */
  get el(): Degrees {
    return this.elRad * RAD2DEG as Degrees;
  }

  /**
   * Gets the azimuth rate in degrees per second.
   * @returns The azimuth rate in degrees per second, or undefined if it is not available.
   */
  get azRate(): number | undefined {
    return this.azRateRad ? this.azRateRad * RAD2DEG : undefined;
  }

  /**
   * Gets the elevation rate in degrees per second.
   * @returns The elevation rate in degrees per second, or undefined if the elevation rate is not set.
   */
  get elRate(): number | undefined {
    return this.elRateRad ? this.elRateRad * RAD2DEG : undefined;
  }

  toString(): string {
    return [
      '[RazEl]',
      `  Epoch:     ${this.epoch}`,
      `  Azimuth:   ${this.az.toFixed(4)}°`,
      `  Elevation: ${this.el.toFixed(4)}°`,
      `  Range:     ${this.rng.toFixed(3)} km`,
    ].join('\n');
  }

  /**
   * Return the position relative to the observer [site].
   *
   * An optional azimuth [az] _(rad)_ and elevation [el] _(rad)_ value can be
   * passed to override the values contained in this observation.
   * @param site The observer [site].
   * @param azRad Azimuth _(rad)_.
   * @param elRad Elevation _(rad)_.
   * @returns A [Vector3D] object.
   */
  position(site: J2000, azRad?: Radians, elRad?: Radians): Vector3D<Kilometers> {
    const ecef = site.toITRF();
    const geo = ecef.toGeodetic();
    const po2 = halfPi;
    const newAz = azRad ?? this.azRad;
    const newEl = elRad ?? this.elRad;
    const sAz = Math.sin(newAz);
    const cAz = Math.cos(newAz);
    const sEl = Math.sin(newEl);
    const cEl = Math.cos(newEl);
    const pSez = new Vector3D<Kilometers>(
      (-this.rng * cEl * cAz) as Kilometers,
      (this.rng * cEl * sAz) as Kilometers,
      (this.rng * sEl) as Kilometers,
    );
    const rEcef = pSez
      .rotY(-(po2 - geo.lat) as Radians)
      .rotZ(-geo.lon as Radians)
      .add(ecef.position);

    return new ITRF(this.epoch, rEcef, Vector3D.origin as Vector3D<KilometersPerSecond>).toJ2000().position;
  }

  /**
   * Convert this observation into a [J2000] state vector.
   *
   * This will throw an error if the [rangeRate], [elevationRate], or
   * [azimuthRate] are not defined.
   * @param site The observer [site].
   * @returns A [J2000] state vector.
   */
  toStateVector(site: J2000): J2000 {
    // If the rates are not defined then assume stationary
    this.rngRate ??= 0;
    this.elRateRad ??= 0;
    this.azRateRad ??= 0;

    const ecef = site.toITRF();
    const geo = ecef.toGeodetic();
    const po2 = halfPi;
    const sAz = Math.sin(this.azRad);
    const cAz = Math.cos(this.azRad);
    const sEl = Math.sin(this.elRad);
    const cEl = Math.cos(this.elRad);
    const pSez = new Vector3D<Kilometers>(
      (-this.rng * cEl * cAz) as Kilometers,
      (this.rng * cEl * sAz) as Kilometers,
      (this.rng * sEl) as Kilometers,
    );
    const pDotSez = new Vector3D<Kilometers>(
      (-this.rngRate * cEl * cAz +
        this.rng * sEl * cAz * this.elRateRad +
        this.rng * cEl * sAz * this.azRateRad) as Kilometers,
      (this.rngRate * cEl * sAz -
        this.rng * sEl * sAz * this.elRateRad +
        this.rng * cEl * cAz * this.azRateRad) as Kilometers,
      (this.rngRate * sEl + this.rng * cEl * this.elRateRad) as Kilometers,
    );
    const pEcef = pSez.rotY(-(po2 - geo.lat) as Radians).rotZ(-geo.lon as Radians);
    const pDotEcef = pDotSez
      .rotY(-(po2 - geo.lat) as Radians)
      // TODO: #13 Intermediate unit type is incorrect.
      .rotZ(-geo.lon as Radians) as unknown as Vector3D<KilometersPerSecond>;
    const rEcef = pEcef.add(ecef.position);

    return new ITRF(this.epoch, rEcef, pDotEcef).toJ2000();
  }

  /**
   * Calculate the angular distance _(rad)_ between this and another [Razel]
   * object.
   * @param razel The other [Razel] object.
   * @param method The angular distance method to use.
   * @returns The angular distance _(rad)_.
   */
  angle(razel: RAE, method: AngularDistanceMethod = AngularDistanceMethod.Cosine): number {
    return angularDistance(this.azRad, this.elRad, razel.azRad, razel.elRad, method);
  }

  /**
   * Calculate the angular distance _(°)_ between this and another [Razel]
   * object.
   * @param razel The other [Razel] object.
   * @param method The angular distance method to use.
   * @returns The angular distance _(°)_.
   */
  angleDegrees(razel: RAE, method: AngularDistanceMethod = AngularDistanceMethod.Cosine): number {
    return this.angle(razel, method) * RAD2DEG;
  }
}
