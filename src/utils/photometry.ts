/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @license MIT License
 *
 * @Copyright (c) 2025 Theodore Kruczek
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Radians } from '../types/types';

/**
 * Photometry helpers for estimating the brightness of resident space objects:
 * standard magnitude from radar observables, and apparent magnitude from a
 * standard magnitude plus the observing geometry.
 */

/** Brightest standard magnitude the RCS estimator will report. */
export const RCS_VMAG_ESTIMATE_MIN = -5;
/** Faintest standard magnitude the RCS estimator will report. */
export const RCS_VMAG_ESTIMATE_MAX = 15;

/** Apparent visual magnitude of the Sun (V band), used as the photometric zero point. */
const SUN_VMAG_ = -26.74;
/** Range at which a standard magnitude is defined, metres (1000 km). */
const STANDARD_RANGE_M_ = 1.0e6;
/** Default Lambertian reflectance rho for an RCS-derived magnitude. */
const DEFAULT_ALBEDO_ = 0.2;

/**
 * Lambertian sphere phase function, normalised to F(0) = 2 / 3:
 * F(phi) = (2 / (3 pi)) [ (pi - phi) cos(phi) + sin(phi) ].
 * @param phase Solar phase angle in radians.
 * @returns F(phase).
 */
function lambertSpherePhase_(phase: number): number {
  return (2 / (3 * Math.PI)) * ((Math.PI - phase) * Math.cos(phase) + Math.sin(phase));
}

/**
 * Estimates a standard visual magnitude from a radar cross section.
 *
 * Standard magnitude is the brightness at 1000 km range and 90 deg solar phase angle. The RCS is
 * taken as the projected area A of a diffusely reflecting (Lambertian) sphere of Lambertian
 * reflectance rho (the fraction of incident light the surface scatters diffusely; this is not the
 * geometric albedo p, which for a Lambert sphere is p = 2 rho / 3), so r^2 = A / pi, and (McCants; Molczan; Hejduk 2011, "Specular and diffuse
 * components in spherical satellite photometric modeling"):
 *
 *   m = -26.74 - 2.5 log10( rho (A / pi) F(phi) / R^2 ),  F(90 deg) = 2 / (3 pi)
 *
 * with R = 1e6 m. For rho = 0.2 this is m = 7.93 - 2.5 log10(rcs): a 1 m^2 object is about +7.9.
 * Each factor of 2.5 in rho moves the result by 1 mag. The result is still coarse: RCS is not
 * optical area, and shape, attitude and specular glints are ignored. The output is clamped to
 * [{@link RCS_VMAG_ESTIMATE_MIN}, {@link RCS_VMAG_ESTIMATE_MAX}].
 * @param rcs Radar cross section in square metres.
 * @param albedo Lambertian reflectance rho, 0 to 1 (default 0.2); not the geometric albedo.
 * @returns The estimated standard visual magnitude, or null when the RCS is
 * not a finite positive number.
 */
export function estimateVmagFromRcs(rcs: number, albedo: number = DEFAULT_ALBEDO_): number | null {
  if (typeof rcs !== 'number' || !Number.isFinite(rcs) || rcs <= 0) {
    return null;
  }

  const reflected = (albedo * (rcs / Math.PI) * lambertSpherePhase_(Math.PI / 2)) / (STANDARD_RANGE_M_ * STANDARD_RANGE_M_);
  const vmag = SUN_VMAG_ - 2.5 * Math.log10(reflected);

  return Math.min(Math.max(vmag, RCS_VMAG_ESTIMATE_MIN), RCS_VMAG_ESTIMATE_MAX);
}

/** Faintest apparent magnitude {@link apparentVmagFromStdMag} reports before calling an object invisible. */
export const APPARENT_VMAG_INVISIBLE = 30;

/** Minimal 3-vector shape accepted by the photometry geometry helpers. */
export interface PhotometryVec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Lambertian sphere phase law relative to its value at 90 deg phase:
 * F(phi) / F(90 deg) = sin(phi) + (pi - phi) cos(phi).
 *
 * It is 1 at 90 deg (the standard-magnitude phase), pi at 0 deg (full phase,
 * about 1.24 mag brighter) and 0 at 180 deg (the lit side faces away).
 * @param phase Solar phase angle in radians, 0 to pi.
 * @returns The phase factor relative to 90 deg.
 */
export function lambertPhaseRelativeTo90(phase: number): number {
  return Math.sin(phase) + (Math.PI - phase) * Math.cos(phase);
}

/**
 * Solar phase angle at a target: the angle at the target between the direction
 * to the Sun and the direction to the observer. All three positions must be in
 * the same frame and units (for example J2000 km).
 * @param target Target position.
 * @param sun Sun position.
 * @param observer Observer position.
 * @returns The phase angle in radians (0 = fully lit side toward the observer),
 * or NaN when either direction has zero length.
 */
export function solarPhaseAngle(target: PhotometryVec3, sun: PhotometryVec3, observer: PhotometryVec3): Radians {
  const sx = sun.x - target.x;
  const sy = sun.y - target.y;
  const sz = sun.z - target.z;
  const ox = observer.x - target.x;
  const oy = observer.y - target.y;
  const oz = observer.z - target.z;
  const norm = Math.hypot(sx, sy, sz) * Math.hypot(ox, oy, oz);

  if (norm === 0) {
    return NaN as Radians;
  }

  const cosPhase = (sx * ox + sy * oy + sz * oz) / norm;

  return Math.acos(Math.min(1, Math.max(-1, cosPhase))) as Radians;
}

/**
 * Apparent visual magnitude of a diffusely reflecting (Lambertian sphere)
 * satellite from its standard magnitude (1000 km range, 90 deg solar phase):
 *
 *   m = m_std + 5 log10(range / 1000 km) - 2.5 log10( sin(phi) + (pi - phi) cos(phi) ) - 2.5 log10(L)
 *
 * The first two terms are the inverse-square range scaling, the third is the
 * Lambert phase law normalised to 90 deg (McCants standard-magnitude
 * convention), and the last dims the object by the fraction L of the solar
 * disk it sees (L < 1 in Earth's penumbra). Specular glints, attitude and
 * atmospheric extinction are ignored, so treat the value as an estimate good
 * to about a magnitude.
 * @param stdMag Standard magnitude (1000 km, 90 deg phase).
 * @param rangeKm Observer-to-target range in km.
 * @param phaseAngle Solar phase angle in radians (see {@link solarPhaseAngle}).
 * @param lightingRatio Visible fraction of the solar disk, 0 to 1 (default 1, full sun).
 * @returns The apparent magnitude, or null when the object reflects no light
 * toward the observer (umbra, phase of 180 deg) or an input is invalid.
 */
export function apparentVmagFromStdMag(stdMag: number, rangeKm: number, phaseAngle: number, lightingRatio = 1): number | null {
  if (!Number.isFinite(stdMag) || !Number.isFinite(rangeKm) || rangeKm <= 0 || !Number.isFinite(phaseAngle) || !(lightingRatio > 0)) {
    return null;
  }

  const phaseFactor = lambertPhaseRelativeTo90(phaseAngle);

  if (!(phaseFactor > 0)) {
    return null;
  }

  const mag = stdMag + 5 * Math.log10(rangeKm / 1000) - 2.5 * Math.log10(phaseFactor) - 2.5 * Math.log10(Math.min(lightingRatio, 1));

  return mag > APPARENT_VMAG_INVISIBLE ? null : mag;
}
