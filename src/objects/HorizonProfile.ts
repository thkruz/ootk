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
import { ElevationMask, maskMinElevation, sortElevationMasks } from '../sensor/FieldOfView';
import { Degrees } from '../types/types';

/** One vertex of a {@link HorizonProfile}. */
export interface HorizonPoint {
  /** Azimuth in degrees, in [0, 360) */
  az: Degrees;
  /** Horizon elevation in degrees, in [-90, 90] */
  el: Degrees;
}

/** Plain-data form of a {@link HorizonProfile}. */
export interface SerializedHorizonProfile {
  points: { az: number; el: number }[];
}

/** Half-width in degrees of the near-vertical ramp that replaces a step edge. */
const STEP_EDGE_EPS_DEG = 1e-6;
/** Azimuth separation in degrees below which two vertices are treated as the same. */
const SAME_AZ_DEG = 1e-9;

function normAz_(az: number): number {
  const a = az % 360;

  return a < 0 ? a + 360 : a;
}

/**
 * Elevation of the local horizon as a function of azimuth: the lowest elevation at which a
 * line of sight is unobstructed (tree line, building, ridge).
 *
 * The profile is piecewise linear between its vertices and wraps at 0/360 degrees. Unlike
 * `FieldOfView.elevationMasks` it has no vertex cap, so a measured 1 degree profile
 * (360 points) is fine. Lookups reuse `maskMinElevation` from the sensor module.
 *
 * @example
 * ```ts
 * const horizon = HorizonProfile.fromPoints([
 *   { az: 0, el: 5 }, { az: 90, el: 25 }, { az: 180, el: 8 }, { az: 270, el: 12 },
 * ]);
 * AccessCalculator.calculateAccess(site, sat, start, end, { horizon });
 * ```
 */
export class HorizonProfile {
  /** Vertices sorted by azimuth, in the ElevationMask shape (startAz = az, minEl = el). */
  private readonly vertices_: readonly ElevationMask[];

  private constructor(vertices: ElevationMask[]) {
    this.vertices_ = vertices;
  }

  /**
   * Builds a profile from measured points.
   * @param points - At least 2 points with unique azimuth in [0, 360) degrees and elevation in
   * [-90, 90] degrees. Order does not matter.
   * @throws ValidationError on fewer than 2 points, a non-finite or out-of-range value, or a duplicate azimuth
   */
  static fromPoints(points: readonly { az: number; el: number }[]): HorizonProfile {
    if (points.length < 2) {
      throw new ValidationError('HorizonProfile needs at least 2 points', 'points', points.length);
    }
    for (const p of points) {
      if (!Number.isFinite(p.az) || p.az < 0 || p.az >= 360) {
        throw new ValidationError('HorizonProfile azimuth must be in [0, 360) degrees', 'az', p.az);
      }
      if (!Number.isFinite(p.el) || p.el < -90 || p.el > 90) {
        throw new ValidationError('HorizonProfile elevation must be in [-90, 90] degrees', 'el', p.el);
      }
    }
    const sorted = sortElevationMasks(
      points.map((p) => ({ startAz: p.az as Degrees, stopAz: p.az as Degrees, minEl: p.el as Degrees })),
    );

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startAz === sorted[i - 1].startAz) {
        throw new ValidationError('HorizonProfile azimuths must be unique', 'az', sorted[i].startAz);
      }
    }

    return new HorizonProfile(sorted);
  }

  /**
   * A flat horizon at a fixed elevation (equivalent to a plain minimum elevation).
   * @param el - Elevation in degrees
   */
  static constant(el: number): HorizonProfile {
    return HorizonProfile.fromPoints([{ az: 0, el }, { az: 180, el }]);
  }

  /**
   * Converts `ElevationMask` entries to a profile.
   *
   * With `interpolate` true each entry is a vertex at (`startAz`, `minEl`), as in
   * `FieldOfView`. With `interpolate` false each entry is an inclusive sector and overlaps
   * take the highest value. A piecewise-linear profile cannot hold a true discontinuity, so each
   * sector edge becomes a ramp 2e-6 degrees wide; values match `maskMinElevation` everywhere
   * except inside those ramps.
   *
   * @param masks - Mask entries; degrees
   * @param interpolate - True for vertices, false for step sectors
   * @param floorEl - Elevation in degrees outside every sector (step mode only, default 0)
   */
  static fromElevationMasks(masks: readonly ElevationMask[], interpolate: boolean, floorEl = 0): HorizonProfile {
    if (interpolate) {
      return HorizonProfile.fromPoints(masks.map((m) => ({ az: m.startAz, el: m.minEl })));
    }
    if (masks.length === 0) {
      return HorizonProfile.constant(floorEl);
    }
    const edges = new Set<number>();

    for (const m of masks) {
      edges.add(normAz_(m.startAz));
      edges.add(normAz_(m.stopAz));
    }
    const sortedEdges = [...edges].sort((a, b) => a - b);
    const k = sortedEdges.length;
    const pieceEl = sortedEdges.map((e, i) => {
      const next = i + 1 < k ? sortedEdges[i + 1] : sortedEdges[0] + 360;

      return maskMinElevation(masks, normAz_((e + next) / 2), false, floorEl);
    });
    const points = new Map<number, number>();

    for (let i = 0; i < k; i++) {
      const left = pieceEl[(i - 1 + k) % k];

      points.set(normAz_(sortedEdges[i] - STEP_EDGE_EPS_DEG), left);
      points.set(normAz_(sortedEdges[i] + STEP_EDGE_EPS_DEG), pieceEl[i]);
    }
    if (points.size < 2) {
      return HorizonProfile.constant(pieceEl[0]);
    }

    return HorizonProfile.fromPoints([...points].map(([az, el]) => ({ az, el })));
  }

  /**
   * Pointwise maximum of two profiles. Exact for piecewise-linear inputs: the vertices are the
   * union of both vertex sets plus every crossing of the two curves.
   */
  static max(a: HorizonProfile, b: HorizonProfile): HorizonProfile {
    const azSet = new Set<number>();

    for (const v of a.vertices_) {
      azSet.add(v.startAz);
    }
    for (const v of b.vertices_) {
      azSet.add(v.startAz);
    }
    const azs = [...azSet].sort((x, y) => x - y);
    const out = new Map<number, number>();
    const n = azs.length;

    for (let i = 0; i < n; i++) {
      const lo = azs[i];
      const hi = i + 1 < n ? azs[i + 1] : azs[0] + 360;
      const elALo = a.elevationAt(lo);
      const elBLo = b.elevationAt(lo);
      const da = elALo - elBLo;
      const db = a.elevationAt(hi) - b.elevationAt(hi);

      out.set(lo, Math.max(elALo, elBLo));
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        const xn = normAz_(lo + ((hi - lo) * da) / (da - db));

        if (!out.has(xn) && Math.abs(xn - lo) > SAME_AZ_DEG && Math.abs(xn - hi) > SAME_AZ_DEG) {
          out.set(xn, Math.max(a.elevationAt(xn), b.elevationAt(xn)));
        }
      }
    }

    return HorizonProfile.fromPoints([...out].map(([az, el]) => ({ az, el })));
  }

  /** Pointwise maximum of this profile and `other`; see {@link HorizonProfile.max}. */
  combine(other: HorizonProfile): HorizonProfile {
    return HorizonProfile.max(this, other);
  }

  /**
   * Horizon elevation at an azimuth. Allocation-free.
   * @param az - Azimuth in degrees (any value; normalised to [0, 360))
   * @returns Elevation in degrees
   */
  elevationAt(az: number): Degrees {
    return maskMinElevation(this.vertices_, az, true, -90) as Degrees;
  }

  /** The vertices as {az, el} pairs sorted by azimuth (a new array). */
  get points(): HorizonPoint[] {
    return this.vertices_.map((v) => ({ az: v.startAz, el: v.minEl }));
  }

  /** Plain-data form for storage; round-trips through {@link HorizonProfile.deserialize}. */
  serialize(): SerializedHorizonProfile {
    return { points: this.vertices_.map((v) => ({ az: v.startAz, el: v.minEl })) };
  }

  /** Rebuilds a profile from {@link HorizonProfile.serialize} output. */
  static deserialize(data: SerializedHorizonProfile): HorizonProfile {
    return HorizonProfile.fromPoints(data.points);
  }

  toString(): string {
    const els = this.vertices_.map((v) => v.minEl);

    return `HorizonProfile: ${this.vertices_.length} points, elevation ${Math.min(...els).toFixed(1)} to ${Math.max(...els).toFixed(1)} deg`;
  }
}
