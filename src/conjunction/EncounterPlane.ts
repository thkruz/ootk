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

import type { RicSigmas } from '../covariance/displayRadii';

/**
 * Encounter plane (conjunction "B-plane") geometry helpers.
 *
 * The encounter plane is the plane through the primary that is normal to the relative velocity
 * (secondary minus primary) at the time of closest approach. For a short encounter the relative
 * motion is close to a straight line along that normal, so every sample of the pass projects to
 * nearly the same point in the plane: the miss vector. That is what conjunction plots and the
 * 2D probability of collision work in.
 *
 * All functions are frame-agnostic: pass the relative position and velocity in any Cartesian
 * frame and the basis comes back in the same frame. KeepTrack passes the primary's RIC frame
 * (x = radial, y = in-track, z = cross-track).
 *
 * ## Axis convention
 *
 * - `normal` (n) = relative velocity / |relative velocity|.
 * - `xAxis` = the reference axis with its component along n removed, normalised. The default
 *   reference is the radial axis [1, 0, 0] of the RIC frame, so `xAxis` is "radial as seen in the
 *   plane": a miss that is purely radial plots on the +x axis at the miss distance. When the
 *   relative velocity is (nearly) parallel to the reference, the fallback reference is the
 *   cross-track axis [0, 0, 1].
 * - `yAxis` = n x xAxis, so (xAxis, yAxis, normal) is right-handed. For a head-on pass along
 *   in-track (relative velocity along -I) `yAxis` is +cross-track.
 */

/** Minimal 3-vector shape; ootk `Vector3D` satisfies it. */
export interface EncounterPlaneVec3 {
  x: number;
  y: number;
  z: number;
}

/** Orthonormal encounter-plane basis expressed in the input frame. */
export interface EncounterPlaneBasis {
  /** First in-plane axis (the reference axis projected into the plane). */
  xAxis: EncounterPlaneVec3;
  /** Second in-plane axis, normal x xAxis. */
  yAxis: EncounterPlaneVec3;
  /** Plane normal, along the relative velocity. */
  normal: EncounterPlaneVec3;
}

/** A point in the encounter plane (km when the input was km). */
export interface EncounterPlanePoint {
  x: number;
  y: number;
}

/** 1-sigma ellipse in the encounter plane. */
export interface EncounterPlaneEllipse {
  /** Semi-major axis (same units as the sigmas). */
  semiMajor: number;
  /** Semi-minor axis (same units as the sigmas). */
  semiMinor: number;
  /** Angle of the semi-major axis from the plane's +x axis toward +y, radians. */
  angleRad: number;
  /** The projected 2x2 covariance [[xx, xy], [xy, yy]]. */
  covariance: [[number, number], [number, number]];
}

/** Radial axis of the RIC frame; the default reference for the in-plane x axis. */
export const ENCOUNTER_PLANE_RADIAL_REFERENCE: Readonly<EncounterPlaneVec3> = Object.freeze({ x: 1, y: 0, z: 0 });
/** Fallback reference (cross-track) when the relative velocity is parallel to radial. */
export const ENCOUNTER_PLANE_FALLBACK_REFERENCE: Readonly<EncounterPlaneVec3> = Object.freeze({ x: 0, y: 0, z: 1 });

/** Below this relative speed there is no meaningful encounter plane. */
const MIN_REL_SPEED = 1e-12;
/** Below this in-plane reference length the reference is treated as parallel to the normal. */
const PARALLEL_TOLERANCE = 1e-6;

const dot_ = (a: EncounterPlaneVec3, b: EncounterPlaneVec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const norm_ = (a: EncounterPlaneVec3): number => Math.sqrt(dot_(a, a));
const scale_ = (a: EncounterPlaneVec3, s: number): EncounterPlaneVec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const sub_ = (a: EncounterPlaneVec3, b: EncounterPlaneVec3): EncounterPlaneVec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross_ = (a: EncounterPlaneVec3, b: EncounterPlaneVec3): EncounterPlaneVec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** Removes the component of `ref` along unit vector `n`; returns null if what is left is too short. */
const inPlaneUnit_ = (ref: EncounterPlaneVec3, n: EncounterPlaneVec3): EncounterPlaneVec3 | null => {
  const refUnit = scale_(ref, 1 / norm_(ref));
  const inPlane = sub_(refUnit, scale_(n, dot_(refUnit, n)));
  const len = norm_(inPlane);

  return len < PARALLEL_TOLERANCE ? null : scale_(inPlane, 1 / len);
};

/**
 * Builds the encounter-plane basis for a relative velocity. See the module comment for the axis
 * convention.
 * @param relVel Relative velocity (secondary minus primary), any units.
 * @param reference Axis whose in-plane projection becomes +x. Defaults to radial [1, 0, 0].
 * @returns The basis, or null when the relative velocity is zero or not finite.
 */
export const encounterPlaneBasis = (relVel: EncounterPlaneVec3, reference: EncounterPlaneVec3 = ENCOUNTER_PLANE_RADIAL_REFERENCE): EncounterPlaneBasis | null => {
  const speed = norm_(relVel);

  if (!Number.isFinite(speed) || speed < MIN_REL_SPEED) {
    return null;
  }

  const normal = scale_(relVel, 1 / speed);
  const xAxis = inPlaneUnit_(reference, normal) ?? inPlaneUnit_(ENCOUNTER_PLANE_FALLBACK_REFERENCE, normal);

  if (!xAxis) {
    return null;
  }

  return { xAxis, yAxis: cross_(normal, xAxis), normal };
};

/**
 * Projects a relative position onto the encounter plane.
 * @param relPos Relative position (secondary minus primary), same frame as the basis.
 * @param basis Basis from {@link encounterPlaneBasis}.
 * @returns In-plane coordinates, in the units of `relPos`.
 */
export const projectToEncounterPlane = (relPos: EncounterPlaneVec3, basis: EncounterPlaneBasis): EncounterPlanePoint => ({
  x: dot_(relPos, basis.xAxis),
  y: dot_(relPos, basis.yAxis),
});

/**
 * Distance of a relative position along the encounter-plane normal (positive = the secondary has
 * already passed the plane in the direction of the relative velocity). Zero at TCA for linear
 * relative motion.
 */
export const encounterPlaneNormalOffset = (relPos: EncounterPlaneVec3, basis: EncounterPlaneBasis): number => dot_(relPos, basis.normal);

/**
 * Projects the combined 1-sigma position uncertainty of two objects onto the encounter plane.
 *
 * This is an estimate. Each object's sigmas are treated as an independent, diagonal Gaussian in
 * the frame of the basis (normally the primary's RIC frame), and the two are summed. The
 * secondary's own RIC axes differ from the primary's by the encounter geometry, and TLE-derived
 * sigmas carry no cross-correlations, so do not read this as a screening-grade covariance.
 * @param basis Basis from {@link encounterPlaneBasis}, in the RIC frame.
 * @param primary Primary 1-sigma RIC sigmas.
 * @param secondary Secondary 1-sigma RIC sigmas.
 * @returns The projected ellipse, or null if any sigma is negative or not finite.
 */
export const encounterPlaneSigmaEllipse = (basis: EncounterPlaneBasis, primary: RicSigmas, secondary: RicSigmas): EncounterPlaneEllipse | null => {
  const sigmas = [primary.radial, primary.inTrack, primary.crossTrack, secondary.radial, secondary.inTrack, secondary.crossTrack];

  if (sigmas.some((s) => !Number.isFinite(s) || s < 0)) {
    return null;
  }

  // Combined diagonal variances in [radial, in-track, cross-track] = [x, y, z] order.
  const v = [primary.radial ** 2 + secondary.radial ** 2, primary.inTrack ** 2 + secondary.inTrack ** 2, primary.crossTrack ** 2 + secondary.crossTrack ** 2];
  const ex = [basis.xAxis.x, basis.xAxis.y, basis.xAxis.z];
  const ey = [basis.yAxis.x, basis.yAxis.y, basis.yAxis.z];

  let cxx = 0;
  let cyy = 0;
  let cxy = 0;

  for (let k = 0; k < 3; k++) {
    cxx += ex[k] * ex[k] * v[k];
    cyy += ey[k] * ey[k] * v[k];
    cxy += ex[k] * ey[k] * v[k];
  }

  const mean = (cxx + cyy) / 2;
  const radius = Math.hypot((cxx - cyy) / 2, cxy);
  const lambdaMajor = mean + radius;
  const lambdaMinor = Math.max(mean - radius, 0);

  return {
    semiMajor: Math.sqrt(lambdaMajor),
    semiMinor: Math.sqrt(lambdaMinor),
    angleRad: 0.5 * Math.atan2(2 * cxy, cxx - cyy),
    covariance: [
      [cxx, cxy],
      [cxy, cyy],
    ],
  };
};

/**
 * Samples an ellipse outline for plotting.
 * @param center Ellipse centre in the plane.
 * @param ellipse Ellipse from {@link encounterPlaneSigmaEllipse}.
 * @param scale Multiplier on both semi-axes (e.g. 3 for a 3-sigma outline). Defaults to 1.
 * @param segments Number of segments; the first point is repeated at the end to close the loop.
 */
export const sampleEncounterPlaneEllipse = (center: EncounterPlanePoint, ellipse: EncounterPlaneEllipse, scale = 1, segments = 72): EncounterPlanePoint[] => {
  const cosA = Math.cos(ellipse.angleRad);
  const sinA = Math.sin(ellipse.angleRad);
  const a = ellipse.semiMajor * scale;
  const b = ellipse.semiMinor * scale;
  const points: EncounterPlanePoint[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    const u = a * Math.cos(t);
    const w = b * Math.sin(t);

    points.push({ x: center.x + u * cosA - w * sinA, y: center.y + u * sinA + w * cosA });
  }

  return points;
};
