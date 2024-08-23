import { RfVec3, RuvVec3, RfSensor, DEG2RAD,
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
  RaeVec3,
  Sensor,
  SezVec3,
  Sgp4,
  TAU} from '../main.js';
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

/**
 * Converts LLA to SEZ coordinates.
 * @see http://www.celestrak.com/columns/v02n02/
 * @param lla The LLA coordinates.
 * @param ecf The ECF coordinates.
 * @returns The SEZ coordinates.
 */
export function lla2sez<D extends number>(lla: LlaVec3<Radians, D>, ecf: EcfVec3<D>): SezVec3<D> {
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

  // Top is short for topocentric
  const south = Math.sin(lat) * Math.cos(lon) * rx + Math.sin(lat) * Math.sin(lon) * ry - Math.cos(lat) * rz;

  const east = -Math.sin(lon) * rx + Math.cos(lon) * ry;

  const zenith = Math.cos(lat) * Math.cos(lon) * rx + Math.cos(lat) * Math.sin(lon) * ry + Math.sin(lat) * rz;

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

  const obsEcf = llaRad2ecf(llaRad);
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
): EciVec3<D> {
  // Check cache
  const key = `${gmst},${rae.rng},${rae.az},${rae.el},${lla.lat},${lla.lon},${lla.alt}`;
  const cached = TransformCache.get(key);

  if (cached) {
    return cached as EciVec3<D>;
  }

  const ecf = rae2ecf(rae, lla);
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
 * Converts Earth-Centered Fixed (ECF) coordinates to Right Ascension (RA),
 * Elevation (E), and Azimuth (A) coordinates.
 * @param lla The Latitude, Longitude, and Altitude (LLA) coordinates.
 * @param ecf The Earth-Centered Fixed (ECF) coordinates.
 * @returns The Right Ascension (RA), Elevation (E), and Azimuth (A) coordinates.
 */
export function ecfRad2rae<D extends number>(lla: LlaVec3<Radians, D>, ecf: EcfVec3<D>): RaeVec3<D, Degrees> {
  const sezCoords = lla2sez(lla, ecf);
  const rae = sez2rae(sezCoords);

  return { rng: rae.rng, az: (rae.az * RAD2DEG) as Degrees, el: (rae.el * RAD2DEG) as Degrees };
}

/**
 * Converts Earth-Centered Fixed (ECF) coordinates to Right Ascension (RA),
 * Elevation (E), and Azimuth (A) coordinates.
 * @variation cached - results are cached
 * @param lla The Latitude, Longitude, and Altitude (LLA) coordinates.
 * @param ecf The Earth-Centered Fixed (ECF) coordinates.
 * @returns The Right Ascension (RA), Elevation (E), and Azimuth (A) coordinates.
 */
export function ecf2rae<D extends number>(lla: LlaVec3<Degrees, D>, ecf: EcfVec3<D>): RaeVec3<D, Degrees> {
  // Check cache
  const key = `${lla.lat},${lla.lon},${lla.alt},${ecf.x},${ecf.y},${ecf.z}`;
  const cached = TransformCache.get(key);

  if (cached) {
    return cached as RaeVec3<D, Degrees>;
  }

  const { lat, lon } = lla;
  const latRad = (lat * DEG2RAD) as Radians;
  const lonRad = (lon * DEG2RAD) as Radians;
  const rae = ecfRad2rae({ lat: latRad, lon: lonRad, alt: lla.alt }, ecf);

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
 * @param sensor - Sensor object containing observer's geodetic coordinates.
 * @returns Object containing azimuth, elevation and range in degrees and kilometers respectively.
 */
export function eci2rae(now: Date, eci: EciVec3<Kilometers>, sensor: Sensor): RaeVec3<Kilometers, Degrees> {
  now = new Date(now);
  const { gmst } = calcGmst(now);

  // Check cache
  const key = `${gmst},${eci.x},${eci.y},${eci.z},${sensor.lat},${sensor.lon},${sensor.alt}`;
  const cached = TransformCache.get(key);

  if (cached) {
    return cached as RaeVec3<Kilometers, Degrees>;
  }

  const positionEcf = eci2ecf(eci, gmst);
  const lla = {
    lat: (sensor.lat * DEG2RAD) as Radians,
    lon: (sensor.lon * DEG2RAD) as Radians,
    alt: sensor.alt,
  };

  const rae = ecfRad2rae(lla, positionEcf);

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
 * @param sensor Radar sensor object
 * @param face Face number of the sensor
 * @param maxSensorAz Maximum sensor azimuth
 * @returns Azimuth and Elevation off of boresight
 */
export function rae2raeOffBoresight(
  rae: RaeVec3,
  sensor: RfSensor,
  face: number,
  maxSensorAz: Degrees,
): { az: Radians; el: Radians } {
  let az = (rae.az * DEG2RAD) as Radians;
  let el = (rae.el * DEG2RAD) as Radians;

  // Correct azimuth for sensor orientation.
  az = az > maxSensorAz * DEG2RAD ? ((az - TAU) as Radians) : az;

  az = (az - sensor.boresightAz[face]) as Radians;
  el = (el - sensor.boresightEl[face]) as Radians;

  return { az, el };
}

/**
 * Converts Range Az El to Range U V.
 * @param rae Range, Azimuth, Elevation
 * @param sensor Radar sensor object
 * @param face Face number of the sensor
 * @param maxSensorAz Maximum sensor azimuth
 * @returns Range, U, V
 */
export function rae2ruv(rae: RaeVec3, sensor: RfSensor, face: number, maxSensorAz: Degrees): RuvVec3 {
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
