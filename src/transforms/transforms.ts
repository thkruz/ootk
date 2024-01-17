import { DEG2RAD, Degrees, EnuVec3, RAD2DEG, Radians, RaeVec3, TAU } from 'ootk-core';
import { RfSensor } from 'src/objects/RfSensor';
import { RfVec3, RuvVec3 } from 'src/types/types';

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
 * @param maxSensorAz Maximum sensor azimuth
 * @returns Azimuth and Elevation off of boresight
 */
export function rae2raeOffBoresight(
  rae: RaeVec3,
  sensor: RfSensor,
  maxSensorAz: Degrees,
): { az: Radians; el: Radians } {
  let az = (rae.az * DEG2RAD) as Radians;
  let el = (rae.el * DEG2RAD) as Radians;

  // Correct azimuth for sensor orientation.
  az = az > maxSensorAz * DEG2RAD ? ((az - TAU) as Radians) : az;

  az = (az - sensor.boresightAz) as Radians;
  el = (el - sensor.boresightEl) as Radians;

  return { az, el };
}

/**
 * Converts Range Az El to Range U V.
 * @param rae Range, Azimuth, Elevation
 * @param sensor Radar sensor object
 * @param maxSensorAz Maximum sensor azimuth
 * @returns Range, U, V
 */
export function rae2ruv(rae: RaeVec3, sensor: RfSensor, maxSensorAz: Degrees): RuvVec3 {
  const { az, el } = rae2raeOffBoresight(rae, sensor, maxSensorAz);
  const { u, v } = azel2uv(az, el, sensor.coneHalfAngleRad);

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
