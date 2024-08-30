import {
  RfVec3, RuvVec3, DEG2RAD,
  Degrees,
  Earth,
  EcefVec3,
  EcfVec3,
  EciVec3,
  EnuVec3,
  GreenwichMeanSiderealTime,
  Kilometers,
  LlaVec3,
  MILLISECONDS_TO_DAYS,
  PI,
  RAD2DEG,
  Radians,
  RaeVec3, SezVec3,
  Sgp4,
  TAU,
  Vector3D,
} from '../main.js';
import { TransformCache } from './TransformCache.js';

/**
 * Converts ECF to ECI coordinates.
 *
 * [X]     [C -S  0][X]
 * [Y]  =  [S  C  0][Y]
 * [Z]eci  [0  0  1][Z]ecf
 * @param ecf takes xyz coordinates
 * @param gmst takes a number in gmst time
 * @returns array containing eci coordinates
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
export function ecf2enu<T extends number>(ecf: EcefVec3<T>, lla: LlaVec3<Degrees, T>): EnuVec3<T> {
  const { lat, lon } = lla;
  const { x, y, z } = ecf;
  const e = (-Math.sin(lon) * x + Math.cos(lon) * y) as T;
  const n = (-Math.sin(lat) * Math.cos(lon) * x - Math.sin(lat) * Math.sin(lon) * y + Math.cos(lat) * z) as T;
  const u = (Math.cos(lat) * Math.cos(lon) * x + Math.cos(lat) * Math.sin(lon) * y + Math.sin(lat) * z) as T;

  return { east: e, north: n, up: u };
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
 * @param eci takes xyz coordinates
 * @param gmst takes a number in gmst time
 * @returns array containing ecf coordinates
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
 * @variation cached - results are cached
 * @param eci takes xyz coordinates
 * @param gmst takes a number in gmst time
 * @returns array containing lla coordinates
 */
export function eci2lla(eci: EciVec3, gmst: number): LlaVec3<Degrees, Kilometers> {
  // Check cache
  const key = `${gmst},${eci.x},${eci.y},${eci.z}`;
  const cached = TransformCache.get(key);

  if (cached) {
    return cached as LlaVec3<Degrees, Kilometers>;
  }

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

  const lla = { lon: <Degrees>lon, lat: <Degrees>lat, alt: <Kilometers>alt };

  TransformCache.add(key, lla);

  return lla;
}

/**
 * Converts geodetic coordinates (longitude, latitude, altitude) to Earth-Centered Earth-Fixed (ECF) coordinates.
 * @param lla The geodetic coordinates in radians and meters.
 * @returns The ECF coordinates in meters.
 */
export function llaRad2ecf<AltitudeUnits extends number>(lla: LlaVec3<Radians, AltitudeUnits>): EcfVec3<AltitudeUnits> {
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
    x: <AltitudeUnits>x,
    y: <AltitudeUnits>y,
    z: <AltitudeUnits>z,
  };
}

/**
 * Converts geodetic coordinates (longitude, latitude, altitude) to Earth-Centered Earth-Fixed (ECF) coordinates.
 * @param lla The geodetic coordinates in degrees and meters.
 * @returns The ECF coordinates in meters.
 */
export function lla2ecf<AltitudeUnits extends number>(lla: LlaVec3<Degrees, AltitudeUnits>): EcfVec3<AltitudeUnits> {
  const { lon, lat, alt } = lla;

  const lonRad = lon * DEG2RAD;
  const latRad = lat * DEG2RAD;

  return llaRad2ecf({
    lon: lonRad as Radians,
    lat: latRad as Radians,
    alt,
  });
}

/**
 * Converts geodetic coordinates (latitude, longitude, altitude) to Earth-centered inertial (ECI) coordinates.
 * @variation cached - results are cached
 * @param lla The geodetic coordinates in radians and meters.
 * @param gmst The Greenwich Mean Sidereal Time in seconds.
 * @returns The ECI coordinates in meters.
 */
export function lla2eci(lla: LlaVec3<Radians, Kilometers>, gmst: GreenwichMeanSiderealTime): EciVec3<Kilometers> {
  // Check cache
  const key = `${gmst},${lla.lat},${lla.lon},${lla.alt}`;
  const cached = TransformCache.get(key);

  if (cached) {
    return cached as EciVec3<Kilometers>;
  }

  const { lat, lon, alt } = lla;

  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosLon = Math.cos(lon + gmst);
  const sinLon = Math.sin(lon + gmst);
  const x = (Earth.radiusMean + alt) * cosLat * cosLon;
  const y = (Earth.radiusMean + alt) * cosLat * sinLon;
  const z = (Earth.radiusMean + alt) * sinLat;

  const eci = { x, y, z } as EciVec3<Kilometers>;

  TransformCache.add(key, eci);

  return eci;
}

/**
 * Calculates Geodetic Lat Lon Alt to ECEF coordinates.
 * @deprecated This needs to be validated.
 * @param lla The geodetic coordinates in degrees and meters.
 * @returns The ECEF coordinates in meters.
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

export interface Orientation {
  azimuth: Degrees;
  elevation: Degrees;
  azimuth2?: Degrees;
  elevation2?: Degrees;
}

/**
 * Converts LLA to SEZ coordinates.
 * @see http://www.celestrak.com/columns/v02n02/
 * @param lla The LLA coordinates.
 * @param ecf The ECF coordinates.
 * @param orientation The orientation of the observer.
 * @returns The SEZ coordinates.
 */
export function lla2sez<D extends number>(
  lla: LlaVec3<Radians, D>,
  ecf: EcfVec3<D>,
  orientation: Orientation = { azimuth: 0 as Degrees, elevation: 0 as Degrees},
): SezVec3<D> {
  const lon = lla.lon;
  const lat = lla.lat;

  const observerEcf = llaRad2ecf({
    lat,
    lon,
    alt: <Kilometers>0,
  });

  const rx = ecf.x - observerEcf.x;
  const ry = ecf.y - observerEcf.y;
  const rz = ecf.z - observerEcf.z;

  // Calculate the rotation matrices for azimuth and elevation
  const cosAz = Math.cos(orientation.azimuth * DEG2RAD);
  const sinAz = Math.sin(orientation.azimuth * DEG2RAD);
  const cosEl = Math.cos(orientation.elevation * DEG2RAD);
  const sinEl = Math.sin(orientation.elevation * DEG2RAD);

  // Apply orientation rotations to the ECF vector
  const rxRotated = rx * cosAz * cosEl + ry * sinAz * cosEl + rz * sinEl;
  const ryRotated = -rx * sinAz + ry * cosAz;
  const rzRotated = -rx * cosAz * sinEl - ry * sinAz * sinEl + rz * cosEl;

  // Calculate SEZ coordinates
  const south = Math.sin(lat) * Math.cos(lon) * rxRotated + Math.sin(lat) * Math.sin(lon) * ryRotated - Math.cos(lat) * rzRotated;
  const east = -Math.sin(lon) * rxRotated + Math.cos(lon) * ryRotated;
  const zenith = Math.cos(lat) * Math.cos(lon) * rxRotated + Math.cos(lat) * Math.sin(lon) * ryRotated + Math.sin(lat) * rzRotated;

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
 * to Earth-Centered Fixed (ECF) coordinate system.
 * @template D - The dimension of the RAE vector.
 * @template A - The dimension of the LLA vector.
 * @param rae - The vector in RAE coordinate system.
 * @param lla - The vector in LLA coordinate system.
 * @param orientation - The orientation of the observer.
 * @returns The vector in ECF coordinate system.
 */
export function rae2ecf<D extends number>(
  rae: RaeVec3<D, Degrees>,
  lla: LlaVec3<Degrees, D>,
  orientation: Orientation = { azimuth: 0 as Degrees, elevation: 0 as Degrees},
): EcfVec3<D> {
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

  const obsEcf = llaRad2ecf(llaRad);

  // Convert RAE to local ENU coordinates
  const east = raeRad.rng * Math.cos(raeRad.el) * Math.sin(raeRad.az);
  const north = raeRad.rng * Math.cos(raeRad.el) * Math.cos(raeRad.az);
  const up = raeRad.rng * Math.sin(raeRad.el);

  const elevationRad = orientation.elevation * DEG2RAD; // Removed the negative sign
  const azimuthRad = orientation.azimuth * DEG2RAD;

  // Rotate around East axis (elevation)
  const eastAfterEl = east;
  const northAfterEl = north * Math.cos(elevationRad) - up * Math.sin(elevationRad); // Changed + to -
  const upAfterEl = north * Math.sin(elevationRad) + up * Math.cos(elevationRad); // Changed - to +

  // Rotate around Up axis (azimuth)
  const eastAfterAz = eastAfterEl * Math.cos(azimuthRad) - northAfterEl * Math.sin(azimuthRad);
  const northAfterAz = eastAfterEl * Math.sin(azimuthRad) + northAfterEl * Math.cos(azimuthRad);
  const upAfterAz = upAfterEl;

  // Convert local ENU to ECEF
  const slat = Math.sin(llaRad.lat);
  const clat = Math.cos(llaRad.lat);
  const slon = Math.sin(llaRad.lon);
  const clon = Math.cos(llaRad.lon);

  const x = -slat * clon * northAfterAz - slon * eastAfterAz + clat * clon * upAfterAz + obsEcf.x;
  const y = -slat * slon * northAfterAz + clon * eastAfterAz + clat * slon * upAfterAz + obsEcf.y;
  const z = clat * northAfterAz + slat * upAfterAz + obsEcf.z;

  return { x, y, z } as EcfVec3<D>;
}

/**
 * Converts a vector from RAE (Range, Azimuth, Elevation) coordinates to ECI (Earth-Centered Inertial) coordinates.
 * @variation cached - results are cached
 * @param rae The vector in RAE coordinates.
 * @param lla The vector in LLA (Latitude, Longitude, Altitude) coordinates.
 * @param gmst The Greenwich Mean Sidereal Time.
 * @param orientation The orientation of the observer.
 * @returns The vector in ECI coordinates.
 */
export function rae2eci<D extends number>(
  rae: RaeVec3<D, Degrees>,
  lla: LlaVec3<Degrees, D>,
  gmst: number,
  orientation: Orientation = { azimuth: 0 as Degrees, elevation: 0 as Degrees},
): EciVec3<D> {
  // Check cache
  const key = `${gmst},${rae.rng},${rae.az},${rae.el},${lla.lat},${lla.lon},${lla.alt},${orientation.azimuth},${orientation.elevation}`;
  const cached = TransformCache.get(key);

  if (cached) {
    return cached as EciVec3<D>;
  }

  const ecf = rae2ecf(rae, lla, orientation);
  const eci = ecf2eci(ecf, gmst);

  TransformCache.add(key, eci);

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

  return { east: e, north: n, up: u };
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
 * Converts Earth-Centered Fixed (ECF) coordinates to range, Azimuth, and Elevation (RAE) coordinates.
 * @param lla - The Latitude, Longitude, and Altitude (LLA) coordinates.
 * @param ecf - The Earth-Centered Fixed (ECF) coordinates.
 * @param orientation - The orientation of the observer.
 * @returns The range, azimuth, and elevation coordinates.
 */
export function ecfRad2rae<D extends number>(
  lla: LlaVec3<Radians, D>,
  ecf: EcfVec3<D>,
  orientation: Orientation = { azimuth: 0 as Degrees, elevation: 0 as Degrees },
): RaeVec3<D, Degrees> {
  // Convert ECEF to local ENU coordinates
  const enu = ecf2enu(ecf, {
    lat: lla.lat * RAD2DEG as Degrees,
    lon: lla.lon * RAD2DEG as Degrees,
    alt: lla.alt,
  });

  let enuVec = new Vector3D(enu.east, enu.north, enu.up);

  enuVec = enuVec.rotZ(orientation.azimuth * DEG2RAD as Radians);
  enuVec = enuVec.rotX(orientation.elevation * DEG2RAD as Radians);

  // Calculate range
  const rng = Math.sqrt(enuVec.x * enuVec.x + enuVec.y * enuVec.y + enuVec.z * enuVec.z);

  // Calculate azimuth
  let az = Math.atan2(enuVec.x, enuVec.y);

  // Calculate elevation
  let el = Math.asin(enuVec.z / rng);

  // Convert to degrees and normalize
  az = ((az * RAD2DEG + 360) % 360) as Degrees;
  el = (el * RAD2DEG) as Degrees;

  return { rng, az, el } as RaeVec3<D, Degrees>;
}

/**
 * Converts Earth-Centered Fixed (ECF) coordinates to Right Ascension (RA),
 * Elevation (E), and Azimuth (A) coordinates.
 * @variation cached - results are cached
 * @param originLla The Latitude, Longitude, and Altitude (LLA) coordinates.
 * @param targetEcf The Earth-Centered Fixed (ECF) coordinates.
 * @param orientation The orientation of the observer.
 * @returns The Right Ascension (RA), Elevation (E), and Azimuth (A) coordinates.
 */
export function ecf2rae<D extends number>(originLla: LlaVec3<Degrees, D>, targetEcf: EcfVec3<D>, orientation: Orientation = { azimuth: 0 as Degrees, elevation: 0 as Degrees}): RaeVec3<D, Degrees> {
  // Check cache
  const key = `${originLla.lat},${originLla.lon},${originLla.alt},${targetEcf.x},${targetEcf.y},${targetEcf.z},${orientation.azimuth},${orientation.elevation}`;
  const cached = TransformCache.get(key);

  if (cached) {
    return cached as RaeVec3<D, Degrees>;
  }

  const { lat, lon } = originLla;
  const latRad = (lat * DEG2RAD) as Radians;
  const lonRad = (lon * DEG2RAD) as Radians;

  const rae = ecfRad2rae({ lat: latRad, lon: lonRad, alt: originLla.alt }, targetEcf, orientation);

  TransformCache.add(key, rae);

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
 * @param observerLla - LLA coordinates of the observer.
 * @param observerOrientation - The orientation of the observer.
 * @returns Object containing azimuth, elevation and range in degrees and kilometers respectively.
 */
export function eci2rae(now: Date, eci: EciVec3<Kilometers>, observerLla: LlaVec3, observerOrientation: Orientation): RaeVec3<Kilometers, Degrees> {
  now = new Date(now);
  const { gmst } = calcGmst(now);

  // Check cache
  const key = `${gmst},${eci.x},${eci.y},${eci.z},${observerLla.lat},${observerLla.lon},${observerLla.alt}`;
  const cached = TransformCache.get(key);

  if (cached) {
    return cached as RaeVec3<Kilometers, Degrees>;
  }

  const targetEcf = eci2ecf(eci, gmst);
  const originLla = {
    lat: (observerLla.lat * DEG2RAD) as Radians,
    lon: (observerLla.lon * DEG2RAD) as Radians,
    alt: observerLla.alt,
  };

  const rae = ecfRad2rae(originLla, targetEcf, observerOrientation);

  TransformCache.add(key, rae);

  return rae;
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
 * Determine azimuth and elevation off of boresight based on sensor orientation and RAE.
 * @param rae Range, Azimuth, Elevation
 * @param orientation Sensor orientation
 * @param maxSensorAz Maximum sensor azimuth
 * @returns Azimuth and Elevation off of boresight
 */
export function rae2raeOffBoresight(
  rae: RaeVec3,
  orientation: Orientation,
  maxSensorAz: Degrees,
): { az: Radians; el: Radians } {
  let az = (rae.az * DEG2RAD) as Radians;
  let el = (rae.el * DEG2RAD) as Radians;

  // Correct azimuth for sensor orientation.
  az = az > maxSensorAz * DEG2RAD ? ((az - TAU) as Radians) : az;

  az = (az - (orientation.azimuth * DEG2RAD) as Radians);
  el = (el - (orientation.elevation * DEG2RAD) as Radians);

  return { az, el };
}

/**
 * Converts Range Az El to Range U V.
 * @param rae Range, Azimuth, Elevation
 * @param orientation Sensor orientation
 * @param beamwidth Beamwidth of the radar
 * @param maxSensorAz Maximum sensor azimuth
 * @returns Range, U, V
 */
export function rae2ruv(rae: RaeVec3, orientation: Orientation, beamwidth: Degrees, maxSensorAz: Degrees): RuvVec3 {
  const { az, el } = rae2raeOffBoresight(rae, orientation, maxSensorAz);
  const { u, v } = azel2uv(az, el, beamwidth * DEG2RAD as Radians);

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
 * Converts coordinates from East-North-Up (ENU) to Right-Front-Up (RF) coordinate system.
 * @param enu - The ENU coordinates to be converted.
 * @param enu.east - The east coordinate.
 * @param enu.north - The north coordinate.
 * @param enu.up - The up coordinate.
 * @param az - The azimuth angle in radians.
 * @param el - The elevation angle in radians.
 * @returns The converted RF coordinates.
 */
export function enu2rf<D extends number, A extends number = Radians>({ east, north, up }: EnuVec3<D>, az: A, el: A): RfVec3<D> {
  const xrf = Math.cos(el) * Math.cos(az) * east - Math.sin(az) * north + Math.sin(el) * Math.cos(az) * up;
  const yrf = Math.cos(el) * Math.sin(az) * east + Math.cos(az) * north + Math.sin(el) * Math.sin(az) * up;
  const zrf = -Math.sin(el) * east + Math.cos(el) * up;

  return {
    x: xrf as D,
    y: yrf as D,
    z: zrf as D,
  };
}
