import { ValidationError } from '../errors';
import { DEG2RAD, MILLISECONDS_TO_DAYS, PI, RAD2DEG, TAU } from '../utils/constants';
import { Degrees, EcefVec3, EnuVec3, GreenwichMeanSiderealTime, Kilometers, LlaVec3, Radians, RaeVec3, RfVec3, RuvVec3, SezVec3, TemeVec3 } from '../types/types';
import { Earth } from '../body/Earth';
import { Sgp4 } from '../sgp4/sgp4';
import type { GroundObject } from '../objects/GroundObject';
import type { PhasedArrayRadar } from '../sensor/PhasedArrayRadar';

/**
 * Converts ECEF (Earth-Centered Earth-Fixed) to TEME (True Equator Mean Equinox) coordinates.
 *
 * **Coordinate Frame Transformation: ECEF → TEME**
 *
 * This is a simplified transformation that rotates by GMST (Greenwich Mean Sidereal Time)
 * around the Z-axis. It does not account for precession, nutation, or polar motion.
 *
 * For high-precision transformations, use the ITRF class methods instead.
 *
 * [X]     [C -S  0][X]
 * [Y]  =  [S  C  0][Y]
 * [Z]eci  [0  0  1][Z]ecef
 *
 * @param ecef - ECEF coordinates (Earth-fixed)
 * @param gmst - Greenwich Mean Sidereal Time in radians
 * @returns TEME coordinates (inertial)
 */
export function ecef2eci<T extends number>(ecef: EcefVec3<T>, gmst: number): TemeVec3<T> {
  const X = (ecef.x * Math.cos(gmst) - ecef.y * Math.sin(gmst)) as T;
  const Y = (ecef.x * Math.sin(gmst) + ecef.y * Math.cos(gmst)) as T;
  const Z = ecef.z;

  return { x: X, y: Y, z: Z };
}

/**
 * Converts ECEF coordinates to ENU coordinates.
 * @param ecef - The ECEF coordinates.
 * @param lla - The LLA coordinates.
 * @returns The ENU coordinates.
 */
export function ecef2enu<T extends number>(ecef: EcefVec3<T>, lla: LlaVec3): EnuVec3<T> {
  const { lat, lon } = lla;
  const { x, y, z } = ecef;
  const e = (-Math.sin(lon) * x + Math.cos(lon) * y) as T;
  const n = (-Math.sin(lat) * Math.cos(lon) * x - Math.sin(lat) * Math.sin(lon) * y + Math.cos(lat) * z) as T;
  const u = (Math.cos(lat) * Math.cos(lon) * x + Math.cos(lat) * Math.sin(lon) * y + Math.sin(lat) * z) as T;

  return { x: e, y: n, z: u };
}

/**
 * Converts TEME (True Equator Mean Equinox) to ECEF (Earth-Centered Earth-Fixed) coordinates.
 *
 * **Coordinate Frame Transformation: TEME → ECEF**
 *
 * This is a simplified transformation that rotates by GMST (Greenwich Mean Sidereal Time)
 * around the Z-axis. It does not account for precession, nutation, or polar motion.
 *
 * For high-precision transformations, use J2000.toITRF() instead.
 *
 * [X]     [C  S  0][X]
 * [Y]  =  [-S C  0][Y]
 * [Z]ecef [0  0  1][Z]eci
 *
 * @param eci - TEME coordinates (inertial, from SGP4)
 * @param gmst - Greenwich Mean Sidereal Time in radians
 * @returns ECEF coordinates (Earth-fixed)
 */
export function eci2ecef<T extends number>(eci: TemeVec3<T>, gmst: number): EcefVec3<T> {
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
 * Converts TEME (True Equator Mean Equinox) coordinates to geodetic (lat/lon/alt) coordinates.
 *
 * **Coordinate Frame Transformation: TEME → Geodetic (WGS84)**
 *
 * Internally converts TEME to ECEF via GMST rotation, then iteratively solves
 * for geodetic latitude on the WGS84 ellipsoid.
 *
 * @variation cached - results are cached
 * @param eci - TEME coordinates (inertial, from SGP4)
 * @param gmst - Greenwich Mean Sidereal Time in radians
 * @returns Geodetic coordinates (lat/lon in degrees, alt in km on WGS84)
 */
export function eci2lla(eci: TemeVec3, gmst: number): LlaVec3<Degrees, Kilometers> {
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
  let C = 0;

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
 * Converts geodetic coordinates (longitude, latitude, altitude) to Earth-Centered Earth-Fixed (ECEF) coordinates.
 * @param lla The geodetic coordinates in radians and meters.
 * @returns The ECEF coordinates in meters.
 */
export function llaRad2ecef<AltitudeUnits extends number>(lla: LlaVec3<Radians, AltitudeUnits>): EcefVec3<AltitudeUnits> {
  const { lon, lat, alt } = lla;

  const a = 6378.137 as Kilometers;
  const f = 1 / 298.257223563;
  const e2 = 2 * f - f * f;
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);

  const x = (N + alt) * Math.cos(lat) * Math.cos(lon);
  const y = (N + alt) * Math.cos(lat) * Math.sin(lon);
  const z = (N * (1 - e2) + alt) * Math.sin(lat);

  return {
    x: <AltitudeUnits>x,
    y: <AltitudeUnits>y,
    z: <AltitudeUnits>z,
  };
}

/**
 * Converts geodetic coordinates (longitude, latitude, altitude) to Earth-Centered Earth-Fixed (ECEF) coordinates.
 * @param lla The geodetic coordinates in degrees and meters.
 * @returns The ECEF coordinates in meters.
 */
export function lla2ecef<AltitudeUnits extends number>(lla: LlaVec3<Degrees, AltitudeUnits>): EcefVec3<AltitudeUnits> {
  const { lon, lat, alt } = lla;

  const lonRad = lon * DEG2RAD;
  const latRad = lat * DEG2RAD;

  return llaRad2ecef({
    lon: lonRad as Radians,
    lat: latRad as Radians,
    alt,
  });
}

/**
 * Converts geodetic coordinates (lat/lon/alt) to TEME (True Equator Mean Equinox) coordinates.
 *
 * **Coordinate Frame Transformation: Geodetic → TEME**
 *
 * Converts WGS84 geodetic coordinates to inertial TEME coordinates via ECEF
 * and GMST rotation. Uses spherical Earth approximation (Earth.radiusMean).
 *
 * @variation cached - results are cached
 * @param lla - Geodetic coordinates (lat/lon in radians, alt in km)
 * @param gmst - Greenwich Mean Sidereal Time in radians
 * @returns TEME coordinates (inertial)
 */
export function lla2eci(lla: LlaVec3<Radians, Kilometers>, gmst: GreenwichMeanSiderealTime): TemeVec3<Kilometers> {
  const { lat, lon, alt } = lla;

  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosLon = Math.cos(lon + gmst);
  const sinLon = Math.sin(lon + gmst);
  const x = (Earth.radiusMean + alt) * cosLat * cosLon;
  const y = (Earth.radiusMean + alt) * cosLat * sinLon;
  const z = (Earth.radiusMean + alt) * sinLat;

  return { x, y, z } as TemeVec3<Kilometers>;
}

/**
 * Converts LLA to SEZ coordinates.
 * @see http://www.celestrak.com/columns/v02n02/
 * @param lla The LLA coordinates.
 * @param ecef The ECEF coordinates.
 * @returns The SEZ coordinates.
 */
export function lla2sez<D extends number>(lla: LlaVec3<Radians, D>, ecef: EcefVec3<D>): SezVec3<D> {
  const lon = lla.lon;
  const lat = lla.lat;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);

  const observerEcef = llaRad2ecef({
    lat,
    lon,
    alt: lla.alt,
  });

  const rx = ecef.x - observerEcef.x;
  const ry = ecef.y - observerEcef.y;
  const rz = ecef.z - observerEcef.z;

  // Top is short for topocentric
  const south = sinLat * cosLon * rx + sinLat * sinLon * ry - cosLat * rz;

  const east = -sinLon * rx + cosLon * ry;

  const zenith = cosLat * cosLon * rx + cosLat * sinLon * ry + sinLat * rz;

  return { s: <D>south, e: <D>east, z: <D>zenith };
}

/**
 * Converts a vector in Right Ascension, Elevation, and Range (RAE) coordinate system
 * to a vector in South, East, and Zenith (SEZ) coordinate system.
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
 * to Earth-Centered Earth-Fixed (ECEF) coordinate system.
 * @template D - The dimension of the RAE vector.
 * @template A - The dimension of the LLA vector.
 * @param rae - The vector in RAE coordinate system.
 * @param lla - The vector in LLA coordinate system.
 * @returns The vector in ECEF coordinate system.
 */
export function rae2ecef<D extends number>(rae: RaeVec3<D, Degrees>, lla: LlaVec3<Degrees, D>): EcefVec3<D> {
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

  const obsEcef = llaRad2ecef(llaRad);
  const sez = rae2sez(raeRad);

  // Some needed calculations
  const slat = Math.sin(llaRad.lat);
  const slon = Math.sin(llaRad.lon);
  const clat = Math.cos(llaRad.lat);
  const clon = Math.cos(llaRad.lon);

  const x = slat * clon * sez.s + -slon * sez.e + clat * clon * sez.z + obsEcef.x;
  const y = slat * slon * sez.s + clon * sez.e + clat * slon * sez.z + obsEcef.y;
  const z = -clat * sez.s + slat * sez.z + obsEcef.z;

  return { x, y, z } as EcefVec3<D>;
}

/**
 * Converts a vector from RAE (Range, Azimuth, Elevation) coordinates to ECI (Earth-Centered Inertial) coordinates.
 * @variation cached - results are cached
 * @param rae The vector in RAE coordinates.
 * @param lla The vector in LLA (Latitude, Longitude, Altitude) coordinates.
 * @param gmst The Greenwich Mean Sidereal Time.
 * @returns The vector in ECI coordinates.
 */
export function rae2eci<D extends number>(
  rae: RaeVec3<D, Degrees>,
  lla: LlaVec3<Degrees, D>,
  gmst: number,
): TemeVec3<D> {
  const ecef = rae2ecef(rae, lla);
  const eci = ecef2eci(ecef, gmst);

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
 * Converts South, East, and Zenith (SEZ) coordinates to Right Ascension, Elevation, and Range (RAE) coordinates.
 * @param sez The SEZ coordinates.
 * @returns Rng, Az, El array
 */
export function sez2rae<D extends number>(sez: SezVec3<D>): RaeVec3<D, Radians> {
  const rng = <D>Math.sqrt(sez.s * sez.s + sez.e * sez.e + sez.z * sez.z);
  const el = <Radians>Math.asin(sez.z / rng);
  const az = <Radians>(Math.atan2(-sez.e, sez.s) + PI);

  return { rng, az, el };
}

/**
 * Converts Earth-Centered Earth-Fixed (ECEF) coordinates to Right Ascension (RA),
 * Elevation (E), and Azimuth (A) coordinates.
 * @param lla The Latitude, Longitude, and Altitude (LLA) coordinates.
 * @param ecef The Earth-Centered Earth-Fixed (ECEF) coordinates.
 * @returns The Right Ascension (RA), Elevation (E), and Azimuth (A) coordinates.
 */
export function ecefRad2rae<D extends number>(lla: LlaVec3<Radians, D>, ecef: EcefVec3<D>): RaeVec3<D, Degrees> {
  const sezCoords = lla2sez(lla, ecef);
  const rae = sez2rae(sezCoords);

  return { rng: rae.rng, az: (rae.az * RAD2DEG) as Degrees, el: (rae.el * RAD2DEG) as Degrees };
}

/**
 * Converts Earth-Centered Earth-Fixed (ECEF) coordinates to Right Ascension (RA),
 * Elevation (E), and Azimuth (A) coordinates.
 * @variation cached - results are cached
 * @param lla The Latitude, Longitude, and Altitude (LLA) coordinates.
 * @param ecef The Earth-Centered Earth-Fixed (ECEF) coordinates.
 * @returns The Right Ascension (RA), Elevation (E), and Azimuth (A) coordinates.
 */
export function ecef2rae<D extends number>(lla: LlaVec3<Degrees, D>, ecef: EcefVec3<D>): RaeVec3<D, Degrees> {
  const { lat, lon } = lla;
  const latRad = (lat * DEG2RAD) as Radians;
  const lonRad = (lon * DEG2RAD) as Radians;
  const rae = ecefRad2rae({ lat: latRad, lon: lonRad, alt: lla.alt }, ecef);

  return rae;
}

export const jday = (year?: number, mon?: number, day?: number, hr?: number, minute?: number, sec?: number) => {
  if (typeof year === 'undefined') {
    const now = new Date();
    const jDayStart = new Date(now.getUTCFullYear(), 0, 0);
    const jDayDiff = now.getDate() - jDayStart.getDate();

    return Math.floor(jDayDiff / MILLISECONDS_TO_DAYS);
  }

  if (
    typeof mon === 'undefined' ||
    typeof day === 'undefined' ||
    typeof hr === 'undefined' ||
    typeof minute === 'undefined' ||
    typeof sec === 'undefined'
  ) {
    throw new Error('Invalid date');
  }

  return (
    367.0 * year -
    Math.floor(7 * (year + Math.floor((mon + 9) / 12.0)) * 0.25) +
    Math.floor((275 * mon) / 9.0) +
    day +
    1721013.5 +
    ((sec / 60.0 + minute) / 60.0 + hr) / 24.0
  );
};

/**
 * Calculates the Greenwich Mean Sidereal Time (GMST) for a given date.
 * @param date - The date for which to calculate the GMST.
 * @returns An object containing the GMST value and the Julian date.
 */
export function calcGmst(date: Date): { gmst: GreenwichMeanSiderealTime; j: number } {
  const j =
    jday(
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

/**
 * Converts ECI coordinates to RAE (Right Ascension, Azimuth, Elevation) coordinates.
 * @variation cached - results are cached
 * @param now - Current date and time.
 * @param eci - ECI coordinates of the satellite.
 * @param observer - Ground object or LLA coordinates of the observer.
 * @returns Object containing azimuth, elevation and range in degrees and kilometers respectively.
 */
export function eci2rae(
  now: Date,
  eci: TemeVec3<Kilometers>,
  observer: GroundObject | LlaVec3<Degrees, Kilometers>,
): RaeVec3<Kilometers, Degrees> {
  now = new Date(now);
  const { gmst } = calcGmst(now);

  const positionEcef = eci2ecef(eci, gmst);
  const lla = {
    lat: (observer.lat * DEG2RAD) as Radians,
    lon: (observer.lon * DEG2RAD) as Radians,
    alt: observer.alt,
  };

  const rae = ecefRad2rae(lla, positionEcef);

  return rae;
}

/**
 * Calculates the inertial azimuth of a satellite given its latitude and inclination.
 * @param lat - The latitude of the satellite in degrees.
 * @param inc - The inclination of the satellite in degrees.
 * @returns The inertial azimuth of the satellite in degrees.
 */
export function calcInertAz(lat: Degrees, inc: Degrees): Degrees {
  if (inc < lat) {
    throw new ValidationError(
      'Inclination must be greater than or equal to latitude',
      'inclination',
      { inclination: inc, latitude: lat },
    );
  }

  const phi = lat * DEG2RAD;
  const i = inc * DEG2RAD;

  const az = Math.asin(Math.cos(i) / Math.cos(phi));

  return <Degrees>(az * RAD2DEG);
}

/**
 * Calculates the inclination angle of a satellite from its launch azimuth and latitude.
 * @param lat - The latitude of the observer in degrees.
 * @param az - The launch azimuth angle of the satellite in degrees clockwise from north.
 * @returns The inclination angle of the satellite in degrees.
 */
export function calcIncFromAz(lat: number, az: number): number {
  if (az < 0 || az > 360) {
    throw new ValidationError('Azimuth must be between 0 and 360 degrees', 'azimuth', az);
  }

  const phi = lat * DEG2RAD;
  const beta = az * DEG2RAD;

  const inc = Math.acos(Math.sin(beta) * Math.cos(phi));

  return <Degrees>(inc * RAD2DEG);
}


/**
 * Converts Azimuth and Elevation to U and V.
 * Azimuth is the angle off of boresight in the horizontal plane.
 * Elevation is the angle off of boresight in the vertical plane.
 * Cone half angle is the angle of the cone of the radar max field of view.
 * @param az - Azimuth in radians
 * @param el - Elevation in radians
 * @param coneHalfAngle - Cone half angle in radians
 * @returns U and V in radians
 */
export function azel2uv(az: Radians, el: Radians, coneHalfAngle: Radians): { u: number; v: number } {
  if (az > coneHalfAngle && az < coneHalfAngle) {
    throw new ValidationError('Azimuth is out of bounds', 'azimuth', az);
  }

  if (el > coneHalfAngle && el < coneHalfAngle) {
    throw new ValidationError('Elevation is out of bounds', 'elevation', el);
  }

  const alpha = (az / (coneHalfAngle * RAD2DEG)) * 90;
  const beta = (el / (coneHalfAngle * RAD2DEG)) * 90;

  const u = Math.sin(alpha) as Radians;
  let v = -Math.sin(beta) as Radians;

  v = Object.is(v, -0) ? (0 as Radians) : v;

  return { u, v };
}

/**
 * Determine azimuth and elevation off of boresight based on sensor orientation and RAE.
 * @param rae Range, Azimuth, Elevation
 * @param sensor Phased array radar sensor object
 * @param face Face number of the sensor
 * @param maxSensorAz Maximum sensor azimuth
 * @returns Azimuth and Elevation off of boresight
 */
export function rae2raeOffBoresight(
  rae: RaeVec3,
  sensor: PhasedArrayRadar,
  face: number,
  maxSensorAz: Degrees,
): { az: Radians; el: Radians } {
  let az = (rae.az * DEG2RAD) as Radians;
  let el = (rae.el * DEG2RAD) as Radians;

  // Correct azimuth for sensor orientation.
  az = az > maxSensorAz * DEG2RAD ? ((az - TAU) as Radians) : az;

  az = (az - (sensor.boresightAz[face] * DEG2RAD)) as Radians;
  el = (el - (sensor.boresightEl[face] * DEG2RAD)) as Radians;

  return { az, el };
}

/**
 * Converts Range Az El to Range U V.
 * @param rae Range, Azimuth, Elevation
 * @param sensor Phased array radar sensor object
 * @param face Face number of the sensor
 * @param maxSensorAz Maximum sensor azimuth
 * @returns Range, U, V
 */
export function rae2ruv(rae: RaeVec3, sensor: PhasedArrayRadar, face: number, maxSensorAz: Degrees): RuvVec3 {
  const { az, el } = rae2raeOffBoresight(rae, sensor, face, maxSensorAz);
  const { u, v } = azel2uv(az, el, sensor.beamwidthRad);

  return { rng: rae.rng, u, v };
}

/**
 * Converts U and V to Azimuth and Elevation off of boresight.
 * @param u The U coordinate.
 * @param v The V coordinate.
 * @param coneHalfAngle The cone half angle of the radar.
 * @returns Azimuth and Elevation off of boresight.
 */
export function uv2azel(u: number, v: number, coneHalfAngle: Radians): { az: Radians; el: Radians } {
  if (u > 1 || u < -1) {
    throw new ValidationError('u must be between -1 and 1', 'u', u);
  }

  if (v > 1 || v < -1) {
    throw new ValidationError('v must be between -1 and 1', 'v', v);
  }

  const alpha = Math.asin(u) as Radians;
  const beta = Math.asin(v) as Radians;
  const az = ((alpha / 90) * (coneHalfAngle * RAD2DEG)) as Radians;
  const el = ((beta / 90) * (coneHalfAngle * RAD2DEG)) as Radians;

  return { az, el };
}

/**
 * Converts coordinates from East-North-Up (ENU) to Right-Front-Up (RF) coordinate system.
 * @param enu - The ENU coordinates to be converted.
 * @param enu.x - The east coordinate.
 * @param enu.y - The north coordinate.
 * @param enu.z - The up coordinate.
 * @param az - The azimuth angle in radians.
 * @param el - The elevation angle in radians.
 * @returns The converted RF coordinates.
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
