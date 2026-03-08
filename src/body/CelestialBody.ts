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

import {
  Body,
  Equator,
  GeoVector,
  HelioVector,
  Horizon,
  KM_PER_AU,
  MakeTime,
  Observer,
  SearchRiseSet,
} from 'astronomy-engine';
import { BaseObject, BaseObjectParams } from '../objects/BaseObject';
import { Vector3D } from '../operations/Vector3D';
import { Degrees, Kilometers, Radians } from '../types/types';
import { DEG2RAD, RAD2DEG } from '../utils/constants';
import { CelestialBodyType } from './CelestialBodyType';
import { GroundObject } from '../objects/GroundObject';

/**
 * Configuration options for CelestialBody.
 */
export interface CelestialBodyParams extends BaseObjectParams {
  /** The celestial body type */
  bodyType: CelestialBodyType;
  /** Gravitational parameter (km³/s²) */
  mu?: number;
  /** Mean radius (km) */
  radius?: Kilometers;
  /** astronomy-engine Body identifier */
  astronomyBody?: Body;
}

/**
 * Rise/set/transit times for a celestial body.
 */
export interface RiseSetTimes {
  /** Time when body rises above horizon (null if circumpolar or never rises) */
  rise: Date | null;
  /** Time when body reaches highest point */
  transit: Date | null;
  /** Time when body sets below horizon (null if circumpolar or never sets) */
  set: Date | null;
}

/**
 * Abstract base class for all celestial bodies in the solar system.
 *
 * CelestialBody uses astronomy-engine for high-precision calculations of
 * positions, rise/set times, and other astronomical phenomena.
 *
 * @example
 * ```typescript
 * // Get the Sun's position
 * const sunPos = Sun.eci(new Date());
 *
 * // Get rise/set times for Mars
 * const marsRiseSet = Mars.getRiseSetTimes(groundStation, new Date());
 * ```
 */
export abstract class CelestialBody extends BaseObject {
  /** The type of celestial body */
  bodyType: CelestialBodyType;
  /** Gravitational parameter (km³/s²) */
  mu?: number;
  /** Mean radius (km) */
  radius?: Kilometers;
  /** astronomy-engine Body identifier for calculated bodies */
  protected astronomyBody_?: Body;

  constructor(params: CelestialBodyParams) {
    super(params);
    this.bodyType = params.bodyType;
    this.mu = params.mu;
    this.radius = params.radius;
    this.astronomyBody_ = params.astronomyBody;
  }

  // ==================== Abstract Methods ====================

  /**
   * Gets the body's position in Earth-Centered Inertial (J2000) coordinates.
   * @param date - The date/time for the position calculation
   * @returns Position vector in kilometers
   */
  abstract eci(date?: Date): Vector3D<Kilometers>;

  /**
   * Gets the body's position in heliocentric coordinates.
   * @param date - The date/time for the position calculation
   * @returns Position vector in kilometers (Sun-centered)
   */
  abstract heliocentric(date?: Date): Vector3D<Kilometers>;

  /**
   * Gets the body's velocity vector if available.
   * @param date - The date/time for the velocity calculation
   * @returns Velocity vector in km/s, or null if not available
   */
  abstract velocity(date?: Date): Vector3D | null;

  // ==================== Concrete Methods ====================

  /**
   * Gets the right ascension of the body as seen from Earth.
   * @param date - The date/time for the calculation
   * @returns Right ascension in radians
   */
  getRightAscension(date: Date = new Date()): Radians {
    if (!this.astronomyBody_) {
      throw new Error(`${this.name} does not have astronomy-engine support for RA calculation`);
    }
    const time = MakeTime(date);
    // Use geocentric observer (center of Earth)
    const observer = new Observer(0, 0, 0);
    const equatorial = Equator(this.astronomyBody_, time, observer, false, true);

    // Convert from sidereal hours to radians
    return ((equatorial.ra * 15) * DEG2RAD) as Radians;
  }

  /**
   * Gets the declination of the body as seen from Earth.
   * @param date - The date/time for the calculation
   * @returns Declination in radians
   */
  getDeclination(date: Date = new Date()): Radians {
    if (!this.astronomyBody_) {
      throw new Error(`${this.name} does not have astronomy-engine support for Dec calculation`);
    }
    const time = MakeTime(date);
    const observer = new Observer(0, 0, 0);
    const equatorial = Equator(this.astronomyBody_, time, observer, false, true);

    return (equatorial.dec * DEG2RAD) as Radians;
  }

  /**
   * Gets the azimuth and altitude of the body as seen from a ground location.
   * @param observer - The ground observer location
   * @param date - The date/time for the calculation
   * @param refraction - Whether to apply atmospheric refraction correction
   * @returns Object with azimuth and altitude in degrees
   */
  getAzEl(
    observer: GroundObject,
    date: Date = new Date(),
    refraction = true,
  ): { az: Degrees; el: Degrees } {
    if (!this.astronomyBody_) {
      throw new Error(`${this.name} does not have astronomy-engine support for Az/El calculation`);
    }
    const time = MakeTime(date);
    const obs = new Observer(observer.lat, observer.lon, observer.alt * 1000); // Convert km to meters

    const equatorial = Equator(this.astronomyBody_, time, obs, true, true);
    const horizontal = Horizon(time, obs, equatorial.ra, equatorial.dec, refraction ? 'normal' : undefined);

    return {
      az: horizontal.azimuth as Degrees,
      el: horizontal.altitude as Degrees,
    };
  }

  /**
   * Gets the distance from Earth to this body.
   * @param date - The date/time for the calculation
   * @returns Distance in kilometers
   */
  getDistanceFromEarth(date: Date = new Date()): Kilometers {
    const pos = this.eci(date);

    return pos.magnitude() as Kilometers;
  }

  /**
   * Gets the distance from the Sun to this body.
   * @param date - The date/time for the calculation
   * @returns Distance in kilometers
   */
  getDistanceFromSun(date: Date = new Date()): Kilometers {
    const pos = this.heliocentric(date);

    return pos.magnitude() as Kilometers;
  }

  /**
   * Gets rise, transit, and set times for this body as seen from a ground location.
   * @param observer - The ground observer location
   * @param date - The starting date for the search
   * @param minElevation - Minimum elevation angle in degrees (default 0)
   * @returns Rise, transit, and set times (null if body doesn't rise/set)
   */
  getRiseSetTimes(
    observer: GroundObject,
    date: Date = new Date(),
    minElevation: Degrees = 0 as Degrees,
  ): RiseSetTimes {
    if (!this.astronomyBody_) {
      throw new Error(`${this.name} does not have astronomy-engine support for rise/set calculation`);
    }

    const obs = new Observer(observer.lat, observer.lon, observer.alt * 1000);
    const time = MakeTime(date);

    // Search for rise (direction = +1) and set (direction = -1)
    const riseTime = SearchRiseSet(this.astronomyBody_, obs, +1, time, 1, minElevation);
    const setTime = SearchRiseSet(this.astronomyBody_, obs, -1, time, 1, minElevation);

    // For transit, search for the next rise, then find when elevation peaks
    // This is a simplified approach - astronomy-engine doesn't have a direct transit search
    let transitTime: Date | null = null;

    if (riseTime && setTime) {
      // Transit is approximately halfway between rise and set
      const riseMs = riseTime.date.getTime();
      const setMs = setTime.date.getTime();

      if (setMs > riseMs) {
        transitTime = new Date((riseMs + setMs) / 2);
      } else {
        // Set is before rise (body is currently up)
        transitTime = new Date(date.getTime());
      }
    }

    return {
      rise: riseTime?.date ?? null,
      transit: transitTime,
      set: setTime?.date ?? null,
    };
  }

  /**
   * Calculates the angular diameter of this body as seen from a given position.
   * @param observerPos - The observer's position in km
   * @returns Angular diameter in radians
   */
  getAngularDiameter(observerPos: Vector3D<Kilometers>): Radians {
    if (!this.radius) {
      throw new Error(`${this.name} does not have a defined radius`);
    }
    const distance = observerPos.subtract(this.eci()).magnitude();

    return (2 * Math.atan(this.radius / distance)) as Radians;
  }

  /**
   * Calculates the angular separation between this body and a target position.
   * @param targetPos - The target position in ECI coordinates (km)
   * @param date - The date/time for the calculation
   * @returns Angular separation in degrees
   */
  getAngularSeparation(targetPos: Vector3D<Kilometers>, date: Date = new Date()): Degrees {
    const bodyPos = this.eci(date);
    const angle = bodyPos.angle(targetPos);

    return (angle * RAD2DEG) as Degrees;
  }

  // ==================== Protected Helpers ====================

  /**
   * Converts astronomy-engine GeoVector (AU) to Vector3D (km).
   */
  protected geoVectorToKm(body: Body, date: Date): Vector3D<Kilometers> {
    const time = MakeTime(date);
    const vec = GeoVector(body, time, true);

    return new Vector3D(
      (vec.x * KM_PER_AU) as Kilometers,
      (vec.y * KM_PER_AU) as Kilometers,
      (vec.z * KM_PER_AU) as Kilometers,
    );
  }

  /**
   * Converts astronomy-engine HelioVector (AU) to Vector3D (km).
   */
  protected helioVectorToKm(body: Body, date: Date): Vector3D<Kilometers> {
    const time = MakeTime(date);
    const vec = HelioVector(body, time);

    return new Vector3D(
      (vec.x * KM_PER_AU) as Kilometers,
      (vec.y * KM_PER_AU) as Kilometers,
      (vec.z * KM_PER_AU) as Kilometers,
    );
  }

  // ==================== Serialization ====================

  protected serializeSpecific(): Record<string, unknown> {
    return {
      bodyType: this.bodyType,
      mu: this.mu,
      radius: this.radius,
    };
  }
}
