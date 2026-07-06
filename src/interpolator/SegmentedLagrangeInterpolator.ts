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

import { EpochUTC } from '../time/EpochUTC';
import { EpochWindow } from '../time/EpochWindow';
import { J2000 } from '../coordinate/J2000';
import { Seconds } from '../types/types';
import { LagrangeInterpolator } from './LagrangeInterpolator';
import { StateInterpolator } from './StateInterpolator';

interface Segment {
  interpolator: LagrangeInterpolator;
  startPosix: number;
  endPosix: number;
}

/**
 * A segmented interpolator that uses separate LagrangeInterpolators per
 * physics phase. This prevents polynomial interpolation from spanning
 * a model boundary (e.g. parametric ascent → Keplerian orbit) where
 * the underlying data is not well-approximated by a single polynomial.
 *
 * Each segment uses data exclusively from its own physics model.
 * There may be a small gap between segments where interpolation
 * returns null — this is intentional to avoid cross-model artifacts.
 */
export class SegmentedLagrangeInterpolator extends StateInterpolator {
  private readonly segments_: Segment[];

  private constructor(segments: Segment[]) {
    super();
    this.segments_ = segments;
  }

  /**
   * Create a segmented interpolator from phased ephemeris data.
   *
   * Each phase gets its own LagrangeInterpolator built from only its
   * own data — no cross-phase overlap. This ensures the polynomial
   * only fits data from a single physics model.
   *
   * @param states All J2000 state vectors in chronological order.
   * @param boundaryIndex Index of the last state in the first phase.
   *        The second phase starts at boundaryIndex + 1.
   * @param order Lagrange polynomial order (default 5).
   * @returns A SegmentedLagrangeInterpolator with two segments.
   */
  static fromPhasedEphemeris(states: J2000[], boundaryIndex: number, order = 5): SegmentedLagrangeInterpolator {
    return SegmentedLagrangeInterpolator.fromMultipleBoundaries(states, [boundaryIndex], order);
  }

  /**
   * Create a segmented interpolator from ephemeris data with multiple phase boundaries.
   *
   * Splits the state vector array into N+1 segments at the given boundary indices.
   * Each segment gets its own LagrangeInterpolator to prevent cross-phase artifacts.
   *
   * @param states All J2000 state vectors in chronological order.
   * @param boundaryIndices Indices of the last state in each segment (except the final segment).
   *        E.g. [50, 120] creates 3 segments: [0..50], [51..120], [121..end].
   * @param order Lagrange polynomial order (default 5).
   * @returns A SegmentedLagrangeInterpolator with N+1 segments.
   */
  static fromMultipleBoundaries(states: J2000[], boundaryIndices: number[], order = 5): SegmentedLagrangeInterpolator {
    const sorted = [...boundaryIndices].sort((a, b) => a - b);
    const segments: Segment[] = [];
    let segStart = 0;

    for (const boundary of sorted) {
      const segStates = states.slice(segStart, boundary + 1);

      if (segStates.length > 0) {
        const interp = LagrangeInterpolator.fromEphemeris(segStates, order);
        const win = interp.window();

        segments.push({
          interpolator: interp,
          startPosix: win.start.posix,
          endPosix: win.end.posix,
        });
      }
      segStart = boundary + 1;
    }

    // Final segment: from last boundary+1 to end
    const finalStates = states.slice(segStart);

    if (finalStates.length > 0) {
      const interp = LagrangeInterpolator.fromEphemeris(finalStates, order);
      const win = interp.window();

      segments.push({
        interpolator: interp,
        startPosix: win.start.posix,
        endPosix: win.end.posix,
      });
    }

    return new SegmentedLagrangeInterpolator(segments);
  }

  interpolate(epoch: EpochUTC): J2000 | null {
    const posix = epoch.posix;

    for (const seg of this.segments_) {
      if (posix >= seg.startPosix && posix <= seg.endPosix) {
        return seg.interpolator.interpolate(epoch);
      }
    }

    return null;
  }

  window(): EpochWindow {
    const first = this.segments_[0];
    const last = this.segments_[this.segments_.length - 1];

    return new EpochWindow(
      new EpochUTC(first.startPosix as Seconds),
      new EpochUTC(last.endPosix as Seconds),
    );
  }

  get sizeBytes(): number {
    let total = 0;

    for (const seg of this.segments_) {
      total += seg.interpolator.sizeBytes;
    }

    return total;
  }
}
