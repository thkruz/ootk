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

import { ValidationError } from '../errors';

/** A look direction to a satellite in the local topocentric frame (degrees). */
export interface GnssLookAngle {
  /** Azimuth in degrees, clockwise from true north. */
  az: number;
  /** Elevation in degrees above the local horizon. */
  el: number;
}

/** Dilution of precision values. All are dimensionless. */
export interface DilutionOfPrecision {
  /** Geometric DOP, sqrt(D11 + D22 + D33 + D44). */
  gdop: number;
  /** Position DOP, sqrt(D11 + D22 + D33). */
  pdop: number;
  /** Horizontal DOP, sqrt(D11 + D22). */
  hdop: number;
  /** Vertical DOP, sqrt(D33). */
  vdop: number;
  /** Time DOP, sqrt(D44), in range-equivalent units (see {@link DopOptions.tdopInSeconds}). */
  tdop: number;
}

/** Options for {@link calculateDop}. */
export interface DopOptions {
  /**
   * When true, TDOP is returned in seconds per metre of UERE, sqrt(D44) / c, which is the
   * definition of Kaplan and Hegarty (2nd ed., Eq. 7.53, p. 328). When false (default) TDOP is the
   * range-equivalent sqrt(D44) that the same text gives as the simpler alternative form in the
   * parenthetical following Eq. 7.53 (the common textbook definition).
   */
  tdopInSeconds?: boolean;
}

/**
 * Sentinel returned by {@link calculateDop} when fewer than four satellites are supplied or the
 * geometry is singular (the satellite unit vectors, with the clock column, are rank deficient).
 * Every field of the result is `Infinity`.
 */
export const SINGULAR_DOP: Readonly<DilutionOfPrecision> = Object.freeze({
  gdop: Infinity,
  pdop: Infinity,
  hdop: Infinity,
  vdop: Infinity,
  tdop: Infinity,
});

const SPEED_OF_LIGHT_M_S = 299792458;

/**
 * Inverts a 4 x 4 matrix with Gauss-Jordan elimination and partial pivoting.
 * @param m - Row-major 4 x 4 matrix (not modified).
 * @returns The inverse, or null if the matrix is singular to working precision.
 */
function invert4_(m: number[][]): number[][] | null {
  const n = 4;
  const a = m.map((row, i) => [...row, ...[0, 1, 2, 3].map((j) => (i === j ? 1 : 0))]);
  let scale = 0;

  for (const row of m) {
    for (const v of row) {
      scale = Math.max(scale, Math.abs(v));
    }
  }

  for (let col = 0; col < n; col++) {
    let pivot = col;

    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) {
        pivot = r;
      }
    }

    // Relative pivot tolerance: a rank-deficient geometry leaves a pivot at round-off level.
    if (Math.abs(a[pivot][col]) <= 1e-12 * Math.max(scale, 1)) {
      return null;
    }

    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col];

    for (let c = 0; c < 2 * n; c++) {
      a[col][c] /= p;
    }

    for (let r = 0; r < n; r++) {
      if (r !== col) {
        const f = a[r][col];

        for (let c = 0; c < 2 * n; c++) {
          a[r][c] -= f * a[col][c];
        }
      }
    }
  }

  return a.map((row) => row.slice(n));
}

/**
 * Dilution of precision for a set of satellites, from their look angles.
 *
 * Formulation (Kaplan and Hegarty, Understanding GPS: Principles and Applications, 2nd ed., 2006,
 * Section 7.3.1, Eqs. 7.31 and 7.42 to 7.53, pp. 324 to 328): each row of the geometry matrix H is
 * the unit line-of-sight vector from the user to a satellite in local east, north, up axes, with a
 * 1 in the clock column, `[sin(az)cos(el), cos(az)cos(el), sin(el), 1]`. With D = (H^T H)^-1:
 * GDOP = sqrt(D11 + D22 + D33 + D44), PDOP = sqrt(D11 + D22 + D33), HDOP = sqrt(D11 + D22),
 * VDOP = sqrt(D33), TDOP = sqrt(D44).
 *
 * No elevation mask is applied here; pass only the satellites that contribute to the solution.
 * Negative elevations are accepted (the regular-tetrahedron optimum needs them).
 *
 * @param lookAngles - Azimuth and elevation of each satellite, degrees.
 * @param options - See {@link DopOptions}.
 * @returns The DOP values, or {@link SINGULAR_DOP} (all `Infinity`) for fewer than four satellites
 * or singular geometry (for example four satellites on one great circle through the zenith).
 * @throws ValidationError if any angle is not finite.
 */
export function calculateDop(lookAngles: readonly GnssLookAngle[], options: DopOptions = {}): DilutionOfPrecision {
  for (const la of lookAngles) {
    if (!Number.isFinite(la.az) || !Number.isFinite(la.el)) {
      throw new ValidationError('Look angles must be finite', 'lookAngles', la);
    }
  }

  if (lookAngles.length < 4) {
    return { ...SINGULAR_DOP };
  }

  const hth: number[][] = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);

  for (const { az, el } of lookAngles) {
    const azR = (az * Math.PI) / 180;
    const elR = (el * Math.PI) / 180;
    const row = [Math.sin(azR) * Math.cos(elR), Math.cos(azR) * Math.cos(elR), Math.sin(elR), 1];

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        hth[i][j] += row[i] * row[j];
      }
    }
  }

  const d = invert4_(hth);

  if (!d || d[0][0] < 0 || d[1][1] < 0 || d[2][2] < 0 || d[3][3] < 0) {
    return { ...SINGULAR_DOP };
  }

  const tdop = Math.sqrt(d[3][3]);

  return {
    gdop: Math.sqrt(d[0][0] + d[1][1] + d[2][2] + d[3][3]),
    pdop: Math.sqrt(d[0][0] + d[1][1] + d[2][2]),
    hdop: Math.sqrt(d[0][0] + d[1][1]),
    vdop: Math.sqrt(d[2][2]),
    tdop: options.tdopInSeconds ? tdop / SPEED_OF_LIGHT_M_S : tdop,
  };
}
