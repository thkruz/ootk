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
  MakeTime,
  Observer,
  SearchRiseSet,
} from 'astronomy-engine';
import { GroundObject } from '../objects/GroundObject';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { Degrees, Kilometers, Meters, Radians, SpaceObjectType, SunTime } from '../types/types';
import { cKmPerSec, DEG2RAD, MS_PER_DAY, RAD2DEG } from '../utils/constants';
import { CelestialBody, CelestialBodyParams } from './CelestialBody';
import { CelestialBodyType } from './CelestialBodyType';
import { Earth } from './Earth';

// Re-export SunTime for convenience
export type { SunTime } from '../types/types';

/**
 * Sun physical and orbital constants, plus satellite shadow calculations.
 *
 * SunBody provides:
 * - High-precision position calculations via astronomy-engine
 * - Satellite eclipse/shadow detection
 * - Illumination fraction calculations for solar radiation pressure
 * - Sunrise/sunset/twilight times for ground observers
 *
 * @example
 * ```typescript
 * // Get Sun position
 * const sunPos = Sun.eci(new Date());
 *
 * // Check if satellite is in shadow
 * const inShadow = Sun.shadow(epoch, satellitePos);
 *
 * // Get sunrise/sunset times
 * const times = Sun.getTimes(new Date(), 40.7 as Degrees, -74 as Degrees);
 * ```
 */
export class SunBody extends CelestialBody {
  // ==================== Physical Constants ====================

  /** Gravitational parameter (km³/s²) */
  static readonly MU = 1.32712428e11;

  /** Mean radius (km) */
  static readonly RADIUS = 695500.0 as Kilometers;

  /** Penumbra cone half-angle (radians) */
  static readonly PENUMBRA_ANGLE = (0.26900424 * DEG2RAD) as Radians;

  /** Umbra cone half-angle (radians) */
  static readonly UMBRA_ANGLE = (0.26411888 * DEG2RAD) as Radians;

  /** Mean solar flux at 1 AU (W/m²) */
  static readonly SOLAR_FLUX = 1367.0;

  /** Solar radiation pressure at 1 AU (N/m²) */
  static readonly SOLAR_PRESSURE = SunBody.SOLAR_FLUX / (cKmPerSec * 1000);

  /** Obliquity of the ecliptic (radians) */
  static readonly OBLIQUITY = (DEG2RAD * 23.4397) as Radians;

  // ==================== Private Constants ====================

  private static readonly J0_ = 0.0009;
  private static readonly J1970_ = 2440587.5;
  private static readonly J2000_ = 2451545;

  /** Sun time calculation thresholds */
  private static readonly times_ = [
    [6, 'goldenHourDawnEnd', 'goldenHourDuskStart'],
    [-0.3, 'sunriseEnd', 'sunsetStart'],
    [-0.833, 'sunriseStart', 'sunsetEnd'],
    [-1, 'goldenHourDawnStart', 'goldenHourDuskEnd'],
    [-4, 'blueHourDawnEnd', 'blueHourDuskStart'],
    [-6, 'civilDawn', 'civilDusk'],
    [-8, 'blueHourDawnStart', 'blueHourDuskEnd'],
    [-12, 'nauticalDawn', 'nauticalDusk'],
    [-15, 'amateurDawn', 'amateurDusk'],
    [-18, 'astronomicalDawn', 'astronomicalDusk'],
  ] as [Degrees, string, string][];

  // ==================== Singleton Instance ====================

  private static instance_: SunBody | null = null;

  /**
   * Gets the singleton Sun instance.
   */
  static getInstance(): SunBody {
    if (!SunBody.instance_) {
      SunBody.instance_ = new SunBody();
    }

    return SunBody.instance_;
  }

  private constructor() {
    super({
      id: 0,
      name: 'Sun',
      type: SpaceObjectType.STAR,
      bodyType: CelestialBodyType.STAR,
      mu: SunBody.MU,
      radius: SunBody.RADIUS,
      astronomyBody: Body.Sun,
    } as CelestialBodyParams);
  }

  // ==================== Position Methods ====================

  /**
   * Gets the Sun's position in Earth-Centered Inertial (J2000) coordinates.
   * @param date - The date/time for the position calculation
   * @returns Position vector in kilometers
   */
  eci(date: Date = new Date()): Vector3D<Kilometers> {
    return this.geoVectorToKm(Body.Sun, date);
  }

  /**
   * Gets the Sun's apparent position (corrected for light travel time).
   * @param date - The date/time for the position calculation
   * @returns Position vector in kilometers
   */
  eciApparent(date: Date = new Date()): Vector3D<Kilometers> {
    const pos = this.eci(date);
    const distance = pos.magnitude();
    const lightTimeSec = distance / cKmPerSec;

    // Roll back time by light travel time
    const adjustedDate = new Date(date.getTime() - lightTimeSec * 1000);

    return this.eci(adjustedDate);
  }

  /**
   * Gets the Sun's position in heliocentric coordinates.
   * For the Sun itself, this is always the origin.
   * @returns Zero vector (Sun is at heliocentric origin)
   */
  heliocentric(_date?: Date): Vector3D<Kilometers> {
    return new Vector3D(0 as Kilometers, 0 as Kilometers, 0 as Kilometers);
  }

  /**
   * Sun's velocity is not typically needed, returns null.
   */
  velocity(_date?: Date): Vector3D | null {
    return null;
  }

  // ========================= Angle Methods ==========================

  /**
   * Calculates the angle at sat2 between sat1 and the Sun.
   *
   * This computes the angle between the vector from sat2 to the Sun
   * and the vector from sat2 to sat1.
   *
   * @param sat1Pos - ECI position of the first satellite in km.
   * @param sat2Pos - ECI position of the second satellite (vertex) in km.
   * @param sunPos - ECI position of the Sun in km.
   * @returns The angle in radians.
   *
   * @example
   * ```ts
   * const sunPos = Sun.position(epoch);
   * const angle = Sun.angleBetweenSatellites(sat1.position, sat2.position, sunPos);
   * const angleDeg = angle * RAD2DEG;
   * ```
   */
  static angleBetweenSatellites(
    sat1Pos: Vector3D<Kilometers>,
    sat2Pos: Vector3D<Kilometers>,
    sunPos: Vector3D<Kilometers>,
  ): Radians {
    const sat2ToSun = sunPos.subtract(sat2Pos);
    const sat2ToSat1 = sat1Pos.subtract(sat2Pos);

    return sat2ToSun.angle(sat2ToSat1);
  }

  /**
   * Calculates the Sun-Satellite-Earth angle with vertex at the satellite.
   *
   * This computes the angle between the vector from the satellite to the Sun
   * and the vector from the satellite to the Earth (Earth is at origin in ECI).
   *
   * @param satPos - ECI position of the satellite in km.
   * @param sunPos - ECI position of the Sun in km.
   * @returns The angle in degrees.
   *
   * @example
   * ```ts
   * const sunPos = Sun.position(epoch);
   * const angle = Sun.sunSatEarthAngle(sat.position, sunPos);
   * // angle is in degrees, useful for determining if satellite is between Earth and Sun
   * ```
   */
  static sunSatEarthAngle(satPos: Vector3D<Kilometers>, sunPos: Vector3D<Kilometers>): Degrees {
    const satToSun = sunPos.subtract(satPos);
    const satToEarth = satPos.negate(); // Earth at origin

    return (satToSun.angle(satToEarth) * RAD2DEG) as Degrees;
  }

  // ==================== Satellite Shadow Methods ====================

  /**
   * Determines if a satellite is in Earth's shadow.
   * @param epoch - The epoch for the calculation
   * @param satPos - The satellite's ECI position in kilometers
   * @example
   * ```typescript
   * import { Sun, Satellite, EpochUTC, Vector3D, Kilometers, Seconds } from 'ootk';
   *
   * const satellite = new Satellite({ tle });
   * const now = new Date();
   * const epoch = new EpochUTC((now.getTime() / 1000) as Seconds);
   *
   * const pv = satellite.eci(now);
   * if (pv) {
   *   const satPos = new Vector3D<Kilometers>(
   *     pv.position.x as Kilometers,
   *     pv.position.y as Kilometers,
   *     pv.position.z as Kilometers
   *   );
   *
   *   const inShadow = Sun.shadow(epoch, satPos);
   *   console.log(inShadow ? 'Satellite is in eclipse' : 'Satellite is sunlit');
   *
   *   // For more detail, use lightingRatio
   *   const sunPos = Sun.eci(now);
   *   const lighting = Sun.lightingRatio(satPos, sunPos);
   *   console.log(`Lighting: ${(lighting * 100).toFixed(1)}%`);
   * }
   * ```
   * @returns True if satellite is in shadow (eclipse)
   */
  shadow(epoch: EpochUTC, satPos: Vector3D<Kilometers>): boolean {
    const sunPos = this.eciApparent(epoch.toDateTime());
    let inShadow = false;

    if (sunPos.dot(satPos) < 0) {
      const angle = sunPos.angle(satPos);
      const r = satPos.magnitude();
      const satHoriz = r * Math.cos(angle);
      const satVert = r * Math.sin(angle);
      const penVert = Earth.radiusEquator + Math.tan(SunBody.PENUMBRA_ANGLE) * satHoriz;

      if (satVert <= penVert) {
        inShadow = true;
      }
    }

    return inShadow;
  }

  /**
   * Calculates eclipse angles for satellite shadow determination.
   * @param satPos - The satellite's ECI position in kilometers
   * @param sunPos - The Sun's ECI position in kilometers
   * @returns [central body angle, central body apparent radius, sun apparent radius] in radians
   */
  eclipseAngles(satPos: Vector3D<Kilometers>, sunPos: Vector3D<Kilometers>): [Radians, Radians, Radians] {
    const satSun = sunPos.subtract(satPos);
    const r = satPos.magnitude();

    return [
      satSun.angle(satPos.negate()),
      Math.asin(Earth.radiusEquator / r) as Radians,
      Math.asin(SunBody.RADIUS / satSun.magnitude()) as Radians,
    ];
  }

  /**
   * Calculates the lighting ratio for a satellite position.
   *
   * Returns 1.0 for full illumination, 0.0 for full eclipse (umbra),
   * and intermediate values for penumbra.
   *
   * @param satPos - The satellite's ECI position in kilometers
   * @param sunPos - The Sun's ECI position in kilometers
   * @returns Lighting ratio from 0.0 (full eclipse) to 1.0 (full illumination)
   */
  lightingRatio(satPos: Vector3D<Kilometers>, sunPos: Vector3D<Kilometers>): number {
    const [sunSatAngle, aCent, aSun] = this.eclipseAngles(satPos, sunPos);

    if (sunSatAngle - aCent + aSun <= 1e-10) {
      return 0.0;
    } else if (sunSatAngle - aCent - aSun < -1e-10) {
      const ssa2 = sunSatAngle * sunSatAngle;
      const ssaInv = 1.0 / (2.0 * sunSatAngle);
      const ac2 = aCent * aCent;
      const as2 = aSun * aSun;
      const acAsDiff = ac2 - as2;
      const a1 = (ssa2 - acAsDiff) * ssaInv;
      const a2 = (ssa2 + acAsDiff) * ssaInv;
      const asr1 = a1 / aSun;
      const asr2 = as2 - a1 * a1;
      const acr1 = a2 / aCent;
      const acr2 = ac2 - a2 * a2;
      const p1 = as2 * Math.acos(asr1) - a1 * Math.sqrt(asr2);
      const p2 = ac2 * Math.acos(acr1) - a2 * Math.sqrt(acr2);

      return 1.0 - (p1 + p2) / (Math.PI * as2);
    }

    return 1.0;
  }

  /**
   * Calculates the Sun's angular diameter as seen from a position.
   * @param obsPos - Observer position in kilometers
   * @returns Angular diameter in radians
   */
  diameter(obsPos: Vector3D<Kilometers>): Radians {
    const sunPos = this.eci();
    const distance = obsPos.subtract(sunPos).magnitude();

    return (2 * Math.asin(SunBody.RADIUS / distance)) as Radians;
  }

  // ==================== Sunrise/Sunset Methods ====================

  /**
   * Calculates comprehensive sun times for a given location and date.
   *
   * @param dateVal - The date for calculation
   * @param lat - Latitude in degrees
   * @param lon - Longitude in degrees
   * @param alt - Altitude in meters (default 0)
   * @param isUtc - If true, treat date as UTC (default false)
   * @example
   * ```typescript
   * import { Sun, Degrees, Meters } from 'ootk';
   *
   * // Get sun times for a ground station
   * const times = Sun.getTimes(
   *   new Date('2024-06-21'),
   *   40.0 as Degrees,    // latitude
   *   -75.0 as Degrees,   // longitude
   *   100 as Meters       // altitude
   * );
   *
   * console.log(`Sunrise: ${times.sunriseStart.toLocaleTimeString()}`);
   * console.log(`Sunset: ${times.sunsetEnd.toLocaleTimeString()}`);
   * console.log(`Solar noon: ${times.solarNoon.toLocaleTimeString()}`);
   *
   * // For optical satellite tracking, check astronomical twilight
   * console.log(`Astronomical dawn: ${times.astronomicalDawn.toLocaleTimeString()}`);
   * console.log(`Astronomical dusk: ${times.astronomicalDusk.toLocaleTimeString()}`);
   *
   * // Golden hour for photography
   * console.log(`Golden hour starts: ${times.goldenHourDuskStart.toLocaleTimeString()}`);
   * ```
   * @returns Object with all sun event times
   */
  getTimes(
    dateVal: Date | number,
    lat: Degrees,
    lon: Degrees,
    alt: Meters = 0 as Meters,
    isUtc = false,
  ): SunTime {
    if (isNaN(lat)) {
      throw new Error('latitude missing');
    }
    if (isNaN(lon)) {
      throw new Error('longitude missing');
    }

    const date = dateVal instanceof Date ? dateVal : new Date(dateVal);

    if (isUtc) {
      date.setUTCHours(12, 0, 0, 0);
    } else {
      date.setHours(12, 0, 0, 0);
    }

    const { Jnoon, dh, lw, phi, dec, n, M, L } = this.calculateJnoon_(lon, lat, alt, date);

    const result: SunTime = {
      solarNoon: this.julian2date(Jnoon),
      nadir: this.julian2date(Jnoon + 0.5),
    } as SunTime;

    for (let i = 0; i < SunBody.times_.length; i++) {
      const time = SunBody.times_[i]!;
      const angle = time[0];

      const h0 = ((angle + dh) * DEG2RAD) as Meters;

      const Jset = this.getSetJ_(h0, lw, phi, dec, n, M, L);
      const Jrise = Jnoon - (Jset - Jnoon);

      result[time[1] as keyof SunTime] = this.julian2date(Jrise);
      result[time[2] as keyof SunTime] = this.julian2date(Jset);
    }

    return result;
  }

  /**
   * Gets sunrise and sunset times using astronomy-engine.
   * @param observer - Ground observer location
   * @param date - The date for calculation
   * @param minElevation - Minimum elevation in degrees (default -0.833 for standard sunrise)
   */
  getSunriseSunset(
    observer: GroundObject,
    date: Date = new Date(),
    minElevation: Degrees = -0.833 as Degrees,
  ): { sunrise: Date | null; sunset: Date | null } {
    const obs = new Observer(observer.lat, observer.lon, observer.alt * 1000);
    const time = MakeTime(date);

    const sunrise = SearchRiseSet(Body.Sun, obs, +1, time, 1, minElevation);
    const sunset = SearchRiseSet(Body.Sun, obs, -1, time, 1, minElevation);

    return {
      sunrise: sunrise?.date ?? null,
      sunset: sunset?.date ?? null,
    };
  }

  // ==================== Private Helper Methods ====================

  private date2jSince2000(date: Date): number {
    return date.getTime() / MS_PER_DAY + SunBody.J1970_ - SunBody.J2000_;
  }

  private julian2date(julian: number): Date {
    return new Date((julian - SunBody.J1970_) * MS_PER_DAY);
  }

  private solarMeanAnomaly_(d: number): number {
    return DEG2RAD * (357.5291 + 0.98560028 * d);
  }

  private eclipticLongitude_(M: number): Radians {
    const C = DEG2RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const P = DEG2RAD * 102.9372;

    return (M + C + P + Math.PI) as Radians;
  }

  private declination_(L: Radians): Radians {
    return Math.asin(Math.sin(L) * Math.sin(SunBody.OBLIQUITY)) as Radians;
  }

  private julianCycle_(d: number, lw: number): number {
    const TAU = 2 * Math.PI;

    return Math.round(d - SunBody.J0_ - lw / TAU);
  }

  private approxTransit_(Ht: number, lw: number, n: number): number {
    const TAU = 2 * Math.PI;

    return SunBody.J0_ + (Ht + lw) / TAU + n;
  }

  private solarTransitJulian_(ds: number, M: number, L: number): number {
    return SunBody.J2000_ + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  }

  private hourAngle_(h: number, phi: number, dec: number): number {
    return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
  }

  private observerAngle_(alt: Meters): Degrees {
    return ((-2.076 * Math.sqrt(alt)) / 60) as Degrees;
  }

  private calculateJnoon_(lon: Degrees, lat: Degrees, alt: Meters, date: Date) {
    const lw = (DEG2RAD * -lon) as Radians;
    const phi = (DEG2RAD * lat) as Radians;
    const dh = this.observerAngle_(alt);
    const d = this.date2jSince2000(date);

    const n = this.julianCycle_(d, lw);
    const ds = this.approxTransit_(0, lw, n);
    const M = this.solarMeanAnomaly_(ds);
    const L = this.eclipticLongitude_(M);
    const dec = this.declination_(L);
    const Jnoon = this.solarTransitJulian_(ds, M, L);

    return { Jnoon, dh, lw, phi, dec, n, M, L };
  }

  private getSetJ_(
    alt: Meters,
    lw: Radians,
    phi: Radians,
    dec: Radians,
    n: number,
    M: number,
    L: Radians,
  ): number {
    const w = this.hourAngle_(alt, phi, dec);
    const a = this.approxTransit_(w, lw, n);

    return this.solarTransitJulian_(a, M, L);
  }
}

/**
 * Pre-instantiated Sun singleton for convenience.
 *
 * @example
 * ```typescript
 * import { Sun } from 'ootk';
 *
 * const sunPos = Sun.eci(new Date());
 * const inShadow = Sun.shadow(epoch, satellitePos);
 * ```
 */
export const Sun = SunBody.getInstance();
