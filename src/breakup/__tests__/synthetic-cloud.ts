import { J2000 } from '../../coordinate/J2000';
import { ClassicalElements } from '../../coordinate/ClassicalElements';
import { Vector3D } from '../../operations/Vector3D';
import { EpochUTC } from '../../time/EpochUTC';
import type { Kilometers, KilometersPerSecond, Radians, Seconds } from '../../types/types';
import { DEG2RAD, secondsPerDay, TAU } from '../../utils/constants';
import { newtonNu } from '../../utils/functions';
import type { BreakupFragmentElements } from '../BreakupFragments';
import { j2SecularRates } from '../J2Secular';

/** Deterministic PRNG (mulberry32) plus a Box-Muller normal. */
export const makeRng = (seed: number): { uniform: () => number; normal: () => number } => {
  let a = seed >>> 0;
  const uniform = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (): number => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(TAU * uniform());

  return { uniform, normal };
};

export interface SyntheticCloudOptions {
  count?: number;
  /** Breakup epoch. */
  t0?: EpochUTC;
  /** Days between the breakup and the fragment element epochs. */
  ageDays?: number;
  /** Spread of the fragment epochs around `ageDays`, days (uniform, +/- half). */
  epochJitterDays?: number;
  /** 1-sigma delta-v per axis, km/s. */
  sigmaDvKmS?: number;
  /** Parent argument of latitude at the breakup, degrees. */
  argLatDeg?: number;
  seed?: number;
}

export const SYNTH_T0 = EpochUTC.fromDateTimeString('2021-11-15T02:47:00.000Z');

/** Parent at the breakup: 480 km, e = 0.002, i = 82.56 deg (a Cosmos 1408-like orbit). */
export const syntheticParent = (t0: EpochUTC, argLatDeg: number): ClassicalElements => {
  const argPerigee = 40 * DEG2RAD;

  return new ClassicalElements({
    epoch: t0,
    semimajorAxis: 6858 as Kilometers,
    eccentricity: 0.002,
    inclination: (82.56 * DEG2RAD) as Radians,
    rightAscension: (130 * DEG2RAD) as Radians,
    argPerigee: argPerigee as Radians,
    trueAnomaly: ((((argLatDeg * DEG2RAD - argPerigee) % TAU) + TAU) % TAU) as Radians,
  });
};

/**
 * Builds a fragment cloud: one parent state at t0, isotropic Gaussian delta-v per fragment, and
 * each fragment's mean elements carried forward with the same secular J2 model the estimator
 * uses.
 */
export const syntheticCloud = (opts: SyntheticCloudOptions = {}): { parent: ClassicalElements; fragments: BreakupFragmentElements[] } => {
  const count = opts.count ?? 40;
  const t0 = opts.t0 ?? SYNTH_T0;
  const ageDays = opts.ageDays ?? 400;
  const jitter = opts.epochJitterDays ?? 2;
  const sigma = opts.sigmaDvKmS ?? 0.05;
  const rng = makeRng(opts.seed ?? 7);
  const parent = syntheticParent(t0, opts.argLatDeg ?? 30);
  const state = parent.toJ2000();
  const fragments: BreakupFragmentElements[] = [];

  for (let k = 0; k < count; k++) {
    const dv = new Vector3D(rng.normal() * sigma, rng.normal() * sigma, rng.normal() * sigma) as Vector3D<KilometersPerSecond>;
    const el = new J2000(t0, state.position, state.velocity.add(dv) as Vector3D<KilometersPerSecond>).toClassicalElements();
    const rates = j2SecularRates(el.semimajorAxis, el.eccentricity, el.inclination);
    const dt = (ageDays + (rng.uniform() - 0.5) * jitter) * secondsPerDay;
    const m0 = newtonNu(el.eccentricity, el.trueAnomaly).m;
    const wrap = (x: number): number => ((x % TAU) + TAU) % TAU;

    fragments.push({
      epoch: t0.roll(dt as Seconds),
      semimajorAxis: el.semimajorAxis,
      eccentricity: el.eccentricity,
      inclination: el.inclination,
      rightAscension: wrap(el.rightAscension + rates.raanDot * dt),
      argPerigee: wrap(el.argPerigee + rates.argPerigeeDot * dt),
      meanAnomaly: wrap(m0 + rates.meanAnomalyDot * dt),
    });
  }

  return { parent, fragments };
};
