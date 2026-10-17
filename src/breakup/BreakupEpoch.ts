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
import type { Seconds } from '../types/types';
import { RAD2DEG, secondsPerDay, TAU } from '../utils/constants';
import { type BreakupFragmentInput, type NormalizedFragment, normalizeFragment } from './BreakupFragments';

/**
 * Breakup epoch estimation by orbit-plane convergence.
 *
 * Every fragment of a breakup leaves the parent from one point at one instant. Afterwards the
 * secular J2 nodal regression, which depends on each fragment's own a, e and i, fans the orbit
 * planes out in right ascension. Carrying every fragment's RAAN back in time with its own secular
 * rate, the spread of the planes shrinks to a minimum near the event epoch.
 *
 * The estimator carries RAAN back with the closed-form secular J2 rate. It does not run SGP4 per
 * trial epoch: one multiply-add per fragment per trial is enough for the plane orientation, so a
 * 500-fragment, 2000-step scan costs a few million flops. It evaluates the spread on a coarse grid
 * over the search window, refines the global minimum with a golden-section search, and estimates
 * the uncertainty by bootstrap resampling of the fragments combined with the disagreement between
 * the two metrics below.
 *
 * ## Metrics
 *
 * - `raan`: circular standard deviation of RAAN, degrees. With `inclinationWeight` > 0 the
 *   spread is sqrt(sigmaRaan^2 + w sigmaInc^2). Inclination has no secular J2 drift, so the weight
 *   does not move the minimum; it raises the floor and makes the flat-valley test stricter. The
 *   RAAN minimum is biased (a few days for a LEO cloud 400 days old) when the breakup was neither
 *   at a node nor at the highest latitude: a cross-track kick then changes both RAAN and
 *   inclination, so the initial RAAN offsets correlate with the drift rates.
 * - `plane` (default): RMS angle (degrees) between the fragment orbit planes and the best common line
 *   through the Earth's centre, from the smallest eigenvalue of the mean outer product of the
 *   plane normals (plus `alongLineWeight` times the middle eigenvalue). At the event every plane
 *   contains the parent's radius vector, so in the secular model the pure metric is exactly zero at
 *   the event and unbiased. It loses sensitivity when the breakup happened near the highest or
 *   lowest latitude of the orbit (argument of latitude near +/-90 deg), where RAAN drift turns the
 *   normals about the common line itself; the small along-line weight keeps a usable minimum there.
 *
 * A check metric is also minimized and its distance from the estimate enters `uncertaintySec`
 * (see {@link BreakupEpochEstimate.metricDisagreementSec}).
 *
 * `plane` is the default because the `raan` bias does not shrink with the age of the elements:
 * for a 20-day-old synthetic LEO cloud (argument of latitude 30 deg) `raan` is 2.4 days off while
 * `plane` is within minutes.
 */

/** Spread metric. See the module comment. */
export type BreakupSpreadMetric = 'raan' | 'plane';
/** How RAAN is carried back: linear secular J2 only, or with a quadratic term from ndot. */
export type BreakupDragModel = 'none' | 'mean-motion-derivative';
/** Overall confidence in the estimate. */
export type BreakupEpochQuality = 'good' | 'weak' | 'none';
/** Why the quality is not `good`. */
export type BreakupQualityReason =
  /** Fewer than 3 usable fragments (quality `none`, no epoch). */
  | 'too-few-fragments'
  /** Fewer than 10 usable fragments (quality `weak`). */
  | 'few-fragments'
  /** The fragments' RAAN rates are (nearly) identical, so the planes never converge (`none`, no epoch). */
  | 'indistinguishable-drift-rates'
  /**
   * The minimum sits within two coarse steps of the window edge: the event may lie outside the
   * window. `weak` when the window can still be widened, `none` (no epoch) when it is final (see
   * {@link BreakupEpochEstimate.windowFinal}).
   */
  | 'minimum-at-window-edge'
  /**
   * The spread curve barely changes across the window, or the valley spans the whole window.
   * `weak` when the window can still be widened, `none` (no epoch) when it is final.
   */
  | 'flat-valley'
  /** `uncertaintySec` exceeds `maxGoodUncertaintySec`. */
  | 'large-uncertainty'
  /** The median element epoch is more than `oldElementsDays` after the estimate; drag and the secular model degrade it. */
  | 'old-elements';

/** Default look-back before the earliest fragment epoch, days. */
export const DEFAULT_BREAKUP_LOOKBACK_DAYS = 30;
/**
 * Cap on `lookbackDays`, days. It does not limit a window given by `searchStart` or anchored on
 * `launchEpoch`.
 */
export const MAX_BREAKUP_LOOKBACK_DAYS = 730;
/** Default margin before `launchEpoch` when it anchors the search window, days. */
export const DEFAULT_BREAKUP_LAUNCH_MARGIN_DAYS = 1;
/** Default along-line weight of the `plane` metric. */
export const DEFAULT_BREAKUP_ALONG_LINE_WEIGHT = 0.003;
/** Default outlier-rejection fraction (see {@link BreakupEpochOptions.trimFraction}). */
export const DEFAULT_BREAKUP_TRIM_FRACTION = 0.1;
/** Default drag filter: fragments with |ndot| above this (rev/day^2) are dropped when ndot is known. */
export const DEFAULT_BREAKUP_MAX_MEAN_MOTION_DOT = 5e-4;

export interface BreakupEpochOptions {
  /**
   * Start of the search window. Overrides `launchEpoch` and `lookbackDays`, and is not capped at
   * {@link MAX_BREAKUP_LOOKBACK_DAYS}. A window given this way is final: an edge minimum or a flat
   * valley in it gives quality `none`.
   */
  searchStart?: EpochUTC;
  /**
   * End of the search window. Defaults to the EARLIEST fragment epoch: the event cannot be later
   * than the first element set of any of its fragments.
   */
  searchEnd?: EpochUTC;
  /**
   * Launch epoch of the parent (for example the launch date behind its International Designator).
   * When given and `searchStart` is not, the window runs from `launchEpoch` minus
   * `launchMarginDays` (and at least three coarse steps) to `searchEnd`, with no length cap. The
   * event cannot precede the launch, so the window is final.
   */
  launchEpoch?: EpochUTC;
  /** Margin before `launchEpoch`, days. Default 1 ({@link DEFAULT_BREAKUP_LAUNCH_MARGIN_DAYS}). */
  launchMarginDays?: number;
  /**
   * Look-back before `searchEnd` when neither `searchStart` nor `launchEpoch` is given, days.
   * Default 30, capped at {@link MAX_BREAKUP_LOOKBACK_DAYS}. A look-back at the cap is final.
   */
  lookbackDays?: number;
  /** Coarse grid step, seconds. Default: window / 2000, clamped to [60 s, 6 h]. */
  coarseStepSec?: number;
  /** Golden-section refinement tolerance, seconds. Default 60. */
  toleranceSec?: number;
  /** Spread metric. Default `plane`. */
  metric?: BreakupSpreadMetric;
  /** Inclination weight for the `raan` metric. Default 0. */
  inclinationWeight?: number;
  /**
   * `plane` metric only: weight of the along-line scatter (middle eigenvalue) added to the
   * off-line scatter (smallest eigenvalue). Default 0.003; 0 is the pure common-line metric.
   */
  alongLineWeight?: number;
  /** Drop fragments whose |ndot| (rev/day^2) exceeds this, when ndot is known. Default 5e-4; Infinity disables. */
  maxMeanMotionDot?: number;
  /**
   * Drag model. Default `mean-motion-derivative`: when ndot is known (TLE input) RAAN gets the
   * quadratic term from n(t) = n0 + ndot dt; elements without ndot are carried back linearly.
   */
  dragModel?: BreakupDragModel;
  /**
   * Outlier rejection, 0 to 0.5. After a first pass, this fraction of fragments farthest from the
   * circular mean RAAN at the first-pass epoch is dropped and the search runs again. Default 0.1.
   */
  trimFraction?: number;
  /** The valley half-width is where the spread is within this fraction of the minimum. Default 0.1. */
  valleyTolerance?: number;
  /** Bootstrap resamples; 0 disables (the valley half-width then stands in for the statistical part). Default 64. */
  bootstrapSamples?: number;
  /** Seed for the deterministic bootstrap PRNG. Default 1. */
  seed?: number;
  /** Uncertainty above this is flagged `large-uncertainty`, seconds. Default 3 days. */
  maxGoodUncertaintySec?: number;
  /** Elements older than this (median epoch minus estimate) are flagged `old-elements`, days. Default 180. */
  oldElementsDays?: number;
  /** Below this differential RAAN drift across the window (deg) the rates count as indistinguishable. Default 0.01. */
  minDifferentialDriftDeg?: number;
}

export interface BreakupEpochEstimate {
  /** Epoch of minimum plane spread, or null when quality is `none`. */
  epoch: EpochUTC | null;
  /**
   * Spread at the minimum, degrees (metric-dependent; see {@link BreakupSpreadMetric}). Also
   * filled when a final window gives quality `none` with no epoch.
   */
  spreadAtMinDeg: number;
  /** Spread with every fragment carried to `nowEpoch` (the latest fragment epoch), degrees. */
  spreadNowDeg: number;
  /** The latest fragment epoch. */
  nowEpoch: EpochUTC;
  /**
   * 1-sigma uncertainty of `epoch`, seconds: hypot(statistical, metricDisagreementSec), where the
   * statistical part is the bootstrap std (or the valley half-width when bootstrap is off),
   * floored at the refinement tolerance. With `flat-valley` it is floored at `valleyHalfWidthSec`:
   * a flat curve cannot pin the epoch more tightly than its valley, however consistent the
   * bootstrap minima are (they all sit at the same window edge).
   */
  uncertaintySec: number;
  /** Bootstrap standard deviation of the minimum epoch, seconds (NaN when disabled). */
  bootstrapStdSec: number;
  /**
   * Systematic-error indicator, seconds: |epoch - the minimum of a check metric|. The check for
   * `raan` is the default `plane` metric; for `plane` it is the pure common-line metric.
   */
  metricDisagreementSec: number;
  /** Half-width of the interval where the spread is within `valleyTolerance` of the minimum, seconds. */
  valleyHalfWidthSec: number;
  quality: BreakupEpochQuality;
  reasons: BreakupQualityReason[];
  metric: BreakupSpreadMetric;
  /** Fragments that went into the estimate. */
  fragmentsUsed: number;
  /** Fragments dropped as unparseable or non-elliptic. */
  fragmentsInvalid: number;
  /** Fragments dropped by the ndot drag filter. */
  fragmentsDragFiltered: number;
  /** Fragments dropped by `trimFraction`. */
  fragmentsTrimmed: number;
  searchStart: EpochUTC;
  searchEnd: EpochUTC;
  /**
   * True when the window cannot usefully be widened: it came from `searchStart`, from
   * `launchEpoch`, or from a look-back at {@link MAX_BREAKUP_LOOKBACK_DAYS}. In a final window an
   * edge minimum or a flat valley gives quality `none` and no epoch; in any other window they give
   * `weak`, and the caller can search again over a wider one.
   */
  windowFinal: boolean;
  /** The coarse spread curve of the chosen metric, for plotting. */
  curve: { posix: Float64Array; spreadDeg: Float64Array };
}

const GOLDEN = (Math.sqrt(5) - 1) / 2;
const MIN_FRAGMENTS = 3;
const FEW_FRAGMENTS = 10;
const LOCAL_GRID_POINTS = 25;
const FLAT_CONTRAST = 1.2;

/** Typed-array view of the fragment set, so a spread evaluation is one tight loop. */
interface Cloud_ {
  count: number;
  t0: Float64Array;
  raan0: Float64Array;
  rate: Float64Array;
  quad: Float64Array;
  incDeg: Float64Array;
  sinI: Float64Array;
  cosI: Float64Array;
  /** Scratch buffer sized to `count`. */
  angle: Float64Array;
}

const buildCloud_ = (frags: NormalizedFragment[], dragModel: BreakupDragModel): Cloud_ => {
  const n = frags.length;
  const cloud: Cloud_ = {
    count: n,
    t0: new Float64Array(n),
    raan0: new Float64Array(n),
    rate: new Float64Array(n),
    quad: new Float64Array(n),
    incDeg: new Float64Array(n),
    sinI: new Float64Array(n),
    cosI: new Float64Array(n),
    angle: new Float64Array(n),
  };

  frags.forEach((f, k) => {
    cloud.t0[k] = f.epochPosix;
    cloud.raan0[k] = f.rightAscension;
    cloud.rate[k] = f.raanDot;
    /*
     * RAAN-dot scales as n^(7/3) (n a^-2 (1 - e^2)^-2 with a ~ n^(-2/3)), so with n(t) = n0 + ndot dt
     * the RAAN picks up 1/2 (7/3) RAAN-dot (ndot / n) dt^2.
     */
    if (dragModel === 'mean-motion-derivative' && Number.isFinite(f.meanMotionDot)) {
      cloud.quad[k] = 0.5 * (7 / 3) * f.raanDot * (f.meanMotionDot / f.revsPerDay / secondsPerDay);
    }
    cloud.incDeg[k] = f.inclination * RAD2DEG;
    cloud.sinI[k] = Math.sin(f.inclination);
    cloud.cosI[k] = Math.cos(f.inclination);
  });

  return cloud;
};

const wrapPi_ = (x: number): number => ((((x + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/**
 * Smallest and middle eigenvalues of a symmetric 3x3 matrix (Smith 1961 trigonometric method).
 * @returns [smallest, middle].
 */
const lowEigen3_ = (a00: number, a01: number, a02: number, a11: number, a12: number, a22: number): [number, number] => {
  const p1 = a01 * a01 + a02 * a02 + a12 * a12;
  const q = (a00 + a11 + a22) / 3;
  const p2 = (a00 - q) ** 2 + (a11 - q) ** 2 + (a22 - q) ** 2 + 2 * p1;
  const p = Math.sqrt(p2 / 6);

  if (p < 1e-300) {
    return [q, q];
  }
  const b00 = (a00 - q) / p;
  const b11 = (a11 - q) / p;
  const b22 = (a22 - q) / p;
  const b01 = a01 / p;
  const b02 = a02 / p;
  const b12 = a12 / p;
  const det = b00 * (b11 * b22 - b12 * b12) - b01 * (b01 * b22 - b12 * b02) + b02 * (b01 * b12 - b11 * b02);
  const phi = Math.acos(Math.max(-1, Math.min(1, det / 2))) / 3;
  const largest = q + 2 * p * Math.cos(phi);
  const smallest = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);

  return [smallest, 3 * q - largest - smallest];
};

interface SpreadSettings_ {
  metric: BreakupSpreadMetric;
  inclinationWeight: number;
  alongLineWeight: number;
}

/** Fills `cloud.angle` with each listed fragment's RAAN at `t` (POSIX seconds). */
const raansAt_ = (cloud: Cloud_, t: number, idx: Int32Array | null): number => {
  const m = idx ? idx.length : cloud.count;
  const { angle } = cloud;

  for (let j = 0; j < m; j++) {
    const k = idx ? idx[j] : j;
    const dt = t - cloud.t0[k];

    angle[j] = cloud.raan0[k] + cloud.rate[k] * dt + cloud.quad[k] * dt * dt;
  }

  return m;
};

const planeSpread_ = (cloud: Cloud_, s: SpreadSettings_, m: number, idx: Int32Array | null): number => {
  const { angle } = cloud;
  let xx = 0;
  let xy = 0;
  let xz = 0;
  let yy = 0;
  let yz = 0;
  let zz = 0;

  for (let j = 0; j < m; j++) {
    const k = idx ? idx[j] : j;
    const x = cloud.sinI[k] * Math.sin(angle[j]);
    const y = -cloud.sinI[k] * Math.cos(angle[j]);
    const z = cloud.cosI[k];

    xx += x * x;
    xy += x * y;
    xz += x * z;
    yy += y * y;
    yz += y * z;
    zz += z * z;
  }
  const [lMin, lMid] = lowEigen3_(xx / m, xy / m, xz / m, yy / m, yz / m, zz / m);
  const lambda = Math.max(0, lMin) + s.alongLineWeight * Math.max(0, lMid);

  return Math.asin(Math.min(1, Math.sqrt(lambda))) * RAD2DEG;
};

const raanSpread_ = (cloud: Cloud_, s: SpreadSettings_, m: number, idx: Int32Array | null): number => {
  const { angle } = cloud;
  let c = 0;
  let sn = 0;

  for (let j = 0; j < m; j++) {
    c += Math.cos(angle[j]);
    sn += Math.sin(angle[j]);
  }
  const r = Math.min(1, Math.hypot(c, sn) / m);
  const raanStdDeg = r > 0 ? Math.sqrt(-2 * Math.log(r)) * RAD2DEG : 180;

  if (s.inclinationWeight <= 0) {
    return raanStdDeg;
  }
  let sum = 0;
  let sum2 = 0;

  for (let j = 0; j < m; j++) {
    const inc = cloud.incDeg[idx ? idx[j] : j];

    sum += inc;
    sum2 += inc * inc;
  }
  const incVar = Math.max(0, sum2 / m - (sum / m) ** 2);

  return Math.sqrt(raanStdDeg * raanStdDeg + s.inclinationWeight * incVar);
};

/** Spread (degrees) of the fragments listed in `idx` (or all of them) at `t` (POSIX seconds). */
const spreadAt_ = (cloud: Cloud_, s: SpreadSettings_, t: number, idx: Int32Array | null): number => {
  const m = raansAt_(cloud, t, idx);

  return s.metric === 'plane' ? planeSpread_(cloud, s, m, idx) : raanSpread_(cloud, s, m, idx);
};

/** Golden-section minimum of `f` on [lo, hi] to within `tol`. */
const goldenSection_ = (f: (t: number) => number, lo: number, hi: number, tol: number): number => {
  let a = lo;
  let b = hi;
  let x1 = b - GOLDEN * (b - a);
  let x2 = a + GOLDEN * (b - a);
  let f1 = f(x1);
  let f2 = f(x2);

  while (b - a > tol) {
    if (f1 <= f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = b - GOLDEN * (b - a);
      f1 = f(x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + GOLDEN * (b - a);
      f2 = f(x2);
    }
  }

  return f1 <= f2 ? x1 : x2;
};

/** Index of the smallest value. */
const argMin_ = (xs: Float64Array): number => {
  let best = 0;

  for (let i = 1; i < xs.length; i++) {
    if (xs[i] < xs[best]) {
      best = i;
    }
  }

  return best;
};

/** Grid scan of `f` over [lo, hi] then golden-section polish between the best sample's neighbours. */
const scanAndRefine_ = (f: (t: number) => number, lo: number, hi: number, points: number, tol: number): number => {
  const step = (hi - lo) / (points - 1);
  const values = new Float64Array(points);

  for (let i = 0; i < points; i++) {
    values[i] = f(lo + i * step);
  }
  const best = argMin_(values);

  return goldenSection_(f, lo + Math.max(0, best - 1) * step, lo + Math.min(points - 1, best + 1) * step, tol);
};

/** Mulberry32: small deterministic PRNG so the bootstrap is reproducible. */
const mulberry32_ = (seed: number): (() => number) => {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Crossing of `f` with `level` between an inside point and an outside point, by bisection. */
const bisectCrossing_ = (f: (t: number) => number, inside: number, outside: number, level: number, tol: number): number => {
  let a = inside;
  let b = outside;

  while (Math.abs(b - a) > tol) {
    const mid = 0.5 * (a + b);

    if (f(mid) <= level) {
      a = mid;
    } else {
      b = mid;
    }
  }

  return 0.5 * (a + b);
};

const epochOf_ = (posix: number): EpochUTC => new EpochUTC(posix as Seconds);

const median_ = (xs: Float64Array): number => {
  const s = Float64Array.from(xs).sort();
  const mid = s.length >> 1;

  return s.length % 2 ? s[mid] : 0.5 * (s[mid - 1] + s[mid]);
};

const stdOf_ = (xs: Float64Array): number => {
  let mean = 0;

  xs.forEach((x) => {
    mean += x;
  });
  mean /= xs.length;
  let v = 0;

  xs.forEach((x) => {
    v += (x - mean) ** 2;
  });

  return Math.sqrt(v / Math.max(1, xs.length - 1));
};

/** Coarse grid step for a window of `window` seconds: `coarseStepSec`, else window / 2000 clamped to [60 s, 6 h]. */
const coarseStep_ = (window: number, options: BreakupEpochOptions): number => options.coarseStepSec ?? Math.min(6 * 3600, Math.max(60, window / 2000));

interface SearchWindow_ {
  start: number;
  end: number;
  /** See {@link BreakupEpochEstimate.windowFinal}. */
  final: boolean;
}

/** Search window in POSIX seconds from the options and the fragment epochs. */
const searchWindow_ = (frags: NormalizedFragment[], options: BreakupEpochOptions): SearchWindow_ => {
  const earliest = frags.length > 0 ? Math.min(...frags.map((f) => f.epochPosix)) : Date.now() / 1000;
  const end = options.searchEnd ? options.searchEnd.posix : earliest;
  let start: number;
  let final: boolean;

  if (options.searchStart) {
    start = options.searchStart.posix;
    final = true;
  } else if (options.launchEpoch) {
    const marginDays = Math.max(0, options.launchMarginDays ?? DEFAULT_BREAKUP_LAUNCH_MARGIN_DAYS);
    // Keeps an event on launch day clear of the two-step edge test at the window start.
    const margin = Math.max(marginDays * secondsPerDay, 3 * coarseStep_(end - options.launchEpoch.posix, options));

    start = options.launchEpoch.posix - margin;
    final = true;
  } else {
    const lookbackDays = Math.max(0, options.lookbackDays ?? DEFAULT_BREAKUP_LOOKBACK_DAYS);

    start = end - Math.min(lookbackDays, MAX_BREAKUP_LOOKBACK_DAYS) * secondsPerDay;
    final = lookbackDays >= MAX_BREAKUP_LOOKBACK_DAYS;
  }

  return start < end ? { start, end, final } : { start: end - secondsPerDay, end, final };
};

/** One pass of the search over a fixed fragment set. */
interface Pass_ {
  cloud: Cloud_;
  curve: { posix: Float64Array; spreadDeg: Float64Array };
  step: number;
  tBest: number;
  spreadMin: number;
}

const runPass_ = (frags: NormalizedFragment[], s: SpreadSettings_, dragModel: BreakupDragModel, start: number, end: number, step0: number, tol: number): Pass_ => {
  const cloud = buildCloud_(frags, dragModel);
  const points = Math.max(3, Math.ceil((end - start) / Math.max(1, step0)) + 1);
  const step = (end - start) / (points - 1);
  const curve = { posix: new Float64Array(points), spreadDeg: new Float64Array(points) };

  for (let i = 0; i < points; i++) {
    curve.posix[i] = start + i * step;
    curve.spreadDeg[i] = spreadAt_(cloud, s, curve.posix[i], null);
  }
  const iBest = argMin_(curve.spreadDeg);
  const tBest = goldenSection_(
    (t) => spreadAt_(cloud, s, t, null), curve.posix[Math.max(0, iBest - 1)], curve.posix[Math.min(points - 1, iBest + 1)], tol,
  );

  return { cloud, curve, step, tBest, spreadMin: spreadAt_(cloud, s, tBest, null) };
};

/** Keeps the (1 - fraction) of fragments closest to the circular mean RAAN at `t`. */
const trimByRaan_ = (frags: NormalizedFragment[], t: number, fraction: number): NormalizedFragment[] => {
  const raans = frags.map((f) => f.rightAscension + f.raanDot * (t - f.epochPosix));
  const mean = Math.atan2(raans.reduce((a, r) => a + Math.sin(r), 0), raans.reduce((a, r) => a + Math.cos(r), 0));
  const resid = raans.map((r) => Math.abs(wrapPi_(r - mean)));
  const keep = Math.max(MIN_FRAGMENTS, Math.ceil(frags.length * (1 - fraction)));
  const order = resid.map((_, k) => k).sort((a, b) => resid[a] - resid[b]);

  return order.slice(0, keep).sort((a, b) => a - b).map((k) => frags[k]);
};

/** Half-width of the interval around the minimum where the spread stays at or below `level`. */
const valleyHalfWidth_ = (
  pass: Pass_, f: (t: number) => number, level: number, start: number, end: number, tol: number,
): { halfWidth: number; open: boolean } => {
  const { curve, step, tBest } = pass;
  const points = curve.posix.length;
  const iBest = Math.min(points - 1, Math.max(0, Math.round((tBest - start) / step)));
  let iLeft = iBest;
  let iRight = iBest;

  while (iLeft > 0 && curve.spreadDeg[iLeft] <= level) {
    iLeft--;
  }
  while (iRight < points - 1 && curve.spreadDeg[iRight] <= level) {
    iRight++;
  }
  const leftOpen = curve.spreadDeg[iLeft] <= level;
  const rightOpen = curve.spreadDeg[iRight] <= level;
  const left = leftOpen ? start : bisectCrossing_(f, Math.min(tBest, curve.posix[iLeft] + step), curve.posix[iLeft], level, tol);
  const right = rightOpen ? end : bisectCrossing_(f, Math.max(tBest, curve.posix[iRight] - step), curve.posix[iRight], level, tol);

  return { halfWidth: 0.5 * (right - left), open: leftOpen && rightOpen };
};

/** Bootstrap std of the minimum epoch: resample fragments with replacement, re-find the minimum near tBest. */
const bootstrapStd_ = (pass: Pass_, s: SpreadSettings_, samples: number, seed: number, lo: number, hi: number, tol: number): number => {
  const rand = mulberry32_(seed);
  const idx = new Int32Array(pass.cloud.count);
  const minima = new Float64Array(samples);

  for (let b = 0; b < samples; b++) {
    for (let j = 0; j < idx.length; j++) {
      idx[j] = Math.floor(rand() * pass.cloud.count);
    }
    minima[b] = scanAndRefine_((t) => spreadAt_(pass.cloud, s, t, idx), lo, hi, LOCAL_GRID_POINTS, tol);
  }

  return stdOf_(minima);
};

/**
 * Estimates the epoch of a breakup from its fragments' element sets by finding the epoch at which
 * their orbit planes, carried back with secular J2, are least spread out. See the module comment
 * for the method and the metrics.
 * @param fragments Fragment element sets: TLE lines (or `Tle` instances), `ClassicalElements`, or
 *   plain mean elements. Leave the parent out; it did not receive a kick like the fragments.
 * @param options Search and quality options.
 * @returns The estimate, with a quality flag and the reasons behind it.
 */
export const estimateBreakupEpoch = (fragments: readonly BreakupFragmentInput[], options: BreakupEpochOptions = {}): BreakupEpochEstimate => {
  const metric = options.metric ?? 'plane';
  const dragModel = options.dragModel ?? 'mean-motion-derivative';
  const maxNdot = options.maxMeanMotionDot ?? DEFAULT_BREAKUP_MAX_MEAN_MOTION_DOT;
  const tol = Math.max(1e-3, options.toleranceSec ?? 60);
  const trimFraction = Math.min(0.5, Math.max(0, options.trimFraction ?? DEFAULT_BREAKUP_TRIM_FRACTION));
  const settings: SpreadSettings_ = {
    metric,
    inclinationWeight: Math.max(0, options.inclinationWeight ?? 0),
    alongLineWeight: Math.max(0, options.alongLineWeight ?? DEFAULT_BREAKUP_ALONG_LINE_WEIGHT),
  };
  /*
   * Systematic check: `raan` is compared with the default `plane` metric; `plane` with the pure
   * common-line metric (alongLineWeight 0), or with the default weight when the pure one was asked for.
   */
  const checkSettings: SpreadSettings_ = metric === 'raan'
    ? { ...settings, metric: 'plane', alongLineWeight: DEFAULT_BREAKUP_ALONG_LINE_WEIGHT }
    : { ...settings, alongLineWeight: settings.alongLineWeight > 0 ? 0 : DEFAULT_BREAKUP_ALONG_LINE_WEIGHT };

  const parsed = fragments.map(normalizeFragment);
  const valid = parsed.filter((f): f is NormalizedFragment => f !== null);
  const filtered = valid.filter((f) => !(Math.abs(f.meanMotionDot) > maxNdot));
  const { start, end, final: windowFinal } = searchWindow_(filtered.length > 0 ? filtered : valid, options);
  const window = end - start;
  const step0 = coarseStep_(window, options);
  const emptyCurve = { posix: new Float64Array(0), spreadDeg: new Float64Array(0) };

  const result: BreakupEpochEstimate = {
    epoch: null,
    spreadAtMinDeg: Number.NaN,
    spreadNowDeg: Number.NaN,
    nowEpoch: epochOf_(filtered.length > 0 ? Math.max(...filtered.map((f) => f.epochPosix)) : end),
    uncertaintySec: Number.NaN,
    bootstrapStdSec: Number.NaN,
    metricDisagreementSec: Number.NaN,
    valleyHalfWidthSec: Number.NaN,
    quality: 'none',
    reasons: [],
    metric,
    fragmentsUsed: filtered.length,
    fragmentsInvalid: parsed.length - valid.length,
    fragmentsDragFiltered: valid.length - filtered.length,
    fragmentsTrimmed: 0,
    searchStart: epochOf_(start),
    searchEnd: epochOf_(end),
    windowFinal,
    curve: emptyCurve,
  };

  if (filtered.length < MIN_FRAGMENTS) {
    result.reasons.push('too-few-fragments');

    return result;
  }

  let used = filtered;
  let pass = runPass_(used, settings, dragModel, start, end, step0, tol);

  if (trimFraction > 0) {
    used = trimByRaan_(used, pass.tBest, trimFraction);
    pass = runPass_(used, settings, dragModel, start, end, step0, tol);
  }
  const { cloud, curve, step, tBest, spreadMin } = pass;
  const spread = (t: number): number => spreadAt_(cloud, settings, t, null);

  result.fragmentsUsed = used.length;
  result.fragmentsTrimmed = filtered.length - used.length;
  result.curve = curve;
  result.spreadNowDeg = spread(result.nowEpoch.posix);

  if (stdOf_(cloud.rate) * window * RAD2DEG < (options.minDifferentialDriftDeg ?? 0.01)) {
    result.reasons.push('indistinguishable-drift-rates');

    return result;
  }

  const level = Math.max(spreadMin * (1 + (options.valleyTolerance ?? 0.1)), spreadMin + 1e-9);
  const valley = valleyHalfWidth_(pass, spread, level, start, end, tol);

  const samples = Math.max(0, Math.floor(options.bootstrapSamples ?? 64));
  const span = Math.max(3 * valley.halfWidth, 4 * step);
  const bootstrapStdSec = samples >= 2
    ? bootstrapStd_(pass, settings, samples, options.seed ?? 1, Math.max(start, tBest - span), Math.min(end, tBest + span), tol)
    : Number.NaN;

  const tCheck = scanAndRefine_((t) => spreadAt_(cloud, checkSettings, t, null), start, end, curve.posix.length, tol);
  const metricDisagreementSec = Math.abs(tCheck - tBest);
  const statistical = Math.max(Number.isFinite(bootstrapStdSec) ? bootstrapStdSec : valley.halfWidth, tol);
  let uncertaintySec = Math.hypot(statistical, metricDisagreementSec);

  const reasons = result.reasons;

  if (used.length < FEW_FRAGMENTS) {
    reasons.push('few-fragments');
  }
  if (tBest - start < 2 * step || end - tBest < 2 * step) {
    reasons.push('minimum-at-window-edge');
  }
  let maxSpread = 0;

  curve.spreadDeg.forEach((v) => {
    maxSpread = Math.max(maxSpread, v);
  });
  const flat = valley.open || maxSpread < FLAT_CONTRAST * spreadMin;

  if (flat) {
    reasons.push('flat-valley');
    uncertaintySec = Math.max(uncertaintySec, valley.halfWidth);
  }
  if (uncertaintySec > (options.maxGoodUncertaintySec ?? 3 * secondsPerDay)) {
    reasons.push('large-uncertainty');
  }
  if (median_(cloud.t0) - tBest > (options.oldElementsDays ?? 180) * secondsPerDay) {
    reasons.push('old-elements');
  }

  /*
   * A minimum pinned to the edge of a window that cannot be widened, or a valley that never closes
   * inside it, is an artefact of the window rather than an event time: no epoch.
   */
  const unresolved = windowFinal && (flat || reasons.includes('minimum-at-window-edge'));
  let quality: BreakupEpochQuality = reasons.length === 0 ? 'good' : 'weak';

  if (unresolved) {
    quality = 'none';
  }

  return {
    ...result,
    epoch: unresolved ? null : epochOf_(tBest),
    spreadAtMinDeg: spreadMin,
    uncertaintySec,
    bootstrapStdSec,
    metricDisagreementSec,
    valleyHalfWidthSec: valley.halfWidth,
    quality,
  };
};
