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

/** One cell of a {@link SkyUsageGrid}, with bounds in degrees and time in seconds. */
export interface SkyUsageCell {
  azIdx: number;
  elIdx: number;
  /** Lower azimuth bound, degrees (inclusive) */
  azMin: number;
  /** Upper azimuth bound, degrees (exclusive) */
  azMax: number;
  /** Lower elevation bound, degrees (inclusive) */
  elMin: number;
  /** Upper elevation bound, degrees (exclusive, except the top row which includes 90) */
  elMax: number;
  servedSeconds: number;
  blockedSeconds: number;
}

/** Plain-data form of a {@link SkyUsageGrid}. */
export interface SerializedSkyUsageGrid {
  azBinDeg: number;
  elBinDeg: number;
  /** Row-major [elIdx * azBins + azIdx] */
  servedSeconds: number[];
  blockedSeconds: number[];
}

function checkBin_(name: string, bin: number, span: number): number {
  if (!Number.isFinite(bin) || bin <= 0 || bin > span) {
    throw new ValidationError(`${name} must be in (0, ${span}] degrees`, name, bin);
  }
  const n = span / bin;

  if (Math.abs(n - Math.round(n)) > 1e-9) {
    throw new ValidationError(`${name} must divide ${span} evenly`, name, bin);
  }

  return Math.round(n);
}

/**
 * Polar grid of time spent in each part of the sky, split into time served and time blocked.
 * This is the obstruction map a user terminal reports: feed it the az/el line of sight of each
 * time step, tagged served or blocked, then render `cells()` with any front end.
 *
 * Azimuth wraps at 360 degrees. Samples below the horizon (el < 0) are not sky and are ignored.
 */
export class SkyUsageGrid {
  readonly azBinDeg: number;
  readonly elBinDeg: number;
  readonly azBins: number;
  readonly elBins: number;
  private readonly served_: Float64Array;
  private readonly blocked_: Float64Array;

  /**
   * @param params.azBinDeg - Azimuth bin width in degrees; must divide 360 evenly
   * @param params.elBinDeg - Elevation bin width in degrees; must divide 90 evenly
   * @throws ValidationError on a bin that is non-positive or does not divide its span
   */
  constructor(params: { azBinDeg: number; elBinDeg: number }) {
    this.azBins = checkBin_('azBinDeg', params.azBinDeg, 360);
    this.elBins = checkBin_('elBinDeg', params.elBinDeg, 90);
    this.azBinDeg = params.azBinDeg;
    this.elBinDeg = params.elBinDeg;
    this.served_ = new Float64Array(this.azBins * this.elBins);
    this.blocked_ = new Float64Array(this.azBins * this.elBins);
  }

  /**
   * Adds a time interval spent at one line of sight.
   * @param az - Azimuth in degrees (any value; wrapped to [0, 360))
   * @param el - Elevation in degrees; negative values are ignored, values above 90 are rejected
   * @param served - True if the line of sight was served, false if blocked
   * @param durationSeconds - Time spent, seconds (>= 0)
   * @returns True if recorded, false if ignored because el < 0
   * @throws ValidationError on non-finite az/el/duration, negative duration, or el > 90
   */
  add(az: number, el: number, served: boolean, durationSeconds: number): boolean {
    if (!Number.isFinite(az) || !Number.isFinite(el) || el > 90) {
      throw new ValidationError('az must be finite and el finite and <= 90 degrees', 'azEl', `${az},${el}`);
    }
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
      throw new ValidationError('durationSeconds must be finite and >= 0', 'durationSeconds', durationSeconds);
    }
    if (el < 0) {
      return false;
    }
    let a = az % 360;

    if (a < 0) {
      a += 360;
    }
    let azIdx = Math.floor(a / this.azBinDeg);

    if (azIdx >= this.azBins) {
      azIdx = 0;
    }
    const elIdx = Math.min(Math.floor(el / this.elBinDeg), this.elBins - 1);
    const i = elIdx * this.azBins + azIdx;

    if (served) {
      this.served_[i] += durationSeconds;
    } else {
      this.blocked_[i] += durationSeconds;
    }

    return true;
  }

  private index_(azIdx: number, elIdx: number): number {
    const azOk = Number.isInteger(azIdx) && azIdx >= 0 && azIdx < this.azBins;
    const elOk = Number.isInteger(elIdx) && elIdx >= 0 && elIdx < this.elBins;

    if (!azOk || !elOk) {
      throw new ValidationError('cell index out of range', 'cell', `${azIdx},${elIdx}`);
    }

    return elIdx * this.azBins + azIdx;
  }

  /** Served and blocked seconds of one cell. */
  cellSeconds(azIdx: number, elIdx: number): { served: number; blocked: number } {
    const i = this.index_(azIdx, elIdx);

    return { served: this.served_[i], blocked: this.blocked_[i] };
  }

  /** Total served seconds over all cells. */
  get servedSeconds(): number {
    return this.served_.reduce((s, v) => s + v, 0);
  }

  /** Total blocked seconds over all cells. */
  get blockedSeconds(): number {
    return this.blocked_.reduce((s, v) => s + v, 0);
  }

  /** Overall blocked time divided by total time; 0 when nothing has been added. */
  blockedFraction(): number {
    const b = this.blockedSeconds;
    const total = b + this.servedSeconds;

    return total > 0 ? b / total : 0;
  }

  /** Blocked fraction of one cell; 0 for a cell with no time. */
  cellBlockedFraction(azIdx: number, elIdx: number): number {
    const { served, blocked } = this.cellSeconds(azIdx, elIdx);
    const total = served + blocked;

    return total > 0 ? blocked / total : 0;
  }

  /**
   * Flat list of cells for renderers, with bounds and seconds.
   * @param includeEmpty - Include cells with no time (default false)
   */
  cells(includeEmpty = false): SkyUsageCell[] {
    const out: SkyUsageCell[] = [];

    for (let elIdx = 0; elIdx < this.elBins; elIdx++) {
      for (let azIdx = 0; azIdx < this.azBins; azIdx++) {
        const i = elIdx * this.azBins + azIdx;

        if (!includeEmpty && this.served_[i] === 0 && this.blocked_[i] === 0) {
          continue;
        }
        out.push({
          azIdx,
          elIdx,
          azMin: azIdx * this.azBinDeg,
          azMax: (azIdx + 1) * this.azBinDeg,
          elMin: elIdx * this.elBinDeg,
          elMax: (elIdx + 1) * this.elBinDeg,
          servedSeconds: this.served_[i],
          blockedSeconds: this.blocked_[i],
        });
      }
    }

    return out;
  }

  /** Clears all accumulated time. */
  reset(): void {
    this.served_.fill(0);
    this.blocked_.fill(0);
  }

  /** Plain-data form for storage; round-trips through {@link SkyUsageGrid.deserialize}. */
  serialize(): SerializedSkyUsageGrid {
    return {
      azBinDeg: this.azBinDeg,
      elBinDeg: this.elBinDeg,
      servedSeconds: Array.from(this.served_),
      blockedSeconds: Array.from(this.blocked_),
    };
  }

  /** Rebuilds a grid from {@link SkyUsageGrid.serialize} output. */
  static deserialize(data: SerializedSkyUsageGrid): SkyUsageGrid {
    const grid = new SkyUsageGrid({ azBinDeg: data.azBinDeg, elBinDeg: data.elBinDeg });
    const n = grid.azBins * grid.elBins;

    if (data.servedSeconds.length !== n || data.blockedSeconds.length !== n) {
      throw new ValidationError('serialized cell arrays do not match the bin counts', 'servedSeconds', data.servedSeconds.length);
    }
    grid.served_.set(data.servedSeconds);
    grid.blocked_.set(data.blockedSeconds);

    return grid;
  }
}
