/**
 * Permanent regression tests for the v8 fixes from the QA deep dive (2026-10-13), slice 2.5.
 * Report: hq/reports/ootk-qa-deep-dive-2026-10-13.md
 * Moved from test/qa/od-maneuver-orbit-design.qa.test.ts.
 *
 * Each test asserts the corrected behavior. Do not loosen tolerances to make them pass.
 */

import {
  BatchLeastSquaresOD,
  ClassicalElements,
  DEG2RAD,
  Degrees,
  Earth,
  EpochUTC,
  GibbsIOD,
  J2000,
  Kilometers,
  LevenbergMarquardtOD,
  RAE,
  RadecTopocentric,
  Radians,
  Seconds,
  Vector3D,
} from '@src/main';
import { GroundStation } from '@src/objects/GroundStation';
import { ObservationOptical } from '@src/observation/ObservationOptical';
import { ObservationRadar } from '@src/observation/ObservationRadar';
import { GaussIOD } from '@src/orbit-determination/GaussIOD';
import { LambertIOD } from '@src/orbit-determination/LambertIOD';
import { KeplerPropagator } from '@src/propagator/KeplerPropagator';

const RAD2DEG_ = 180 / Math.PI;

/** Deterministic PRNG (mulberry32) so noisy-data tests are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box-Muller. */
function gaussian(rand: () => number): number {
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();

  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function leoElements(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: (Earth.radiusMean + 400) as Kilometers,
    eccentricity: 0.0,
    inclination: (51.6 * DEG2RAD) as Radians,
    argPerigee: 0 as Radians,
    rightAscension: (45 * DEG2RAD) as Radians,
    trueAnomaly: 0 as Radians,
  });
}

function createSensor(): GroundStation {
  return new GroundStation({ lat: 41.75 as Degrees, lon: -70.54 as Degrees, alt: 0.1 as Kilometers });
}

function radarObservations(
  propagator: KeplerPropagator,
  sensor: GroundStation,
  start: EpochUTC,
  count: number,
  stepSec: number,
  noise?: { rand: () => number; rngSigma: number; angSigmaRad: number },
): ObservationRadar[] {
  const out: ObservationRadar[] = [];

  for (let i = 0; i < count; i++) {
    const epoch = start.roll((i * stepSec) as Seconds);
    const site = sensor.toJ2000(epoch.toDateTime());
    const rae = RAE.fromStateVector(propagator.propagate(epoch), site);
    const measured = noise
      ? new RAE(
        epoch,
        (rae.rng + noise.rngSigma * gaussian(noise.rand)) as Kilometers,
        (rae.azRad + noise.angSigmaRad * gaussian(noise.rand)) as Radians,
        (rae.elRad + noise.angSigmaRad * gaussian(noise.rand)) as Radians,
      )
      : rae;

    out.push(new ObservationRadar(site, measured));
  }

  return out;
}

describe('GibbsIOD (QA 2026-10 regressions)', () => {
  /*
   * Report 2.5, src/orbit-determination/GibbsIOD.ts:57-58.
   * The coplanarity test used r1hat . (r2hat x r3hat) without normalising the cross
   * product, whose magnitude is sin(theta23). With theta23 = 10 deg and r1 20 deg out of
   * the r2/r3 plane the computed angle was asin(sin 20 * sin 10) = 3.4 deg, which passed
   * the 5 deg gate. Expected: reject (throw "not coplanar").
   */
  it('GibbsIOD.solve rejects a position triplet 20 deg out of plane', () => {
    const mag = 7000;
    const t23 = 10 * DEG2RAD;
    const alpha = 20 * DEG2RAD;
    const r2 = new Vector3D(mag as Kilometers, 0 as Kilometers, 0 as Kilometers);
    const r3 = new Vector3D((mag * Math.cos(t23)) as Kilometers, (mag * Math.sin(t23)) as Kilometers, 0 as Kilometers);
    const r1 = new Vector3D(
      (mag * Math.cos(alpha) * Math.cos(-t23)) as Kilometers,
      (mag * Math.cos(alpha) * Math.sin(-t23)) as Kilometers,
      (mag * Math.sin(alpha)) as Kilometers,
    );

    // The true out-of-plane angle of r1 from the r2/r3 plane is 20 deg.
    const nHat = r2.cross(r3).normalize();
    const trueAngleDeg = Math.asin(r1.normalize().dot(nHat)) * RAD2DEG_;

    expect(trueAngleDeg).toBeCloseTo(20, 6);

    const t2 = EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z');
    const t3 = t2.roll(120 as Seconds);

    expect(() => new GibbsIOD().solve(r1, r2, r3, t2, t3)).toThrow(/coplanar/u);
  });
});

describe('GaussIOD (QA 2026-10 regressions)', () => {
  /*
   * Report 2.5, src/orbit-determination/GaussIOD.ts:106-111, 138.
   * When the Halley root was negative, beyond 50,000 km, or unconverged, findRootHalley
   * silently substituted r2 = 35,000 km and estimate() built a state from it. JSDoc says
   * "returns null if a valid solution cannot be found". Object here is at 80,000 km (the
   * Halley root is confirmed to hit the 35,000 km fallback for this geometry). Expected:
   * null or a state near 80,000 km. Old result: a made-up state with |r2| of about 577,000 km.
   */
  it('GaussIOD.estimate returns null rather than a state built from the 35,000 km fallback root', () => {
    const epoch = EpochUTC.fromDateTimeString('2023-06-09T17:00:00.000Z');
    const truthSma = 80000;
    const propagator = new KeplerPropagator(
      new ClassicalElements({
        epoch,
        semimajorAxis: truthSma as Kilometers,
        eccentricity: 0.001,
        inclination: (10 * DEG2RAD) as Radians,
        argPerigee: (180 * DEG2RAD) as Radians,
        rightAscension: (90 * DEG2RAD) as Radians,
        trueAnomaly: 0 as Radians,
      }),
    );
    const sensor = new GroundStation({ lat: 43.05722 as Degrees, lon: 76.971667 as Degrees, alt: 2.735 as Kilometers });
    const times = [epoch.roll(300 as Seconds), epoch.roll(900 as Seconds), epoch.roll(1500 as Seconds)];
    const obs = times.map((t) => {
      const site = sensor.toJ2000(t.toDateTime());

      return new ObservationOptical(site, RadecTopocentric.fromStateVector(propagator.propagate(t), site));
    });

    const result = new GaussIOD().estimate(obs[0], obs[1], obs[2]);
    const r2Mag = result ? result.position.magnitude() : null;

    // Either no solution (null) or a state near the 80,000 km truth. Before the fix the root
    // was clamped to 35,000 km and the slant ranges built from it gave |r2| of about 577,000 km.
    expect({ r2Mag, ok: r2Mag === null || Math.abs(r2Mag - truthSma) / truthSma < 0.1 }).toMatchObject({ ok: true });
  });
});

describe('LevenbergMarquardtOD (QA 2026-10 regressions)', () => {
  /*
   * Report 2.5, src/orbit-determination/LevenbergMarquardtOD.ts:230-247.
   * `converged = currentRms < epsilon` (1e-6) compared the noise-weighted RMS, which is
   * about 1 for a correct fit to sigma-consistent noise, so real data never converged.
   * Expected converged = true for a fit that has reached the noise floor; old result false.
   */
  it('LevenbergMarquardtOD.solve reports converged on sigma-consistent noisy radar data', () => {
    const start = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(leoElements(start));
    // Sigmas match ObservationRadar.defaultNoise (0.32 km, 0.015 deg).
    const observations = radarObservations(propagator, createSensor(), start, 20, 15, {
      rand: mulberry32(20261013),
      rngSigma: 0.32,
      angSigmaRad: 0.015 * DEG2RAD,
    });
    const truth = propagator.propagate(start);

    const result = new LevenbergMarquardtOD(observations, truth).solve();

    // Sanity: the fit is at the noise floor (weighted RMS near 1), i.e. a good solution.
    expect(result.rms).toBeLessThan(2);
    expect(result.converged).toBe(true);
  });

  /*
   * Report 2.5, src/orbit-determination/LevenbergMarquardtOD.ts:65.
   * The constructor sorted the caller's observation array in place.
   * Expected: caller's array order unchanged; old result: reordered by epoch.
   */
  it('LevenbergMarquardtOD constructor does not reorder the caller observation array', () => {
    const start = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(leoElements(start));
    const sorted = radarObservations(propagator, createSensor(), start, 3, 30);
    const input = [sorted[2], sorted[0], sorted[1]];
    const before = input.map((o) => o.epoch.posix);

    new LevenbergMarquardtOD(input, propagator.propagate(start));

    expect(input.map((o) => o.epoch.posix)).toEqual(before);
  });
});

describe('BatchLeastSquaresOD (QA 2026-10 regressions)', () => {
  /*
   * Report 2.5, src/orbit-determination/BatchLeastSquaresOD.ts:51.
   * The constructor sorted the caller's observation array in place.
   * Expected: caller's array order unchanged; old result: reordered by epoch.
   */
  it('BatchLeastSquaresOD constructor does not reorder the caller observation array', () => {
    const start = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(leoElements(start));
    const sorted = radarObservations(propagator, createSensor(), start, 3, 30);
    const input = [sorted[2], sorted[0], sorted[1]];
    const before = input.map((o) => o.epoch.posix);

    new BatchLeastSquaresOD(input, propagator.propagate(start));

    expect(input.map((o) => o.epoch.posix)).toEqual(before);
  });

  /*
   * Report 2.5, src/orbit-determination/BatchLeastSquaresOD.ts:132-174.
   * When maxIter was exhausted the solver returned the last iterate silently; the result
   * had no converged flag so callers could not tell. Expected: a boolean `converged` that is
   * false here (maxIter = 1 cannot meet a 1e-12 tolerance from a 5 km-off apriori);
   * old result: the property did not exist.
   */
  it('BatchLeastSquaresOD.solve exposes converged = false when maxIter is exhausted', () => {
    const start = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(leoElements(start));
    const observations = radarObservations(propagator, createSensor(), start, 10, 30);
    const truth = propagator.propagate(start);
    const apriori = new J2000(
      truth.epoch,
      truth.position.add(new Vector3D(5 as Kilometers, 0 as Kilometers, 0 as Kilometers)),
      truth.velocity,
    );

    const result = new BatchLeastSquaresOD(observations, apriori).solve({ maxIter: 1, tolerance: 1e-12 });

    expect((result as unknown as { converged?: unknown }).converged).toBe(false);
  });
});

describe('LambertIOD and GoodingIOD direction (QA 2026-10 regressions)', () => {
  /*
   * Report 2.5, GoodingIOD.ts:152,194 and LambertIOD.ts:221. `posigrade`/`direction` were
   * documented as prograde vs retrograde but selected short-way vs long-way. The runtime
   * behavior (short/long way) is self-consistent. Decision 2026-10-13 (Ted): rename the
   * option to `shortWay`, no alias. The old key must therefore be ignored (it has no
   * effect), and `shortWay: false` must select the long-way transfer that
   * `posigrade: false` used to select.
   */
  const t1 = EpochUTC.fromDateTime(new Date('2026-10-13T00:00:00Z'));
  const t2 = EpochUTC.fromDateTime(new Date('2026-10-13T00:30:00Z'));
  const p1 = new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
  const p2 = new Vector3D(0 as Kilometers, 7000 as Kilometers, 500 as Kilometers);

  type LambertOpts = { shortWay?: boolean; posigrade?: boolean };
  const solve = (opts: LambertOpts) =>
    new LambertIOD().estimate(p1, p2, t1, t2, opts as { nRev?: number });

  it('LambertIOD.estimate takes shortWay and ignores the removed posigrade key', () => {
    const shortDefault = solve({});
    const longWay = solve({ shortWay: false });
    const oldKey = solve({ posigrade: false });

    expect(shortDefault).not.toBeNull();
    expect(longWay).not.toBeNull();
    expect(oldKey).not.toBeNull();

    const vShort = shortDefault!.velocity;
    const vLong = longWay!.velocity;
    const vOld = oldKey!.velocity;

    // The long-way transfer departs with a different velocity than the short way.
    expect(vLong.subtract(vShort).magnitude()).toBeGreaterThan(0.1);
    // The removed key must not change the result.
    expect(vOld.subtract(vShort).magnitude()).toBeLessThan(1e-9);
  });
});
