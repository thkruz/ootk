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

/** 1-sigma position uncertainties (or per-axis caps) in the Radial-Intrack-Crosstrack frame. */
export interface RicSigmas {
  /** Radial component. */
  radial: number;
  /** In-track (along-track) component. */
  inTrack: number;
  /** Cross-track component. */
  crossTrack: number;
}

/**
 * Scale 1-sigma RIC position uncertainties by a confidence multiplier and clamp
 * each axis independently to a maximum.
 *
 * This is the shared, frame-agnostic core used to size uncertainty
 * visualizations (e.g. covariance ellipsoids). It performs no axis reordering -
 * callers map the returned RIC values onto whatever rendering convention they
 * use.
 *
 * A zero sigma on a single axis is treated as valid (it yields a zero radius on
 * that axis); only non-finite or negative inputs are rejected.
 * @param sigmas The 1-sigma RIC position uncertainties.
 * @param confidence The confidence multiplier (e.g. 1, 2, or 3 for n-sigma).
 * @param caps The per-axis maximum returned value, in the same units as `sigmas`.
 * @returns The scaled and clamped RIC values, or `null` if any input sigma is
 * not a finite, non-negative number.
 */
export function scaleAndClampRicSigmas(
  sigmas: RicSigmas,
  confidence: number,
  caps: RicSigmas,
): RicSigmas | null {
  const { radial, inTrack, crossTrack } = sigmas;

  if (![radial, inTrack, crossTrack].every((v) => Number.isFinite(v) && v >= 0)) {
    return null;
  }

  return {
    radial: Math.min(radial * confidence, caps.radial),
    inTrack: Math.min(inTrack * confidence, caps.inTrack),
    crossTrack: Math.min(crossTrack * confidence, caps.crossTrack),
  };
}
