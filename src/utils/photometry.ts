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

/**
 * Estimates a standard (intrinsic) visual magnitude from a radar cross
 * section.
 *
 * Uses the common first-order approximation that reflected optical flux scales
 * with the projected area a radar sees:
 *
 *   vmag = -1.3 - 2.5 * log10(rcs)
 *
 * where `rcs` is in square meters. This assumes a diffuse sphere with an
 * average albedo and ignores shape/material effects, so the result is only a
 * coarse estimate. The output is clamped to
 * [{@link RCS_VMAG_ESTIMATE_MIN}, {@link RCS_VMAG_ESTIMATE_MAX}] so degenerate
 * radar cross sections cannot produce absurd magnitudes.
 * @param rcs Radar cross section in square meters.
 * @returns The estimated standard visual magnitude, or null when the RCS is
 * not a finite positive number.
 */
export function estimateVmagFromRcs(rcs: number): number | null {
  if (typeof rcs !== 'number' || !Number.isFinite(rcs) || rcs <= 0) {
    return null;
  }

  const vmag = -1.3 - 2.5 * Math.log10(rcs);

  return Math.min(Math.max(vmag, RCS_VMAG_ESTIMATE_MIN), RCS_VMAG_ESTIMATE_MAX);
}
