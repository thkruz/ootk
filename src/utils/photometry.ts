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

/**
 * Photometry helpers for estimating the apparent brightness of resident space
 * objects from radar observables.
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
