/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
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

import { Kilometers } from '../types/types';
import { WGS84_A, WGS84_B } from '../utils/constants';

/**
 * WGS84 ellipsoid geometry helpers. All vectors are Earth-centered with the polar axis along z
 * (ECEF, or TEME/J2000 when treating the polar axis as z), in kilometers unless noted.
 * The scaled-space approach (stretch z by a/b so the ellipsoid becomes a sphere of radius a)
 * and the surface projection follow CesiumJS (`Ellipsoid.scaleToGeodeticSurface`).
 */

/** A plain 3-vector; any `Vec3`, `Vector3D`-like or `{x, y, z}` object satisfies it. */
export interface EllipsoidVec3 {
  x: number;
  y: number;
  z: number;
}

const INV_A2_ = 1 / (WGS84_A * WGS84_A);
const INV_B2_ = 1 / (WGS84_B * WGS84_B);
const Z_SCALE_ = WGS84_A / WGS84_B;
const NEWTON_TOLERANCE_ = 1e-12;
const NEWTON_MAX_ITERATIONS_ = 50;
/** Points whose ellipsoid-normalized squared norm is below this use the radial projection. */
const CENTER_TOLERANCE_SQUARED_ = 0.1;

/**
 * Outward geodetic surface normal at a point (normalized gradient of the ellipsoid equation).
 * @param p - Point on or near the ellipsoid
 * @param out - Optional output vector
 * @returns Unit normal (cos(lat)cos(lon), cos(lat)sin(lon), sin(lat)); the zero vector at the center
 */
export function geodeticSurfaceNormal<T extends EllipsoidVec3 = EllipsoidVec3>(p: EllipsoidVec3, out?: T): T {
  const x = p.x * INV_A2_;
  const y = p.y * INV_A2_;
  const z = p.z * INV_B2_;
  const len = Math.sqrt(x * x + y * y + z * z);
  const result = out ?? ({ x: 0, y: 0, z: 0 } as T);
  const inv = len > 0 ? 1 / len : 0;

  result.x = x * inv;
  result.y = y * inv;
  result.z = z * inv;

  return result;
}

interface NewtonState_ {
  xm: number;
  ym: number;
  zm: number;
}

/** Newton iteration for the Lagrange multiplier of the nearest-point problem (Cesium). */
function solveNearestPoint_(x2: number, y2: number, z2: number, lambda0: number): NewtonState_ {
  let lambda = lambda0;
  let correction = 0;
  let xm = 1;
  let ym = 1;
  let zm = 1;

  for (let i = 0; i < NEWTON_MAX_ITERATIONS_; i++) {
    lambda -= correction;
    xm = 1 / (1 + lambda * INV_A2_);
    ym = xm;
    zm = 1 / (1 + lambda * INV_B2_);
    const func = x2 * xm * xm + y2 * ym * ym + z2 * zm * zm - 1;

    if (Math.abs(func) <= NEWTON_TOLERANCE_) {
      break;
    }
    const denominator = x2 * xm ** 3 * INV_A2_ + y2 * ym ** 3 * INV_A2_ + z2 * zm ** 3 * INV_B2_;

    correction = func / (-2 * denominator);
  }

  return { xm, ym, zm };
}

/**
 * Nearest point on the WGS84 surface along the geodetic normal (CesiumJS algorithm).
 * @param p - Any point
 * @param out - Optional output vector
 * @returns The point on the surface, or null when `p` is non-finite or the center of the Earth
 */
export function scaleToGeodeticSurface<T extends EllipsoidVec3 = EllipsoidVec3>(p: EllipsoidVec3, out?: T): T | null {
  const x2 = p.x * p.x * INV_A2_;
  const y2 = p.y * p.y * INV_A2_;
  const z2 = p.z * p.z * INV_B2_;
  const squaredNorm = x2 + y2 + z2;
  const ratio = Math.sqrt(1 / squaredNorm);

  if (!Number.isFinite(ratio)) {
    return null;
  }
  const result = out ?? ({ x: 0, y: 0, z: 0 } as T);

  if (squaredNorm < CENTER_TOLERANCE_SQUARED_) {
    result.x = p.x * ratio;
    result.y = p.y * ratio;
    result.z = p.z * ratio;

    return result;
  }

  const gx = p.x * ratio * INV_A2_ * 2;
  const gy = p.y * ratio * INV_A2_ * 2;
  const gz = p.z * ratio * INV_B2_ * 2;
  const pNorm = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  const lambda0 = ((1 - ratio) * pNorm) / (0.5 * Math.sqrt(gx * gx + gy * gy + gz * gz));
  const s = solveNearestPoint_(x2, y2, z2, lambda0);

  result.x = p.x * s.xm;
  result.y = p.y * s.ym;
  result.z = p.z * s.zm;

  return result;
}

/**
 * Projects a point onto the WGS84 surface and lifts it along the geodetic normal.
 * @param p - Any point
 * @param liftKm - Height above the ellipsoid in km
 * @param out - Optional output vector
 * @returns The lifted point; a copy of `p` when it cannot be projected (Earth center)
 */
export function liftToEllipsoid<T extends EllipsoidVec3 = EllipsoidVec3>(p: EllipsoidVec3, liftKm: number, out?: T): T {
  const result = out ?? ({ x: 0, y: 0, z: 0 } as T);
  const surface = scaleToGeodeticSurface(p);

  if (!surface) {
    result.x = p.x;
    result.y = p.y;
    result.z = p.z;

    return result;
  }
  const n = geodeticSurfaceNormal(surface);

  result.x = surface.x + n.x * liftKm;
  result.y = surface.y + n.y * liftKm;
  result.z = surface.z + n.z * liftKm;

  return result;
}

/**
 * Geocentric distance from the Earth center to the WGS84 surface along a direction.
 * @param dirUnit - Unit direction from the center
 * @returns Radius in km (6378.137 on the equator, 6356.752 over the poles)
 */
export function ellipsoidRadiusAlong(dirUnit: EllipsoidVec3): Kilometers {
  const xy2 = dirUnit.x * dirUnit.x + dirUnit.y * dirUnit.y;

  return (1 / Math.sqrt(xy2 * INV_A2_ + dirUnit.z * dirUnit.z * INV_B2_)) as Kilometers;
}

/**
 * Ray versus WGS84 ellipsoid (z scaled by a/b, then ray versus sphere of radius a).
 * @param origin - Ray origin
 * @param dirUnit - Unit ray direction, so `near` and `far` are distances in km
 * @returns Distances along the ray to the entry and exit points (negative when behind the origin), or null on a miss
 */
export function rayEllipsoidIntersection(origin: EllipsoidVec3, dirUnit: EllipsoidVec3): { near: number; far: number } | null {
  const oz = origin.z * Z_SCALE_;
  const dz = dirUnit.z * Z_SCALE_;
  const a = dirUnit.x * dirUnit.x + dirUnit.y * dirUnit.y + dz * dz;

  if (a === 0) {
    return null;
  }
  const b = origin.x * dirUnit.x + origin.y * dirUnit.y + oz * dz;
  const c = origin.x * origin.x + origin.y * origin.y + oz * oz - WGS84_A * WGS84_A;
  const disc = b * b - a * c;

  if (disc < 0) {
    return null;
  }
  const root = Math.sqrt(disc);

  return { near: (-b - root) / a, far: (-b + root) / a };
}

/** True when the chord [t1, t2] shares any parameter with the segment [0, 1]. */
function intervalOverlapsSegment_(t1: number, t2: number): boolean {
  return t1 <= 1 && t2 >= 0;
}

/**
 * Whether the segment p1-p2 passes through the WGS84 ellipsoid (grazing contact counts as a hit).
 * @param p1 - Segment start
 * @param p2 - Segment end
 * @returns True if any part of the segment is inside or touches the ellipsoid
 */
export function segmentIntersectsEllipsoid(p1: EllipsoidVec3, p2: EllipsoidVec3): boolean {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = (p2.z - p1.z) * Z_SCALE_;
  const oz = p1.z * Z_SCALE_;
  const a = dx * dx + dy * dy + dz * dz;
  const b = p1.x * dx + p1.y * dy + oz * dz;
  const c = p1.x * p1.x + p1.y * p1.y + oz * oz - WGS84_A * WGS84_A;

  if (a === 0) {
    return c <= 0;
  }
  const disc = b * b - a * c;

  if (disc < 0) {
    return false;
  }
  const root = Math.sqrt(disc);

  return intervalOverlapsSegment_((-b - root) / a, (-b + root) / a);
}
