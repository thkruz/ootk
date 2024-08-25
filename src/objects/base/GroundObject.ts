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

import {

  Geodetic,
  ITRF,
  J2000,
  Vector3D,
  EpochUTC,
  calcGmst,
  lla2eci,
  llaRad2ecf,
  DEG2RAD,
  Degrees,
  EcfVec3, Kilometers,
  KilometersPerSecond,
  LlaVec3,
  Radians,
  RaeVec3,
  Seconds, BaseObjectParams,
  BaseObjectAdv, Earth,
  ecf2rae,
  PosVel,
} from '../../main.js';

export enum AltitudeReference {
  Geocentric = 'Geocentric',
  MSL = 'MSL'
}

export interface GroundObjectParams extends BaseObjectParams {
  lat: Degrees;
  lon: Degrees;
  alt: Kilometers;
  altRef?: AltitudeReference;
}

export abstract class GroundObject extends BaseObjectAdv {
  private lat_: Degrees;
  private lon_: Degrees;
  /** Altitude in kilometers relative to mean sea level. */
  private alt_: Kilometers;

  constructor(params: GroundObjectParams) {
    super(params);

    this.validateFacilityInputData_(params);
    this.lat_ = params.lat;
    this.lon_ = params.lon;
    this.alt_ = params.alt;

    if (params.altRef === AltitudeReference.Geocentric) {
      this.alt_ = this.alt_ - Earth.radiusMean as Kilometers;
    }
  }

  /**
   * Calculates ECF position at a given time.
   * @variation optimized version of this.toGeodetic().toITRF().position;
   * @returns The ECF position vector of the ground object.
   */
  ecf(): EcfVec3<Kilometers> {
    return llaRad2ecf(this.toGeodetic());
  }

  /**
   * Returns the latitude, longitude, and altitude of the GroundObject.
   * @returns The latitude, longitude, and altitude as an LlaVec3 object.
   */
  lla(): LlaVec3<Degrees, Kilometers> {
    return {
      lat: this.lat_,
      lon: this.lon_,
      alt: this.alt_,
    };
  }

  /**
   * Calculates the geocentric altitude of the object.
   * @returns The geocentric altitude, which is the sum of the object's altitude and the mean radius of the Earth.
   */
  altGeocentric(): Kilometers {
    return this.alt_ + Earth.radiusMean as Kilometers;
  }

  /**
   * Calculates the relative azimuth, elevation, and range between this GroundObject and a secondary BaseObjectAdv.
   * @param targetObject The secondary BaseObjectAdv.
   * @returns The relative azimuth, elevation, and range values in kilometers and degrees.
   */
  rae(targetObject: BaseObjectAdv): RaeVec3<Kilometers, Degrees> {
    const rae = ecf2rae(this.lla(), targetObject.ecf(), this.orientation);

    return rae;
  }

  /**
   * Converts the latitude, longitude, and altitude of the Facility to radians and kilometers.
   * @variation optimized version of this.toGeodetic() without class instantiation for better performance and
   * serialization.
   * @returns An object containing the latitude, longitude, and altitude in
   * radians and kilometers.
   */
  llaRad(): LlaVec3<Radians, Kilometers> {
    return {
      lat: (this.lat_ * DEG2RAD) as Radians,
      lon: (this.lon_ * DEG2RAD) as Radians,
      alt: this.alt_,
    };
  }

  /**
   * Calculates the Earth-Centered Inertial (ECI) position vector of the ground object at a given date.
   * @variation optimzed version of this.toGeodetic().toITRF().toJ2000().position;
   * @param date The date for which to calculate the ECI position vector. Defaults to the current date.
   * @returns The ECI position vector of the ground object.
   */
  eci(date: Date = new Date()): PosVel<Kilometers, KilometersPerSecond> {
    const { gmst } = calcGmst(date);
    const pos = lla2eci(this.toGeodetic(), gmst);

    return {
      position: pos,
      velocity: new Vector3D(0, 0, 0) as Vector3D<KilometersPerSecond>,
    };
  }

  toJ2000(date: Date = new Date()): J2000 {
    const epoch = new EpochUTC(date.getTime() / 1000 as Seconds);
    const eci = this.eci(date);
    const pos = new Vector3D(eci.position.x, eci.position.y, eci.position.z);
    const vel = new Vector3D(0, 0, 0) as Vector3D<KilometersPerSecond>;

    return new J2000(epoch, pos, vel);
  }

  toITRF(date: Date = new Date()): ITRF {
    return this.toJ2000(date).toITRF();
  }

  /**
   * Converts the ground position to geodetic coordinates.
   * @returns The geodetic coordinates.
   */
  toGeodetic(): Geodetic {
    return Geodetic.fromDegrees(this.lat_, this.lon_, this.alt_);
  }

  // Override toJSON method
  toJSON(): string {
    return JSON.stringify({
      ...JSON.parse(super.toJSON()),
      latitude: this.lat_,
      longitude: this.lon_,
      altitude: this.alt_,
    });
  }

  /**
   * Validates the input data for the Facility.
   * @param info - The GroundPositionParams object containing the latitude,
   * longitude, and altitude. @returns void
   */
  private validateFacilityInputData_(info: GroundObjectParams) {
    this.validateParameter(info.lat, -90, 90, 'Invalid latitude - must be between -90 and 90');
    this.validateParameter(info.lon, -180, 180, 'Invalid longitude - must be between -180 and 180');
    this.validateParameter(info.alt, 0, null, 'Invalid altitude - must be greater than 0');
  }
}
