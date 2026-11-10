/* eslint-disable max-classes-per-file -- the internal Run_ state machine is deliberately file-private */
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

import type { Antenna } from '../comm/Antenna';
import { calculateFspl, type Hertz } from '../comm/CommTypes';
import { ValidationError } from '../errors';
import type { GroundObject } from '../objects/GroundObject';
import type { HorizonProfile } from '../objects/HorizonProfile';
import type { SkyUsageGrid } from '../objects/SkyUsageGrid';
import type { Kilometers } from '../types/types';
import type { PositionSource } from './PositionSource';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Built-in selection strategies of {@link ServingSatelliteScheduler}. */
export enum ServingStrategy {
  /** Serve from the satellite with the highest elevation. Ties go to the lower index in the source. */
  HIGHEST_ELEVATION = 'HIGHEST_ELEVATION',
  /**
   * Serve from the satellite that stays usable longest. Remaining usable time is only computed for
   * the top `lookaheadTopK` candidates by elevation, sampled at `sampleStepSec`, capped at
   * `lookaheadHorizonSec`. Ties (including several satellites reaching the cap) go to the higher elevation.
   */
  LONGEST_REMAINING_VISIBILITY = 'LONGEST_REMAINING_VISIBILITY',
  /**
   * Serve from the satellite with the best link-margin proxy: antenna gain toward the satellite
   * (dBi, 0 when no antenna is given) minus free-space path loss at `frequencyHz`
   * ({@link calculateFspl}, ITU-R P.525). Everything else in a link budget (satellite EIRP and
   * G/T, atmosphere, polarization) is common to the candidates or ignored, so the proxy ranks
   * satellites by relative margin only; it is not an absolute margin. Requires `frequencyHz`.
   */
  BEST_LINK_MARGIN = 'BEST_LINK_MARGIN',
}

/** A satellite that passes every visibility rule at the evaluated instant. */
export interface ServingCandidate {
  /** Satellite id from the {@link PositionSource}. */
  id: number;
  /** Index into the source's `ids`. */
  index: number;
  /** Azimuth from the terminal, degrees clockwise from north, [0, 360). */
  az: number;
  /** Elevation above the local horizontal plane, degrees. */
  el: number;
  /** Slant range, kilometers. */
  rangeKm: number;
}

/** Context passed to a user selection callback. */
export interface SelectionContext {
  /** Instant of the selection. */
  time: Date;
  /** Id of the satellite currently serving, or null. */
  servingId: number | null;
  /** True at a scheduled reassignment tick (or the first instant), false for early or continuous re-selection. */
  isTick: boolean;
}

/**
 * User selection callback. Return the id of one of `candidates`, or null to decline (keep the
 * serving satellite if it is still usable, otherwise no service with gap reason `NO_SELECTION`).
 * In continuous mode the callback runs at every sample and a different returned id triggers a
 * handover; `hysteresis` does not apply to callbacks.
 */
export type SelectionCallback = (candidates: readonly ServingCandidate[], ctx: SelectionContext) => number | null;

/** Why a serving segment started. */
export type HandoverReason =
  /** Service at `start` of the schedule. */
  | 'INITIAL'
  /** A scheduled reassignment tick chose a different satellite while the previous one was still usable. */
  | 'SCHEDULED'
  /** The previous satellite became unusable at a sample and was replaced at that sample without a gap. */
  | 'SERVING_LOST'
  /** Continuous mode: a candidate beat the serving satellite by more than `hysteresis`. */
  | 'BETTER_CANDIDATE'
  /** Service resumed after a gap. */
  | 'GAP_RECOVERY';

/** Why no satellite could serve. */
export type GapReason = 'NOTHING_IN_VIEW' | 'BELOW_MASK' | 'OUTSIDE_SCAN' | 'OUT_OF_RANGE' | 'NO_SELECTION';

/** One continuous interval served by one satellite. */
export interface ServingSegment {
  satId: number;
  start: Date;
  /** First instant not served by this satellite. */
  end: Date;
  startAz: number;
  startEl: number;
  /** Azimuth/elevation of the satellite at `end` (outside the rules when it dropped out). */
  endAz: number;
  endEl: number;
  handoverReason: HandoverReason;
}

/** One interval without service. Consecutive samples with the same reason are merged. */
export interface ServingGap {
  start: Date;
  end: Date;
  reason: GapReason;
}

/** Summary statistics of a schedule. */
export interface ServingStats {
  /** Served time divided by the span, 0..1 (0 for a zero-length span). */
  servedFraction: number;
  /** Segments that began with a satellite-to-satellite switch (reasons SCHEDULED, SERVING_LOST, BETTER_CANDIDATE). */
  handoverCount: number;
  /** Longest single gap entry, seconds (adjacent gaps with different reasons count separately). */
  longestGapSec: number;
  /** Mean segment length, seconds (0 with no segments). */
  meanSegmentSec: number;
}

/** One sample of the sky trace (see `recordSkyTrace`). */
export interface SkyTraceEntry {
  time: Date;
  durationSec: number;
  az: number;
  el: number;
  /** True: line of sight to the serving satellite. False: best candidate rejected by the mask. */
  served: boolean;
}

/** Result of {@link ServingSatelliteScheduler.schedule}. */
export interface ServingSchedule {
  segments: ServingSegment[];
  gaps: ServingGap[];
  stats: ServingStats;
  /** Present only when `recordSkyTrace` was set. */
  skyTrace?: SkyTraceEntry[];
}

/** Options of {@link ServingSatelliteScheduler.schedule}. */
export interface ServingSchedulerOptions {
  /** The terminal (fixed position). */
  terminal: GroundObject;
  /** Satellite positions. */
  positions: PositionSource;
  start: Date;
  end: Date;
  /**
   * Reassignment interval, seconds. Omit for continuous mode: re-select only when the serving
   * satellite becomes unusable, or (with `hysteresis`) when a candidate is better.
   */
  reassignmentIntervalSec?: number;
  /**
   * Offset of the ticks within the interval, seconds. Ticks fall on UTC instants t with
   * (t in epoch seconds) mod interval = phase, so interval 15 with phase 12 ticks at :12, :27, :42, :57
   * of every minute. Default 0. The first instant of the span is always an evaluation point.
   */
  reassignmentPhaseSec?: number;
  /**
   * Interval for checking that the serving satellite stays usable and for lookahead, seconds.
   * Default 1. Must round to at least 1 ms (>= 0.0005 s). The sample grid is anchored at `start`.
   */
  sampleStepSec?: number;
  /** Minimum elevation, degrees. Default 0. */
  minElevation?: number;
  /** Azimuth-dependent horizon; the floor is max(minElevation, horizon.elevationAt(az)). */
  horizon?: HorizonProfile;
  /**
   * Terminal antenna. If it has `isWithinScan(az, el)` (PhasedArrayAntenna) that decides; otherwise a
   * satellite is usable when `getGainToward(az, el)` exceeds `antennaGainFloorDbi`.
   */
  antenna?: Antenna;
  /** Gain floor for antennas without `isWithinScan`, dBi. Default 0. */
  antennaGainFloorDbi?: number;
  /** Maximum slant range, kilometers. */
  maxRange?: Kilometers;
  /** Selection strategy. Default HIGHEST_ELEVATION. */
  strategy?: ServingStrategy | SelectionCallback;
  /** LONGEST_REMAINING_VISIBILITY: number of top-elevation candidates examined. Default 5. */
  lookaheadTopK?: number;
  /** LONGEST_REMAINING_VISIBILITY: cap on the lookahead, seconds. Default 600. */
  lookaheadHorizonSec?: number;
  /** BEST_LINK_MARGIN: carrier frequency, Hz. */
  frequencyHz?: Hertz;
  /**
   * Continuous mode only: switch when the best candidate's score exceeds the serving satellite's
   * by more than this margin (degrees for HIGHEST_ELEVATION, dB for BEST_LINK_MARGIN, seconds for
   * LONGEST_REMAINING_VISIBILITY). Undefined: never switch while the serving satellite is usable.
   * Checking costs a full evaluation at every sample.
   */
  hysteresis?: number;
  /** Record a per-sample az/el trace for {@link ServingSatelliteScheduler.addToSkyUsageGrid}. Default false. */
  recordSkyTrace?: boolean;
}

interface Assessment {
  /** Passed the cheap cone prefilter (could be in view). */
  inCone: boolean;
  usable: boolean;
  maskFail: boolean;
  scanFail: boolean;
  rangeFail: boolean;
  az: number;
  el: number;
  rng: number;
}

interface FullEval {
  cands: ServingCandidate[];
  gapReason: GapReason;
  blockedAz: number;
  blockedEl: number;
  hasBlocked: boolean;
}

function mod_(a: number, n: number): number {
  return ((a % n) + n) % n;
}

function newAssessment_(): Assessment {
  return { inCone: false, usable: false, maskFail: false, scanFail: false, rangeFail: false, az: 0, el: 0, rng: 0 };
}

/**
 * Chooses which satellite serves a ground terminal at each moment, and when it hands over.
 *
 * Fixed-interval mode (`reassignmentIntervalSec`): the whole source is evaluated only at ticks,
 * and between ticks only the serving satellite is checked every `sampleStepSec`. If it drops out
 * mid-interval, an early re-selection happens at that sample (reason SERVING_LOST). While no
 * satellite serves, the whole source is evaluated at every sample so service resumes at the first
 * usable sample rather than waiting for the next tick (reason GAP_RECOVERY).
 *
 * Gap reason precedence: only satellites above the geometric horizon (el >= 0) count as "in view".
 * The reason is the most permissive single rule whose relaxation would let an in-view satellite
 * serve: BELOW_MASK (minElevation/horizon) first, then OUTSIDE_SCAN (antenna), then OUT_OF_RANGE.
 * If no in-view satellite fails exactly one rule, the first of those rules failed by the
 * highest-elevation in-view satellite is reported. With nothing above the horizon the reason is
 * NOTHING_IN_VIEW. A user callback that declines gives NO_SELECTION.
 *
 * Time is sampled on a global grid of `sampleStepSec` anchored at `start` (start, start + step,
 * start + 2 step, ...), plus every tick, so ticks are exact. The grid does not restart at a tick:
 * with step 10 s and interval 15 s from :00 the samples are 0, 10, 15, 20, 30, 40, 45, 50 s.
 * Segment and gap edges therefore have `sampleStepSec` resolution (a satellite is declared lost at
 * the first sample where it is unusable). In fixed-interval mode a serving satellite that is usable
 * at a tick is always a candidate in that tick's selection, judged by the same rules as the others.
 *
 * @example
 * ```ts
 * const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 1584, 72, 1, epoch);
 * const schedule = ServingSatelliteScheduler.schedule({
 *   terminal, positions: PositionSource.fromSatellites(sats), start, end,
 *   reassignmentIntervalSec: 15, reassignmentPhaseSec: 12, minElevation: 25,
 * });
 * ```
 */
export class ServingSatelliteScheduler {
  private constructor() {
    // static utility
  }

  /**
   * Runs the scheduler.
   * @param o - Options.
   * @returns Segments, gaps and statistics.
   */
  static schedule(o: ServingSchedulerOptions): ServingSchedule {
    return new Run_(o).run();
  }

  /**
   * Adds a schedule's sky trace to a {@link SkyUsageGrid}: served samples as served time at the
   * serving satellite's az/el, rejected-by-mask samples as blocked time.
   * @param schedule - A schedule created with `recordSkyTrace: true`.
   * @param grid - Grid to accumulate into.
   * @throws ValidationError when the schedule has no sky trace.
   */
  static addToSkyUsageGrid(schedule: ServingSchedule, grid: SkyUsageGrid): void {
    if (!schedule.skyTrace) {
      throw new ValidationError('schedule has no skyTrace; set recordSkyTrace: true', 'recordSkyTrace', false);
    }
    for (const s of schedule.skyTrace) {
      grid.add(s.az, s.el, s.served, s.durationSec);
    }
  }
}

class Run_ {
  private readonly o_: ServingSchedulerOptions;
  private readonly src_: PositionSource;
  private readonly n_: number;
  private readonly gx_: number;
  private readonly gy_: number;
  private readonly gz_: number;
  private readonly rowE_: [number, number, number];
  private readonly rowN_: [number, number, number];
  private readonly rowU_: [number, number, number];
  private readonly sinThr_: number;
  private readonly minEl_: number;
  private readonly floor_: number;
  private readonly stepMs_: number;
  private readonly intervalMs_: number;
  private readonly phaseMs_: number;
  private readonly strategy_: ServingStrategy | SelectionCallback;
  private readonly all_: Float64Array;
  private readonly one_ = new Float64Array(3);
  private readonly isScan_: boolean;

  private serving_ = -1;
  private servingId_ = 0;
  private segStart_ = 0;
  private segAz_ = 0;
  private segEl_ = 0;
  private segReason_: HandoverReason = 'INITIAL';
  private gapStart_ = 0;
  private gapReason_: GapReason | null = null;
  private pending_: { tMs: number; az: number; el: number; served: boolean } | null = null;
  private readonly segments_: ServingSegment[] = [];
  private readonly gaps_: ServingGap[] = [];
  private readonly trace_: SkyTraceEntry[] = [];
  private readonly lastA_ = newAssessment_();
  private readonly scratchA_ = newAssessment_();

  constructor(o: ServingSchedulerOptions) {
    this.o_ = o;
    this.src_ = o.positions;
    this.n_ = o.positions.ids.length;
    this.validate_();
    const ecef = o.terminal.ecef();

    this.gx_ = ecef.x;
    this.gy_ = ecef.y;
    this.gz_ = ecef.z;
    // ECF -> ENU rotation, computed once (same rows as ecef2enu, geodetic latitude).
    const lat = o.terminal.lat * DEG2RAD;
    const lon = o.terminal.lon * DEG2RAD;
    const sl = Math.sin(lat);
    const cl = Math.cos(lat);
    const so = Math.sin(lon);
    const co = Math.cos(lon);

    this.rowE_ = [-so, co, 0];
    this.rowN_ = [-sl * co, -sl * so, cl];
    this.rowU_ = [cl * co, cl * so, sl];
    this.minEl_ = o.minElevation ?? 0;
    let thr = Math.min(0, this.minEl_);

    if (o.horizon) {
      for (const p of o.horizon.points) {
        thr = Math.min(thr, p.el);
      }
    }
    this.sinThr_ = Math.sin(thr * DEG2RAD);
    this.floor_ = o.antennaGainFloorDbi ?? 0;
    this.isScan_ = !!o.antenna && typeof (o.antenna as { isWithinScan?: unknown }).isWithinScan === 'function';
    this.stepMs_ = Math.round((o.sampleStepSec ?? 1) * 1000);
    this.intervalMs_ = o.reassignmentIntervalSec ? Math.round(o.reassignmentIntervalSec * 1000) : 0;
    this.phaseMs_ = this.intervalMs_ ? mod_(Math.round((o.reassignmentPhaseSec ?? 0) * 1000), this.intervalMs_) : 0;
    this.strategy_ = o.strategy ?? ServingStrategy.HIGHEST_ELEVATION;
    this.all_ = new Float64Array(3 * this.n_);
  }

  private validate_(): void {
    const o = this.o_;
    const bad = (m: string, f: string, v: unknown): never => {
      throw new ValidationError(m, f, v);
    };

    // Segments and gaps report satellites by id, so ids must be unique (Walker sets all share
    // sccNum 1 and need explicit ids).
    if (new Set(o.positions.ids).size !== o.positions.ids.length) {
      bad('positions.ids must be unique', 'positions.ids', o.positions.ids.length);
    }

    if (!(o.end.getTime() > o.start.getTime())) {
      bad('end must be after start', 'end', o.end);
    }
    if (o.sampleStepSec !== undefined && !(o.sampleStepSec > 0)) {
      bad('sampleStepSec must be positive', 'sampleStepSec', o.sampleStepSec);
    }
    // Time is kept in whole milliseconds; a step that rounds to 0 ms could never advance.
    if (o.sampleStepSec !== undefined && Math.round(o.sampleStepSec * 1000) < 1) {
      bad('sampleStepSec must be at least 0.001 s (1 ms resolution)', 'sampleStepSec', o.sampleStepSec);
    }
    if (o.reassignmentIntervalSec !== undefined && !(o.reassignmentIntervalSec > 0)) {
      bad('reassignmentIntervalSec must be positive', 'reassignmentIntervalSec', o.reassignmentIntervalSec);
    }
    // An interval that rounds to 0 ms would silently turn into continuous mode.
    if (o.reassignmentIntervalSec !== undefined && Math.round(o.reassignmentIntervalSec * 1000) < 1) {
      bad('reassignmentIntervalSec must be at least 0.001 s (1 ms resolution)', 'reassignmentIntervalSec', o.reassignmentIntervalSec);
    }
    if (o.strategy === ServingStrategy.BEST_LINK_MARGIN && !(o.frequencyHz && o.frequencyHz > 0)) {
      bad('BEST_LINK_MARGIN requires frequencyHz', 'frequencyHz', o.frequencyHz);
    }
    if (o.lookaheadTopK !== undefined && !(o.lookaheadTopK >= 1)) {
      bad('lookaheadTopK must be >= 1', 'lookaheadTopK', o.lookaheadTopK);
    }
    if (o.hysteresis !== undefined && !(o.hysteresis >= 0)) {
      bad('hysteresis must be >= 0', 'hysteresis', o.hysteresis);
    }
  }

  // ---------- geometry ----------

  /**
   * @param alwaysAzimuth - Compute `az` even when the cone prefilter rejects the satellite. The
   *   serving satellite needs it, since its segment end records the azimuth as it sets; the bulk
   *   scan skips it to keep the prefilter cheap.
   */
  private assess_(x: number, y: number, z: number, a: Assessment, alwaysAzimuth = false): Assessment {
    a.inCone = false;
    a.usable = false;
    a.maskFail = false;
    a.scanFail = false;
    a.rangeFail = false;
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
      return a;
    }
    const dx = x - this.gx_;
    const dy = y - this.gy_;
    const dz = z - this.gz_;
    const rng = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const u = this.rowU_[0] * dx + this.rowU_[1] * dy + this.rowU_[2] * dz;

    a.rng = rng;
    a.el = Math.asin(Math.max(-1, Math.min(1, u / rng))) * RAD2DEG;
    // Cheap cone test before the horizontal components and atan2.
    if (u < this.sinThr_ * rng) {
      if (alwaysAzimuth) {
        a.az = this.azimuth_(dx, dy, dz);
      }

      return a;
    }
    a.inCone = true;
    a.az = this.azimuth_(dx, dy, dz);
    const o = this.o_;
    let floor = this.minEl_;

    if (o.horizon) {
      floor = Math.max(floor, o.horizon.elevationAt(a.az));
    }
    a.maskFail = a.el < floor;
    a.rangeFail = o.maxRange !== undefined && rng > o.maxRange;
    if (o.antenna) {
      a.scanFail = this.isScan_
        ? !(o.antenna as unknown as { isWithinScan(az: number, el: number): boolean }).isWithinScan(a.az, a.el)
        : !(o.antenna.getGainToward(a.az as never, a.el as never) > this.floor_);
    }
    a.usable = !a.maskFail && !a.scanFail && !a.rangeFail;

    return a;
  }

  private subset_(tMs: number, indices: ArrayLike<number>, out: Float64Array): void {
    const d = new Date(tMs);

    if (this.src_.positionsEcfSubset) {
      this.src_.positionsEcfSubset(d, indices, out);

      return;
    }
    this.src_.positionsEcf(d, this.all_);
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];

      out[3 * k] = this.all_[3 * i];
      out[3 * k + 1] = this.all_[3 * i + 1];
      out[3 * k + 2] = this.all_[3 * i + 2];
    }
  }

  /** Azimuth (deg, 0-360) of an ECF offset from the ground site. */
  private azimuth_(dx: number, dy: number, dz: number): number {
    const e = this.rowE_[0] * dx + this.rowE_[1] * dy;
    const nn = this.rowN_[0] * dx + this.rowN_[1] * dy + this.rowN_[2] * dz;

    return mod_(Math.atan2(e, nn) * RAD2DEG, 360);
  }

  private assessOne_(idx: number, tMs: number): Assessment {
    this.subset_(tMs, [idx], this.one_);

    return this.assess_(this.one_[0], this.one_[1], this.one_[2], this.lastA_, true);
  }

  private fullEval_(tMs: number): FullEval {
    this.src_.positionsEcf(new Date(tMs), this.all_);
    const ids = this.src_.ids;
    const cands: ServingCandidate[] = [];
    const a = this.scratchA_;
    let exM = 0;
    let exS = 0;
    let exR = 0;
    let bestEl = -Infinity;
    let bestFlags: [boolean, boolean, boolean] = [false, false, false];
    let blockedEl = -Infinity;
    let blockedAz = 0;

    for (let i = 0; i < this.n_; i++) {
      this.assess_(this.all_[3 * i], this.all_[3 * i + 1], this.all_[3 * i + 2], a);
      if (!a.inCone) {
        continue;
      }
      if (a.usable) {
        cands.push({ id: ids[i], index: i, az: a.az, el: a.el, rangeKm: a.rng });
        continue;
      }
      if (a.el < 0) {
        continue;
      }
      const fails = (a.maskFail ? 1 : 0) + (a.scanFail ? 1 : 0) + (a.rangeFail ? 1 : 0);

      if (fails === 1) {
        exM += a.maskFail ? 1 : 0;
        exS += a.scanFail ? 1 : 0;
        exR += a.rangeFail ? 1 : 0;
      }
      if (a.el > bestEl) {
        bestEl = a.el;
        bestFlags = [a.maskFail, a.scanFail, a.rangeFail];
      }
      if (a.maskFail && a.el > blockedEl) {
        blockedEl = a.el;
        blockedAz = a.az;
      }
    }
    let reason: GapReason = 'NOTHING_IN_VIEW';

    if (bestEl > -Infinity) {
      if (exM > 0) {
        reason = 'BELOW_MASK';
      } else if (exS > 0) {
        reason = 'OUTSIDE_SCAN';
      } else if (exR > 0) {
        reason = 'OUT_OF_RANGE';
      } else if (bestFlags[0]) {
        reason = 'BELOW_MASK';
      } else if (bestFlags[1]) {
        reason = 'OUTSIDE_SCAN';
      } else {
        reason = 'OUT_OF_RANGE';
      }
    }

    return { cands, gapReason: reason, blockedAz, blockedEl, hasBlocked: blockedEl > -Infinity };
  }

  // ---------- selection ----------

  /** Remaining usable seconds from tMs0 for each satellite index (capped at the lookahead horizon). */
  private remaining_(idx: number[], tMs0: number): number[] {
    const horizon = (this.o_.lookaheadHorizonSec ?? 600) * 1000;
    const out = idx.map(() => horizon / 1000);
    let alive = idx.map((_, k) => k);
    const buf = new Float64Array(3 * idx.length);
    const a = newAssessment_();

    for (let dt = this.stepMs_; dt <= horizon && alive.length > 0; dt += this.stepMs_) {
      this.subset_(tMs0 + dt, alive.map((k) => idx[k]), buf);
      const next: number[] = [];

      alive.forEach((k, j) => {
        this.assess_(buf[3 * j], buf[3 * j + 1], buf[3 * j + 2], a);
        if (a.usable) {
          next.push(k);
        } else {
          out[k] = dt / 1000;
        }
      });
      alive = next;
    }

    return out;
  }

  /** Strategy scores (higher is better) for built-in strategies; `must` is force-included in lookahead. */
  private scores_(cands: ServingCandidate[], tMs: number, must: number): number[] {
    const s = this.strategy_;

    if (s === ServingStrategy.BEST_LINK_MARGIN) {
      const o = this.o_;

      return cands.map((c) => (o.antenna ? o.antenna.getGainToward(c.az as never, c.el as never) : 0) -
        calculateFspl(c.rangeKm, o.frequencyHz as Hertz));
    }
    if (s === ServingStrategy.LONGEST_REMAINING_VISIBILITY) {
      const k = this.o_.lookaheadTopK ?? 5;
      const order = cands.map((_, i) => i).sort((p, q) => cands[q].el - cands[p].el);
      const top = order.slice(0, k);
      const mustPos = cands.findIndex((c) => c.index === must);

      if (mustPos >= 0 && !top.includes(mustPos)) {
        top.push(mustPos);
      }
      const rem = this.remaining_(top.map((i) => cands[i].index), tMs);
      const out = cands.map(() => -Infinity);

      top.forEach((ci, j) => {
        // elevation breaks ties between equal remaining times (and the horizon cap)
        out[ci] = rem[j] + cands[ci].el * 1e-6;
      });

      return out;
    }

    return cands.map((c) => c.el);
  }

  private bestOf_(scores: number[]): number {
    let best = 0;

    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[best]) {
        best = i;
      }
    }

    return best;
  }

  /** Position in `cands` of the strategy's pick, or -1. */
  private select_(cands: ServingCandidate[], tMs: number, isTick: boolean): number {
    if (cands.length === 0) {
      return -1;
    }
    if (typeof this.strategy_ === 'function') {
      const id = this.strategy_(cands, { time: new Date(tMs), servingId: this.serving_ >= 0 ? this.servingId_ : null, isTick });

      return id === null ? -1 : cands.findIndex((c) => c.id === id);
    }

    return this.bestOf_(this.scores_(cands, tMs, -1));
  }

  // ---------- state machine ----------

  private endSegment_(tMs: number, az: number, el: number): void {
    this.segments_.push({
      satId: this.servingId_,
      start: new Date(this.segStart_),
      end: new Date(tMs),
      startAz: this.segAz_,
      startEl: this.segEl_,
      endAz: az,
      endEl: el,
      handoverReason: this.segReason_,
    });
    this.serving_ = -1;
  }

  private startSegment_(tMs: number, c: ServingCandidate, reason: HandoverReason): void {
    this.serving_ = c.index;
    this.servingId_ = c.id;
    this.segStart_ = tMs;
    this.segAz_ = c.az;
    this.segEl_ = c.el;
    this.segReason_ = reason;
    this.setPending_(tMs, c.az, c.el, true);
  }

  private closeGap_(tMs: number): void {
    if (this.gapReason_ !== null) {
      this.gaps_.push({ start: new Date(this.gapStart_), end: new Date(tMs), reason: this.gapReason_ });
      this.gapReason_ = null;
    }
  }

  private enterGap_(tMs: number, full: FullEval): void {
    const reason: GapReason = full.cands.length > 0 ? 'NO_SELECTION' : full.gapReason;

    if (this.gapReason_ !== reason) {
      this.closeGap_(tMs);
      this.gapReason_ = reason;
      this.gapStart_ = tMs;
    }
    if (full.hasBlocked) {
      this.setPending_(tMs, full.blockedAz, full.blockedEl, false);
    }
  }

  private setPending_(tMs: number, az: number, el: number, served: boolean): void {
    if (this.o_.recordSkyTrace) {
      this.pending_ = { tMs, az, el, served };
    }
  }

  private flushTrace_(untilMs: number): void {
    const p = this.pending_;

    if (p) {
      this.trace_.push({ time: new Date(p.tMs), durationSec: (untilMs - p.tMs) / 1000, az: p.az, el: p.el, served: p.served });
      this.pending_ = null;
    }
  }

  private nextTick_(tMs: number): number {
    if (!this.intervalMs_) {
      return Infinity;
    }

    return this.phaseMs_ + (Math.floor((tMs - this.phaseMs_) / this.intervalMs_) + 1) * this.intervalMs_;
  }

  private isTick_(tMs: number): boolean {
    return this.intervalMs_ > 0 && mod_(tMs - this.phaseMs_, this.intervalMs_) === 0;
  }

  private process_(tMs: number, initial: boolean): void {
    const fixed = this.intervalMs_ > 0;
    const tick = initial || this.isTick_(tMs);
    const isCallback = typeof this.strategy_ === 'function';

    if (this.serving_ < 0) {
      const full = this.fullEval_(tMs);
      const pos = this.select_(full.cands, tMs, tick);

      if (pos >= 0) {
        this.closeGap_(tMs);
        this.startSegment_(tMs, full.cands[pos], initial ? 'INITIAL' : 'GAP_RECOVERY');
      } else {
        this.enterGap_(tMs, full);
      }

      return;
    }
    const a = this.assessOne_(this.serving_, tMs);
    const ok = a.usable;
    const sAz = a.az;
    const sEl = a.el;
    // Between ticks a usable serving satellite is only re-examined in continuous mode with a
    // hysteresis margin or a callback strategy.
    const recheck = !fixed && (this.o_.hysteresis !== undefined || isCallback);

    if (ok && !tick && !recheck) {
      this.setPending_(tMs, sAz, sEl, true);

      return;
    }
    const full = this.fullEval_(tMs);

    if (!ok) {
      this.endSegment_(tMs, sAz, sEl);
      const pos = this.select_(full.cands, tMs, tick);

      if (pos >= 0) {
        this.startSegment_(tMs, full.cands[pos], 'SERVING_LOST');
      } else {
        this.enterGap_(tMs, full);
      }

      return;
    }
    const servingIdx = this.serving_;
    let cur = full.cands.findIndex((c) => c.index === servingIdx);

    if (cur < 0) {
      // The serving satellite is usable by its own assessment but absent from the full evaluation
      // (the subset and full position paths can differ at a mask or scan edge). Judge it like any
      // other candidate instead of treating it as lost, which would force a handover.
      full.cands.push({ id: this.servingId_, index: servingIdx, az: sAz, el: sEl, rangeKm: a.rng });
      cur = full.cands.length - 1;
    }
    let target = -1;

    if (isCallback) {
      const pos = this.select_(full.cands, tMs, tick);

      target = pos >= 0 && pos !== cur ? pos : -1;
    } else if (full.cands.length > 0) {
      const sc = this.scores_(full.cands, tMs, servingIdx);
      const best = this.bestOf_(sc);

      if (best !== cur) {
        if (fixed) {
          target = best;
        } else if (cur >= 0 && sc[best] > sc[cur] + (this.o_.hysteresis ?? Infinity)) {
          target = best;
        }
      }
    }
    if (target >= 0) {
      this.endSegment_(tMs, sAz, sEl);
      this.startSegment_(tMs, full.cands[target], fixed && tick ? 'SCHEDULED' : 'BETTER_CANDIDATE');
    } else {
      this.setPending_(tMs, sAz, sEl, true);
    }
  }

  run(): ServingSchedule {
    const startMs = this.o_.start.getTime();
    const endMs = this.o_.end.getTime();
    let t = startMs;

    this.process_(t, true);
    for (;;) {
      // Global grid anchored at start, so the grid does not restart at each tick.
      const nextGrid = startMs + (Math.floor((t - startMs) / this.stepMs_) + 1) * this.stepMs_;
      const next = Math.min(nextGrid, this.nextTick_(t), endMs);

      this.flushTrace_(next);
      if (next >= endMs) {
        break;
      }
      t = next;
      this.process_(t, false);
    }
    if (this.serving_ >= 0) {
      const a = this.assessOne_(this.serving_, endMs);

      this.endSegment_(endMs, a.az, a.el);
    }
    this.closeGap_(endMs);

    return this.finish_(startMs, endMs);
  }

  private finish_(startMs: number, endMs: number): ServingSchedule {
    const span = (endMs - startMs) / 1000;
    let served = 0;
    let handovers = 0;

    for (const s of this.segments_) {
      served += (s.end.getTime() - s.start.getTime()) / 1000;
      if (s.handoverReason === 'SCHEDULED' || s.handoverReason === 'SERVING_LOST' || s.handoverReason === 'BETTER_CANDIDATE') {
        handovers++;
      }
    }
    let longest = 0;

    for (const g of this.gaps_) {
      longest = Math.max(longest, (g.end.getTime() - g.start.getTime()) / 1000);
    }
    const result: ServingSchedule = {
      segments: this.segments_,
      gaps: this.gaps_,
      stats: {
        servedFraction: span > 0 ? served / span : 0,
        handoverCount: handovers,
        longestGapSec: longest,
        meanSegmentSec: this.segments_.length ? served / this.segments_.length : 0,
      },
    };

    if (this.o_.recordSkyTrace) {
      result.skyTrace = this.trace_;
    }

    return result;
  }
}
