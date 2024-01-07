/* eslint-disable init-declarations */
/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The Transforms module contains a collection of conversions not contained
 * in the original SGP4 library such as ECI to ECF and ECF to RAE. This was based
 * on some of the functions in satellite.js.
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2023 Theodore Kruczek
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

import { Earth, Sensor, Sgp4, Utils } from '../ootk';
import {
  Degrees,
  EcefVec3,
  EcfVec3,
  EciVec3,
  EnuVec3,
  GreenwichMeanSiderealTime,
  Kilometers,
  LlaVec3,
  RadarSensor,
  Radians,
  RaeVec3,
  RfVec3,
  RuvVec3,
  SezVec3,
} from '../types/types';
import { DEG2RAD, MILLISECONDS_TO_DAYS, PI, RAD2DEG, TAU } from '../utils/constants';

/**
 * Converts Azimuth and Elevation to U and V.
 * Azimuth is the angle off of boresight in the horizontal plane.
 * Elevation is the angle off of boresight in the vertical plane.
 * Cone half angle is the angle of the cone of the radar max field of view.
 */
export function azel2uv(az: Radians, el: Radians, coneHalfAngle: Radians): { u: Radians; v: Radians } {
  if (az > coneHalfAngle && az < coneHalfAngle) {
    throw new RangeError(`Azimuth is out of bounds: ${az}`);
  }

  if (el > coneHalfAngle && el < coneHalfAngle) {
    throw new RangeError(`Elevation is out of bounds: ${el}`);
  }

  const alpha = (az / (coneHalfAngle * RAD2DEG)) * 90;
  const beta = (el / (coneHalfAngle * RAD2DEG)) * 90;

  const u = Math.sin(alpha) as Radians;
  let v = -Math.sin(beta) as Radians;

  v = Object.is(v, -0) ? (0 as Radians) : v;

  return { u, v };
}

/**
 * Converts ECF to ECI coordinates.
 *
 * [X]     [C -S  0][X]
 * [Y]  =  [S  C  0][Y]
 * [Z]eci  [0  0  1][Z]ecf
 *
 */
export function ecf2eci<T extends number>(ecf: EcfVec3<T>, gmst: number): EciVec3<T> {
  const X = (ecf.x * Math.cos(gmst) - ecf.y * Math.sin(gmst)) as T;
  const Y = (ecf.x * Math.sin(gmst) + ecf.y * Math.cos(gmst)) as T;
  const Z = ecf.z;

  return { x: X, y: Y, z: Z };
}

/**
 * Converts ECEF coordinates to ENU coordinates.
 * @param ecf - The ECEF coordinates.
 * @param lla - The LLA coordinates.
 * @returns The ENU coordinates.
 */
export function ecf2enu<T extends number>(ecf: EcefVec3<T>, lla: LlaVec3): EnuVec3<T> {
  const { lat, lon } = lla;
  const { x, y, z } = ecf;
  const e = (-Math.sin(lon) * x + Math.cos(lon) * y) as T;
  const n = (-Math.sin(lat) * Math.cos(lon) * x - Math.sin(lat) * Math.sin(lon) * y + Math.cos(lat) * z) as T;
  const u = (Math.cos(lat) * Math.cos(lon) * x + Math.cos(lat) * Math.sin(lon) * y + Math.sin(lat) * z) as T;

  return { x: e, y: n, z: u };
}

/**
 * Converts ECI to ECF coordinates.
 *
 * [X]     [C -S  0][X]
 * [Y]  =  [S  C  0][Y]
 * [Z]eci  [0  0  1][Z]ecf
 *
 * Inverse:
 * [X]     [C  S  0][X]
 * [Y]  =  [-S C  0][Y]
 * [Z]ecf  [0  0  1][Z]eci
 */
export function eci2ecf<T extends number>(eci: EciVec3<T>, gmst: number): EcfVec3<T> {
  const x = <T>(eci.x * Math.cos(gmst) + eci.y * Math.sin(gmst));
  const y = <T>(eci.x * -Math.sin(gmst) + eci.y * Math.cos(gmst));
  const z = eci.z;

  return {
    x,
    y,
    z,
  };
}

/**
 * EciToGeodetic converts eci coordinates to lla coordinates
 * @param {vec3} eci takes xyz coordinates
 * @param {number} gmst takes a number in gmst time
 * @returns {array} array containing lla coordinates
 */
export function eci2lla(eci: EciVec3, gmst: number): LlaVec3<Degrees, Kilometers> {
  // http://www.celestrak.com/columns/v02n03/
  const a = 6378.137;
  const b = 6356.7523142;
  const R = Math.sqrt(eci.x * eci.x + eci.y * eci.y);
  const f = (a - b) / a;
  const e2 = 2 * f - f * f;

  let lon = Math.atan2(eci.y, eci.x) - gmst;

  while (lon < -PI) {
    lon += TAU;
  }
  while (lon > PI) {
    lon -= TAU;
  }

  const kmax = 20;
  let k = 0;
  let lat = Math.atan2(eci.z, Math.sqrt(eci.x * eci.x + eci.y * eci.y));
  let C: number;

  while (k < kmax) {
    C = 1 / Math.sqrt(1 - e2 * (Math.sin(lat) * Math.sin(lat)));
    lat = Math.atan2(eci.z + a * C * e2 * Math.sin(lat), R);
    k += 1;
  }
  const alt = R / Math.cos(lat) - a * C;

  lon = (lon * RAD2DEG) as Degrees;
  lat = (lat * RAD2DEG) as Degrees;

  return { lon: <Degrees>lon, lat: <Degrees>lat, alt: <Kilometers>alt };
}

/**
 * Converts coordinates from East-North-Up (ENU) to Right-Front-Up (RF) coordinate system.
 * @param {EnuVec3<D>} enu - The ENU coordinates to be converted.
 * @param {A} az - The azimuth angle in radians.
 * @param {A} el - The elevation angle in radians.
 * @returns {RfVec3} The converted RF coordinates.
 */
export function enu2rf<D extends number, A extends number = Radians>({ x, y, z }: EnuVec3<D>, az: A, el: A): RfVec3<D> {
  const xrf = Math.cos(el) * Math.cos(az) * x - Math.sin(az) * y + Math.sin(el) * Math.cos(az) * z;
  const yrf = Math.cos(el) * Math.sin(az) * x + Math.cos(az) * y + Math.sin(el) * Math.sin(az) * z;
  const zrf = -Math.sin(el) * x + Math.cos(el) * z;

  return {
    x: xrf as D,
    y: yrf as D,
    z: zrf as D,
  };
}

/**
 * Calculates Geodetic Lat Lon Alt to ECF coordinates.
 */
export function lla2ecf<D extends number>(lla: LlaVec3<Radians, D>): EcfVec3<D> {
  const { lon, lat, alt } = lla;

  const a = 6378.137;
  const b = 6356.7523142;
  const f = (a - b) / a;
  const e2 = 2 * f - f * f;
  const normal = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);

  const x = (normal + alt) * Math.cos(lat) * Math.cos(lon);
  const y = (normal + alt) * Math.cos(lat) * Math.sin(lon);
  const z = (normal * (1 - e2) + alt) * Math.sin(lat);

  return {
    x: <D>x,
    y: <D>y,
    z: <D>z,
  };
}

/**
 * Converts geodetic coordinates (latitude, longitude, altitude) to Earth-centered inertial (ECI) coordinates.
 * @param lla The geodetic coordinates in radians and meters.
 * @param gmst The Greenwich Mean Sidereal Time in seconds.
 * @returns The ECI coordinates in meters.
 */
export function lla2eci(lla: LlaVec3<Radians, Kilometers>, gmst: GreenwichMeanSiderealTime): EciVec3<Kilometers> {
  const { lat, lon, alt } = lla;

  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosLon = Math.cos(lon + gmst);
  const sinLon = Math.sin(lon + gmst);
  const x = (Earth.radiusMean + alt) * cosLat * cosLon;
  const y = (Earth.radiusMean + alt) * cosLat * sinLon;
  const z = (Earth.radiusMean + alt) * sinLat;

  return { x, y, z } as EciVec3<Kilometers>;
}

/**
 * Calculates Geodetic Lat Lon Alt to ECEF coordinates.
 *
 * @deprecated This needs to be validated.
 */
export function lla2ecef<D extends number>(lla: LlaVec3<Degrees, D>): EcefVec3<D> {
  const { lat, lon, alt } = lla;
  const a = 6378.137; // semi-major axis length in meters according to the WGS84
  const b = 6356.752314245; // semi-minor axis length in meters according to the WGS84
  const e = Math.sqrt(1 - b ** 2 / a ** 2); // eccentricity
  const N = a / Math.sqrt(1 - e ** 2 * Math.sin(lat) ** 2); // radius of curvature in the prime vertical
  const x = ((N + alt) * Math.cos(lat) * Math.cos(lon)) as D;
  const y = ((N + alt) * Math.cos(lat) * Math.sin(lon)) as D;
  const z = ((N * (1 - e ** 2) + alt) * Math.sin(lat)) as D;

  return { x, y, z };
}

/**
 * Converts LLA to SEZ coordinates.
 * @see http://www.celestrak.com/columns/v02n02/
 */
export function lla2sez<D extends number>(lla: LlaVec3<Radians, D>, ecf: EcfVec3<D>): SezVec3<D> {
  const lat = lla.lat;
  const lon = lla.lon;

  const observerEcf = lla2ecf({
    lat,
    lon,
    alt: <Kilometers>0,
  });

  const rx = ecf.x - observerEcf.x;
  const ry = ecf.y - observerEcf.y;
  const rz = ecf.z - observerEcf.z;

  // Top is short for topocentric
  const south = Math.sin(lat) * Math.cos(lon) * rx + Math.sin(lat) * Math.sin(lon) * ry - Math.cos(lat) * rz;

  const east = -Math.sin(lon) * rx + Math.cos(lon) * ry;

  const zenith = Math.cos(lat) * Math.cos(lon) * rx + Math.cos(lat) * Math.sin(lon) * ry + Math.sin(lat) * rz;

  return { s: <D>south, e: <D>east, z: <D>zenith };
}

/**
 * Converts a vector in Right Ascension, Elevation, and Range (RAE) coordinate system
 * to a vector in South, East, and Zenith (SEZ) coordinate system.
 *
 * @param rae The vector in RAE coordinate system.
 * @returns The vector in SEZ coordinate system.
 */
export function rae2sez<D extends number>(rae: RaeVec3<D, Radians>): SezVec3<D> {
  const south = -rae.rng * Math.cos(rae.el) * Math.cos(rae.az);
  const east = rae.rng * Math.cos(rae.el) * Math.sin(rae.az);
  const zenith = rae.rng * Math.sin(rae.el);

  return {
    s: <D>south,
    e: <D>east,
    z: <D>zenith,
  };
}

/**
 * Converts a vector in Right Ascension, Elevation, and Range (RAE) coordinate system
 * to Earth-Centered Fixed (ECF) coordinate system.
 *
 * @template D - The dimension of the RAE vector.
 * @template A - The dimension of the LLA vector.
 * @param rae - The vector in RAE coordinate system.
 * @param lla - The vector in LLA coordinate system.
 * @returns The vector in ECF coordinate system.
 */
export function rae2ecf<D extends number>(rae: RaeVec3<D, Degrees>, lla: LlaVec3<Degrees, D>): EcfVec3<D> {
  const llaRad = {
    lat: (lla.lat * DEG2RAD) as Radians,
    lon: (lla.lon * DEG2RAD) as Radians,
    alt: lla.alt,
  };
  const raeRad = {
    az: (rae.az * DEG2RAD) as Radians,
    el: (rae.el * DEG2RAD) as Radians,
    rng: rae.rng,
  };

  const obsEcf = lla2ecf(llaRad);
  const sez = rae2sez(raeRad);

  // Some needed calculations
  const slat = Math.sin(llaRad.lat);
  const slon = Math.sin(llaRad.lon);
  const clat = Math.cos(llaRad.lat);
  const clon = Math.cos(llaRad.lon);

  const x = slat * clon * sez.s + -slon * sez.e + clat * clon * sez.z + obsEcf.x;
  const y = slat * slon * sez.s + clon * sez.e + clat * slon * sez.z + obsEcf.y;
  const z = -clat * sez.s + slat * sez.z + obsEcf.z;

  return { x, y, z } as EcfVec3<D>;
}

/**
 * Converts a vector from RAE (Range, Azimuth, Elevation) coordinates to ECI (Earth-Centered Inertial) coordinates.
 *
 * @param rae The vector in RAE coordinates.
 * @param lla The vector in LLA (Latitude, Longitude, Altitude) coordinates.
 * @param gmst The Greenwich Mean Sidereal Time.
 * @returns The vector in ECI coordinates.
 */
export function rae2eci<D extends number>(
  rae: RaeVec3<D, Degrees>,
  lla: LlaVec3<Degrees, D>,
  gmst: number,
): EciVec3<D> {
  const ecf = rae2ecf(rae, lla);
  const eci = ecf2eci(ecf, gmst);

  return eci;
}

/**
 * Converts a vector in RAE (Range, Azimuth, Elevation) coordinates to ENU (East, North, Up) coordinates.
 * @param rae - The vector in RAE coordinates.
 * @returns The vector in ENU coordinates.
 */
export function rae2enu(rae: RaeVec3): EnuVec3<Kilometers> {
  const e = (rae.rng * Math.cos(rae.el) * Math.sin(rae.az)) as Kilometers;
  const n = (rae.rng * Math.cos(rae.el) * Math.cos(rae.az)) as Kilometers;
  const u = (rae.rng * Math.sin(rae.el)) as Kilometers;

  return { x: e, y: n, z: u };
}

/**
 * Determine azimuth and elevation off of boresight based on sensor orientation and RAE.
 *
 * @param {rae} rae Range, Azimuth, Elevation
 * @param {RadarSensor} sensor Radar sensor object
 * @returns {az, el} Azimuth and Elevation off of boresight
 */
export function rae2raeOffBoresight(
  rae: RaeVec3,
  sensor: RadarSensor,
  maxSensorAz: Degrees,
): { az: Radians; el: Radians } {
  let az = (rae.az * DEG2RAD) as Radians;
  let el = (rae.el * DEG2RAD) as Radians;

  // Correct azimuth for sensor orientation.
  az = az > maxSensorAz * DEG2RAD ? ((az - TAU) as Radians) : az;

  az = (az - sensor.boresight.az) as Radians;
  el = (el - sensor.boresight.el) as Radians;

  return { az, el };
}

/**
 * Converts Range Az El to Range U V.
 */
export function rae2ruv(rae: RaeVec3, sensor: RadarSensor, maxSensorAz: Degrees): RuvVec3 {
  const { az, el } = rae2raeOffBoresight(rae, sensor, maxSensorAz);
  const { u, v } = azel2uv(az, el, sensor.coneHalfAngle);

  return { rng: rae.rng, u, v };
}

/**
 * Converts South, East, and Zenith (SEZ) coordinates to Right Ascension, Elevation, and Range (RAE) coordinates.
 * @param sez The SEZ coordinates.
 * @returns {RaeVec3} Rng, Az, El array
 */
export function sez2rae<D extends number>(sez: SezVec3<D>): RaeVec3<D, Radians> {
  const rng = <D>Math.sqrt(sez.s * sez.s + sez.e * sez.e + sez.z * sez.z);
  const el = <Radians>Math.asin(sez.z / rng);
  const az = <Radians>(Math.atan2(-sez.e, sez.s) + PI);

  return { rng, az, el };
}

/**
 * Converts U and V to Azimuth and Elevation off of boresight.
 *
 * @param u The U coordinate.
 * @param v The V coordinate.
 * @param coneHalfAngle The cone half angle of the radar.
 */
export function uv2azel(u: Radians, v: Radians, coneHalfAngle: Radians): { az: Radians; el: Radians } {
  if (u > 1 || u < -1) {
    throw new RangeError(`u is out of bounds: ${u}`);
  }

  if (v > 1 || v < -1) {
    throw new RangeError(`v is out of bounds: ${v}`);
  }

  const alpha = Math.asin(u) as Radians;
  const beta = Math.asin(v) as Radians;
  const az = ((alpha / 90) * (coneHalfAngle * RAD2DEG)) as Radians;
  const el = ((beta / 90) * (coneHalfAngle * RAD2DEG)) as Radians;

  return { az, el };
}

/**
 * Converts Earth-Centered Fixed (ECF) coordinates to Right Ascension (RA),
 * Elevation (E), and Azimuth (A) coordinates.
 *
 * @param lla The Latitude, Longitude, and Altitude (LLA) coordinates.
 * @param ecf The Earth-Centered Fixed (ECF) coordinates.
 * @returns The Right Ascension (RA), Elevation (E), and Azimuth (A) coordinates.
 */
export function ecf2rae<D extends number>(lla: LlaVec3<Radians, D>, ecf: EcfVec3<D>): RaeVec3<D, Degrees> {
  const sezCoords = lla2sez(lla, ecf);
  const rae = sez2rae(sezCoords);

  return { rng: rae.rng, az: (rae.az * RAD2DEG) as Degrees, el: (rae.el * RAD2DEG) as Degrees };
}

/**
 * Calculates the Greenwich Mean Sidereal Time (GMST) for a given date.
 *
 * @param date - The date for which to calculate the GMST.
 * @returns An object containing the GMST value and the Julian date.
 */
export function calcGmst(date: Date): { gmst: GreenwichMeanSiderealTime; j: number } {
  const j =
    Utils.jday(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ) +
    date.getUTCMilliseconds() * MILLISECONDS_TO_DAYS;

  const gmst = Sgp4.gstime(j);

  return { gmst, j };
}

// Create a cache for eci2rae
const eci2raeCache = new Map<string, RaeVec3<Kilometers, Degrees>>();

/**
 * Converts ECI coordinates to RAE (Right Ascension, Azimuth, Elevation) coordinates.
 * @param {Date} now - Current date and time.
 * @param {EciArr3} eci - ECI coordinates of the satellite.
 * @param {SensorObject} sensor - Sensor object containing observer's geodetic coordinates.
 * @returns {Object} Object containing azimuth, elevation and range in degrees and kilometers respectively.
 */
export function eci2rae(now: Date, eci: EciVec3<Kilometers>, sensor: Sensor): RaeVec3<Kilometers, Degrees> {
  now = new Date(now);
  const { gmst } = calcGmst(now);

  // Check cache
  const key = `${gmst},${eci.x},${eci.y},${eci.z},${sensor.lat},${sensor.lon},${sensor.alt}`;
  const cached = eci2raeCache.get(key);

  if (cached) {
    return cached;
  }

  const positionEcf = eci2ecf(eci, gmst);
  const lla = {
    lat: (sensor.lat * DEG2RAD) as Radians,
    lon: (sensor.lon * DEG2RAD) as Radians,
    alt: sensor.alt,
  };

  const rae = ecf2rae(lla, positionEcf);

  // Add to cache
  eci2raeCache.set(key, rae);
  // Ensure eci2raeCache isnt too big
  if (eci2raeCache.size > 1000) {
    eci2raeCache.delete(eci2raeCache.keys().next().value);
  }

  return rae;
}
