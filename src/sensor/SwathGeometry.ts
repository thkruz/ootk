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

/**
 * Ground swath geometry for a nadir-pointing imager.
 *
 * Every function is pure. Positions may be given in any Earth-centred frame that
 * differs from ECEF only by a rotation about the z axis (ECEF itself, or TEME/ECI
 * for the instantaneous geometry), because the WGS84 ellipsoid is symmetric about z.
 * Velocities are NOT interchangeable: an inertial velocity differs from the
 * Earth-fixed one by omega x r, which tilts the along-track direction (about
 * 3.5 deg of heading for a 98 deg LEO at the equator, roughly 30 km of along-track
 * shift at the edge of a 1000 km swath). Pass an Earth-fixed (ECEF) velocity when
 * the swath must follow the ground track. Distances are km, angles radians.
 */

import { Radians } from '../types/types';

/** Minimal 3-vector accepted and returned by the swath helpers (km or unitless). */
export interface SwathVec3 {
  x: number;
  y: number;
  z: number;
}

/** Local orbital frame of one sample: geodetic up, nadir, along-track and cross-track right. */
export interface SwathFrame {
  up: SwathVec3;
  nadir: SwathVec3;
  along: SwathVec3;
  right: SwathVec3;
}

/** One run of constant daylight state, as inclusive sample indices. */
export interface SwathRun {
  lit: boolean;
  i0: number;
  i1: number;
}

/** WGS84 semi-major axis (km). */
export const WGS84_A_KM = 6378.137;
/** WGS84 flattening. */
export const WGS84_F = 1 / 298.257223563;
/** WGS84 semi-minor axis (km). */
export const WGS84_B_KM = WGS84_A_KM * (1 - WGS84_F);
/** WGS84 first eccentricity squared. */
export const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F;
/** Mean Earth radius used by the swath-width to FOV conversion (km, IUGG R1). */
export const SWATH_MEAN_EARTH_RADIUS_KM = 6371.0088;
/** Margin kept between a look half-angle and the geometric horizon (0.2 deg). */
export const SWATH_HORIZON_MARGIN_RAD = (0.2 * Math.PI) / 180;

const A2_ = WGS84_A_KM * WGS84_A_KM;
const B2_ = WGS84_B_KM * WGS84_B_KM;

/*
 * Module scratch so the *Into variants run allocation-free in per-frame paths.
 * [0..2] up, [3..5] along, [6..8] right, [9] geodetic latitude.
 */
const frame_ = new Float64Array(10);
const hit_ = new Float64Array(3);

/**
 * Geodetic latitude (rad) of an Earth-centred position, by fixed-point iteration
 * on the WGS84 ellipsoid (converges to well under 1e-12 rad in 6 rounds for LEO-GEO).
 */
export function geodeticLatitudeRad(x: number, y: number, z: number): number {
  const p = Math.sqrt(x * x + y * y);

  if (p < 1e-9) {
    return z >= 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  let lat = Math.atan2(z, p * (1 - WGS84_E2));

  for (let i = 0; i < 6; i++) {
    const sinLat = Math.sin(lat);
    const n = WGS84_A_KM / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
    const h = p / Math.cos(lat) - n;

    lat = Math.atan2(z, p * (1 - (WGS84_E2 * n) / (n + h)));
  }

  return lat;
}

/**
 * Writes the swath frame for (r, v) into the module scratch. Returns false when the
 * velocity is parallel to up (no along-track direction).
 */
const frameInto_ = (rx: number, ry: number, rz: number, vx: number, vy: number, vz: number): boolean => {
  const lat = geodeticLatitudeRad(rx, ry, rz);
  const lon = Math.atan2(ry, rx);
  const cosLat = Math.cos(lat);
  const ux = cosLat * Math.cos(lon);
  const uy = cosLat * Math.sin(lon);
  const uz = Math.sin(lat);
  const vDotU = vx * ux + vy * uy + vz * uz;
  let ax = vx - vDotU * ux;
  let ay = vy - vDotU * uy;
  let az = vz - vDotU * uz;
  const aLen = Math.sqrt(ax * ax + ay * ay + az * az);

  if (!(aLen > 1e-12)) {
    return false;
  }
  ax /= aLen;
  ay /= aLen;
  az /= aLen;

  // right = along x up (unit: along is perpendicular to up)
  frame_[0] = ux;
  frame_[1] = uy;
  frame_[2] = uz;
  frame_[3] = ax;
  frame_[4] = ay;
  frame_[5] = az;
  frame_[6] = ay * uz - az * uy;
  frame_[7] = az * ux - ax * uz;
  frame_[8] = ax * uy - ay * ux;
  frame_[9] = lat;

  return true;
};

/**
 * Local frame of a sample: `up` is the WGS84 geodetic normal under the satellite,
 * `along` the velocity projected onto the local horizontal, `right = along x up`.
 * `vEcefKm` must be the Earth-fixed velocity for a ground-track-aligned frame; an inertial
 * velocity rotates `along` by the omega x r term (see the module note).
 * @throws {Error} when the velocity has no horizontal component.
 */
export function swathFrame(rEcefKm: SwathVec3, vEcefKm: SwathVec3): SwathFrame {
  if (!frameInto_(rEcefKm.x, rEcefKm.y, rEcefKm.z, vEcefKm.x, vEcefKm.y, vEcefKm.z)) {
    throw new Error('swathFrame: velocity has no horizontal component');
  }

  return {
    up: { x: frame_[0], y: frame_[1], z: frame_[2] },
    nadir: { x: -frame_[0], y: -frame_[1], z: -frame_[2] },
    along: { x: frame_[3], y: frame_[4], z: frame_[5] },
    right: { x: frame_[6], y: frame_[7], z: frame_[8] },
  };
}

/** WGS84 geocentric radius (km) at a geodetic latitude. */
export function localRadiusKm(latRad: number): number {
  const c = Math.cos(latRad);
  const s = Math.sin(latRad);
  const num = (A2_ * c) ** 2 + (B2_ * s) ** 2;
  const den = (WGS84_A_KM * c) ** 2 + (WGS84_B_KM * s) ** 2;

  return Math.sqrt(num / den);
}

const horizonFromLat_ = (rMag: number, lat: number): number => Math.asin(Math.min(Math.max(localRadiusKm(lat) / rMag, 0), 1));

/** Off-nadir angle (rad) of the geometric horizon seen from `rEcefKm`. */
export function horizonHalfAngleRad(rEcefKm: SwathVec3): number {
  const { x, y, z } = rEcefKm;

  return horizonFromLat_(Math.sqrt(x * x + y * y + z * z), geodeticLatitudeRad(x, y, z));
}

/**
 * Full sensor FOV (rad) that images a ground swath `widthKm` wide from `altKm`,
 * on a sphere of radius {@link SWATH_MEAN_EARTH_RADIUS_KM}.
 *
 * With R the sphere radius, h the altitude and lambda = width / (2R) the Earth central
 * half-angle of the swath, the look half-angle is atan2(sin lambda, (R + h)/R - cos lambda).
 * The widest swath visible from altitude h ends at the geometric horizon,
 * lambda_max = acos(R / (R + h)); wider requests have no line of sight and return NaN, as do
 * negative widths and non-positive altitudes. Callers that want the horizon-limited FOV
 * instead should clamp `widthKm` to 2 R acos(R / (R + h)) first.
 *
 * @param widthKm - Ground swath width (km)
 * @param altKm - Altitude above the sphere (km)
 * @returns Full FOV in radians, or NaN when the swath extends past the horizon
 */
export function fovFromSwathWidth(widthKm: number, altKm: number): Radians {
  const r = SWATH_MEAN_EARTH_RADIUS_KM;
  const lam = widthKm / (2 * r);

  if (!(widthKm >= 0) || !(altKm > 0) || lam > Math.acos(r / (r + altKm))) {
    return Number.NaN as Radians;
  }

  return (2 * Math.atan2(Math.sin(lam), (r + altKm) / r - Math.cos(lam))) as Radians;
}

/** Inverse of {@link fovFromSwathWidth}: ground swath width (km) for a full FOV (rad). */
export function swathWidthFromFov(fovRad: number, altKm: number): number {
  const r = SWATH_MEAN_EARTH_RADIUS_KM;
  const half = fovRad / 2;
  const s = ((r + altKm) / r) * Math.sin(half);

  if (s >= 1) {
    return Number.NaN;
  }

  return 2 * r * (Math.asin(s) - half);
}

/** Ray/ellipsoid intersection into the module scratch; false on a miss or a hit behind the origin. */
const rayHitInto_ = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): boolean => {
  const px = ox / WGS84_A_KM;
  const py = oy / WGS84_A_KM;
  const pz = oz / WGS84_B_KM;
  const qx = dx / WGS84_A_KM;
  const qy = dy / WGS84_A_KM;
  const qz = dz / WGS84_B_KM;
  const qa = qx * qx + qy * qy + qz * qz;
  const qb = 2 * (px * qx + py * qy + pz * qz);
  const qc = px * px + py * py + pz * pz - 1;
  const disc = qb * qb - 4 * qa * qc;

  // A grazing ray rounds to a slightly negative discriminant; treat it as tangent.
  if (disc < -1e-12 * qb * qb) {
    return false;
  }
  const t = (-qb - Math.sqrt(Math.max(disc, 0))) / (2 * qa);

  if (!(t >= 0)) {
    return false;
  }
  hit_[0] = ox + t * dx;
  hit_[1] = oy + t * dy;
  hit_[2] = oz + t * dz;

  return true;
};

/** First intersection of a ray with the WGS84 ellipsoid, or null when it misses or points away. */
export function rayEllipsoidHit(originKm: SwathVec3, dirUnit: SwathVec3): SwathVec3 | null {
  if (!rayHitInto_(originKm.x, originKm.y, originKm.z, dirUnit.x, dirUnit.y, dirUnit.z)) {
    return null;
  }

  return { x: hit_[0], y: hit_[1], z: hit_[2] };
}

/**
 * Allocation-free cross-track edges. Writes the left ground point to out[0..2] and the
 * right one to out[3..5] (km, same frame as r). Returns 1 when the angle was clamped
 * to the horizon, 0 when not, and -1 when no frame or hit exists (out untouched).
 */
export function crossTrackEdgesInto(rx: number, ry: number, rz: number, vx: number, vy: number, vz: number, halfAngleRad: number, out: Float64Array | Float32Array): -1 | 0 | 1 {
  if (!frameInto_(rx, ry, rz, vx, vy, vz)) {
    return -1;
  }
  const rMag = Math.sqrt(rx * rx + ry * ry + rz * rz);
  const limit = horizonFromLat_(rMag, frame_[9]) - SWATH_HORIZON_MARGIN_RAD;
  let theta = halfAngleRad;
  let clamped: 0 | 1 = 0;

  if (theta > limit) {
    theta = Math.max(limit, 0);
    clamped = 1;
  }

  // The horizon uses the sub-satellite radius; on a strongly tilted look the far edge can still
  // graze past the ellipsoid, so back off until both rays hit.
  for (let attempt = 0; attempt < 20; attempt++) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    // nadir = -up; L = c * nadir -/+ s * right
    const nx = -frame_[0] * c;
    const ny = -frame_[1] * c;
    const nz = -frame_[2] * c;
    const sx = frame_[6] * s;
    const sy = frame_[7] * s;
    const sz = frame_[8] * s;

    if (rayHitInto_(rx, ry, rz, nx - sx, ny - sy, nz - sz)) {
      const lx = hit_[0];
      const ly = hit_[1];
      const lz = hit_[2];

      if (rayHitInto_(rx, ry, rz, nx + sx, ny + sy, nz + sz)) {
        out[0] = lx;
        out[1] = ly;
        out[2] = lz;
        out[3] = hit_[0];
        out[4] = hit_[1];
        out[5] = hit_[2];

        return clamped;
      }
    }
    theta *= 0.95;
    clamped = 1;
  }

  return -1;
}

const edges_ = new Float64Array(6);

/**
 * Ground points of the two cross-track edges at off-nadir half-angle `halfAngleRad`
 * (left = -right side). The angle is clamped to 0.2 deg inside the horizon; `clamped`
 * reports whether that happened.
 * @throws {Error} when the velocity has no horizontal component.
 */
export function crossTrackEdges(rEcefKm: SwathVec3, vEcefKm: SwathVec3, halfAngleRad: number): { left: SwathVec3; right: SwathVec3; clamped: boolean } {
  const res = crossTrackEdgesInto(rEcefKm.x, rEcefKm.y, rEcefKm.z, vEcefKm.x, vEcefKm.y, vEcefKm.z, halfAngleRad, edges_);

  if (res === -1) {
    throw new Error('crossTrackEdges: no valid frame or ground hit');
  }

  return {
    left: { x: edges_[0], y: edges_[1], z: edges_[2] },
    right: { x: edges_[3], y: edges_[4], z: edges_[5] },
    clamped: res === 1,
  };
}

/**
 * Whether the Sun stands at least `minSunElevRad` above the horizon at the sub-satellite
 * point. `sunEcefUnit` must be a unit vector in the same frame as `rEcefKm`.
 */
export function subpointLit(rEcefKm: SwathVec3, sunEcefUnit: SwathVec3, minSunElevRad: number): boolean {
  const lat = geodeticLatitudeRad(rEcefKm.x, rEcefKm.y, rEcefKm.z);
  const lon = Math.atan2(rEcefKm.y, rEcefKm.x);
  const cosLat = Math.cos(lat);
  const dot = cosLat * Math.cos(lon) * sunEcefUnit.x + cosLat * Math.sin(lon) * sunEcefUnit.y + Math.sin(lat) * sunEcefUnit.z;

  return dot >= Math.sin(minSunElevRad);
}

/**
 * Splits per-sample daylight flags into runs of constant state. Adjacent runs share
 * their boundary sample so strips drawn from them leave no gap; a null flag (no valid
 * sample) ends the current run without sharing. Runs shorter than two samples are dropped.
 */
export function splitRuns(flags: readonly (boolean | null)[]): SwathRun[] {
  const runs: SwathRun[] = [];
  let start = -1;
  let state = false;

  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];

    if (f === null) {
      if (start >= 0 && i - 1 - start >= 1) {
        runs.push({ lit: state, i0: start, i1: i - 1 });
      }
      start = -1;
      continue;
    }
    if (start < 0) {
      start = i;
      state = f;
      continue;
    }
    if (f !== state) {
      if (i - 1 - start >= 1) {
        runs.push({ lit: state, i0: start, i1: i - 1 });
      }
      start = i - 1;
      state = f;
    }
  }
  if (start >= 0 && flags.length - 1 - start >= 1) {
    runs.push({ lit: state, i0: start, i1: flags.length - 1 });
  }

  return runs;
}
