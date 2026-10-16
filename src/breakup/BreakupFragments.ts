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

import { Earth } from '../body/Earth';
import { ClassicalElements } from '../coordinate/ClassicalElements';
import { Tle } from '../coordinate/Tle';
import { EpochUTC } from '../time/EpochUTC';
import type { Seconds, TleLine1, TleLine2 } from '../types/types';
import { DEG2RAD, RAD2DEG, secondsPerDay, TAU } from '../utils/constants';
import { newtonNu } from '../utils/functions';
import { j2SecularRates } from './J2Secular';

/**
 * Mean elements of one fragment at its own epoch. Angles in radians (the same convention as
 * `ClassicalElementsParams`). Give either `semimajorAxis` or `meanMotion`.
 */
export interface BreakupFragmentElements {
  epoch: EpochUTC;
  /** Semimajor axis, km (paired with {@link Earth.mu}). */
  semimajorAxis?: number;
  /** Mean motion, revolutions per day. Used when `semimajorAxis` is absent (WGS-72 mu, like a TLE). */
  meanMotion?: number;
  eccentricity: number;
  /** Inclination, radians. */
  inclination: number;
  /** Right ascension of the ascending node, radians. */
  rightAscension: number;
  /** Argument of perigee, radians. */
  argPerigee: number;
  /** Mean anomaly, radians. Only `breakupLocationAtEpoch` uses it. */
  meanAnomaly?: number;
  /**
   * First time derivative of the mean motion, rev/day^2. This is TWICE the TLE line 1 field (which
   * stores ndot / 2). Optional; enables the drag filter and the `mean-motion-derivative` drag model.
   */
  meanMotionDot?: number;
}

/** A TLE as two lines. An ootk `Tle` instance satisfies this shape. */
export interface BreakupTleLines {
  line1: string;
  line2: string;
}

/** Anything the breakup estimators accept as one fragment (or parent) element set. */
export type BreakupFragmentInput = BreakupFragmentElements | BreakupTleLines | ClassicalElements;

/** One element set reduced to what the secular J2 model needs. */
export interface NormalizedFragment {
  /** Epoch, POSIX seconds (UTC). */
  epochPosix: number;
  /** Semimajor axis, km. */
  semimajorAxis: number;
  eccentricity: number;
  /** Radians. */
  inclination: number;
  /** Radians. */
  rightAscension: number;
  /** Radians. */
  argPerigee: number;
  /** Mean anomaly at epoch, radians (NaN when the input did not carry one). */
  meanAnomaly: number;
  /** Two-body mean motion, rad/s. */
  meanMotion: number;
  /** Secular J2 RAAN rate, rad/s. */
  raanDot: number;
  /** Secular J2 argument-of-perigee rate, rad/s. */
  argPerigeeDot: number;
  /** Secular mean-anomaly rate (n plus J2), rad/s. */
  meanAnomalyDot: number;
  /** ndot, rev/day^2 (NaN when unknown). */
  meanMotionDot: number;
  /** Mean motion, rev/day. */
  revsPerDay: number;
  /** The gravitational parameter the semimajor axis pairs with, km^3/s^2. */
  mu: number;
}

type NormalizedBase = Omit<NormalizedFragment, 'raanDot' | 'argPerigeeDot' | 'meanAnomalyDot' | 'meanMotion' | 'revsPerDay'>;

const isTleLines_ = (f: BreakupFragmentInput): f is BreakupTleLines =>
  typeof (f as BreakupTleLines).line1 === 'string' && typeof (f as BreakupTleLines).line2 === 'string';

/** TLE epoch straight from line 1 without building an SGP4 record. */
const tleEpochPosix_ = (line1: string): number => {
  const yy = parseInt(line1.substring(18, 20), 10);
  const year = yy >= 57 ? 1900 + yy : 2000 + yy;
  const day = parseFloat(line1.substring(20, 32));

  return Date.UTC(year, 0, 1) / 1000 + (day - 1) * secondsPerDay;
};

const withRates_ = (base: NormalizedBase): NormalizedFragment | null => {
  const rates = j2SecularRates(base.semimajorAxis, base.eccentricity, base.inclination, base.mu);

  if (!Number.isFinite(rates.raanDot) || !Number.isFinite(base.rightAscension) || !Number.isFinite(base.epochPosix)) {
    return null;
  }

  return {
    ...base,
    meanMotion: rates.meanMotion,
    raanDot: rates.raanDot,
    argPerigeeDot: rates.argPerigeeDot,
    meanAnomalyDot: rates.meanAnomalyDot,
    revsPerDay: (rates.meanMotion * secondsPerDay) / TAU,
  };
};

const fromTleLines_ = (f: BreakupTleLines): NormalizedFragment | null => {
  const line1 = f.line1 as TleLine1;
  const line2 = f.line2 as TleLine2;
  const revsPerDay = Tle.meanMotion(line2);

  return withRates_({
    epochPosix: f instanceof Tle ? f.epoch.posix : tleEpochPosix_(line1),
    semimajorAxis: Tle.semimajorAxisFromMeanMotion(revsPerDay),
    eccentricity: Tle.eccentricity(line2),
    inclination: Tle.inclination(line2) * DEG2RAD,
    rightAscension: Tle.rightAscension(line2) * DEG2RAD,
    argPerigee: Tle.argOfPerigee(line2) * DEG2RAD,
    meanAnomaly: Tle.meanAnomaly(line2) * DEG2RAD,
    meanMotionDot: 2 * Tle.meanMoDev1(line1),
    mu: Tle.WGS72_MU,
  });
};

const fromPlain_ = (f: BreakupFragmentElements): NormalizedFragment | null => {
  const hasSma = typeof f.semimajorAxis === 'number';
  let sma = f.semimajorAxis;

  if (!hasSma && typeof f.meanMotion === 'number') {
    sma = Tle.semimajorAxisFromMeanMotion(f.meanMotion);
  }
  if (typeof sma !== 'number') {
    return null;
  }

  return withRates_({
    epochPosix: f.epoch.posix,
    semimajorAxis: sma,
    eccentricity: f.eccentricity,
    inclination: f.inclination,
    rightAscension: f.rightAscension,
    argPerigee: f.argPerigee,
    meanAnomaly: typeof f.meanAnomaly === 'number' ? f.meanAnomaly : Number.NaN,
    meanMotionDot: typeof f.meanMotionDot === 'number' ? f.meanMotionDot : Number.NaN,
    mu: hasSma ? Earth.mu : Tle.WGS72_MU,
  });
};

/**
 * Reduces any accepted input to a {@link NormalizedFragment}.
 * @param f The element set: TLE lines (or a `Tle`), `ClassicalElements`, or plain mean elements.
 * @returns The normalized fragment, or null when the input is unusable (unparseable TLE,
 *   non-elliptic orbit, non-finite angles).
 */
export const normalizeFragment = (f: BreakupFragmentInput): NormalizedFragment | null => {
  try {
    if (isTleLines_(f)) {
      return fromTleLines_(f);
    }
    if (f instanceof ClassicalElements) {
      return withRates_({
        epochPosix: f.epoch.posix,
        semimajorAxis: f.semimajorAxis,
        eccentricity: f.eccentricity,
        inclination: f.inclination,
        rightAscension: f.rightAscension,
        argPerigee: f.argPerigee,
        meanAnomaly: newtonNu(f.eccentricity, f.trueAnomaly).m,
        meanMotionDot: Number.NaN,
        mu: f.mu,
      });
    }

    return fromPlain_(f);
  } catch {
    return null;
  }
};

/**
 * Circular mean and circular standard deviation sqrt(-2 ln R) of a set of angles.
 * @param angles Angles in radians.
 * @returns [mean, std], both radians. The std is Infinity when the mean resultant length is 0.
 */
export const circularMeanStd = (angles: ArrayLike<number>): [number, number] => {
  let c = 0;
  let s = 0;

  for (let k = 0; k < angles.length; k++) {
    c += Math.cos(angles[k]);
    s += Math.sin(angles[k]);
  }
  const r = Math.min(1, Math.hypot(c, s) / angles.length);

  return [Math.atan2(s, c), r > 0 ? Math.sqrt(-2 * Math.log(r)) : Number.POSITIVE_INFINITY];
};

/** Summary of how a fragment cloud is spread out at one common epoch. */
export interface FragmentDispersionStats {
  /** Fragments that parsed and were included. */
  count: number;
  /** The common epoch every fragment's RAAN was carried to (secular J2). */
  epoch: EpochUTC;
  /** Circular mean of RAAN at `epoch`, degrees in [0, 360). */
  raanMeanDeg: number;
  /** Circular standard deviation of RAAN at `epoch`, degrees. */
  raanSpreadDeg: number;
  inclinationMeanDeg: number;
  inclinationStdDeg: number;
  semimajorAxisMeanKm: number;
  semimajorAxisStdKm: number;
  eccentricityMean: number;
  eccentricityStd: number;
  /** Lowest perigee altitude above the equatorial radius, km. */
  perigeeMinKm: number;
  /** Highest apogee altitude above the equatorial radius, km. */
  apogeeMaxKm: number;
  /** Mean secular J2 RAAN rate, deg/day. */
  raanDotMeanDegPerDay: number;
  /** Standard deviation of the secular RAAN rates, deg/day: how fast the planes fan out. */
  raanDotStdDegPerDay: number;
}

const meanStd_ = (xs: number[]): [number, number] => {
  const n = xs.length;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;

  return [mean, Math.sqrt(variance)];
};

/**
 * Dispersion of a fragment cloud at one common epoch. RAAN is carried to that epoch with the
 * secular J2 rate; the other elements are reported as given (they have no secular J2 drift).
 * @param fragments The fragment element sets.
 * @param epoch Common epoch. Defaults to the latest fragment epoch.
 * @returns The statistics, or null when no fragment is usable.
 */
export const fragmentDispersionStats = (fragments: readonly BreakupFragmentInput[], epoch?: EpochUTC): FragmentDispersionStats | null => {
  const norm = fragments.map(normalizeFragment).filter((f): f is NormalizedFragment => f !== null);

  if (norm.length === 0) {
    return null;
  }
  const tPosix = epoch ? epoch.posix : Math.max(...norm.map((f) => f.epochPosix));
  const [raanMean, raanStd] = circularMeanStd(norm.map((f) => f.rightAscension + f.raanDot * (tPosix - f.epochPosix)));
  const [incMean, incStd] = meanStd_(norm.map((f) => f.inclination * RAD2DEG));
  const [aMean, aStd] = meanStd_(norm.map((f) => f.semimajorAxis));
  const [eMean, eStd] = meanStd_(norm.map((f) => f.eccentricity));
  const [rdMean, rdStd] = meanStd_(norm.map((f) => f.raanDot * secondsPerDay * RAD2DEG));
  const re = Earth.radiusEquator;

  return {
    count: norm.length,
    epoch: epoch ?? new EpochUTC(tPosix as Seconds),
    raanMeanDeg: (((raanMean * RAD2DEG) % 360) + 360) % 360,
    raanSpreadDeg: raanStd * RAD2DEG,
    inclinationMeanDeg: incMean,
    inclinationStdDeg: incStd,
    semimajorAxisMeanKm: aMean,
    semimajorAxisStdKm: aStd,
    eccentricityMean: eMean,
    eccentricityStd: eStd,
    perigeeMinKm: Math.min(...norm.map((f) => f.semimajorAxis * (1 - f.eccentricity) - re)),
    apogeeMaxKm: Math.max(...norm.map((f) => f.semimajorAxis * (1 + f.eccentricity) - re)),
    raanDotMeanDegPerDay: rdMean,
    raanDotStdDegPerDay: rdStd,
  };
};
