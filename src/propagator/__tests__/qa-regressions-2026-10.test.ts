/**
 * QA 2026-10-13 regression tests: propagator node/apsis search, ephemeris and RungeKuttaAdaptive.
 *
 * Source: hq/reports/ootk-qa-deep-dive-2026-10-13.md, section 1 item 2 and section 2.3.
 * Permanent regression tests for the v8 fixes. Moved from test/qa/sgp4-propagator-force.qa.test.ts.
 */
import {
  DormandPrince54Propagator,
  EpochUTC,
  ForceModel,
  J2000,
  KeplerPropagator,
  Kilometers,
  KilometersPerSecond,
  MetersPerSecond,
  Seconds,
  Sgp4Propagator,
  Thrust,
  Tle,
  Vector3D,
} from '@src/main';
import type { TleLine1, TleLine2 } from '@src/types/types';

const ISS_LINE1 = '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002' as TleLine1;
const ISS_LINE2 = '2 25544  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550100010' as TleLine2;

/** Brute-force scan over one orbit; returns the sample that minimizes/maximizes f. */
const scan = (
  propagator: { propagate: (e: EpochUTC) => J2000 },
  start: EpochUTC,
  spanSec: number,
  stepSec: number,
  f: (s: J2000) => number,
): { t: number; value: number }[] => {
  const out: { t: number; value: number }[] = [];

  for (let dt = 0; dt <= spanSec; dt += stepSec) {
    out.push({ t: start.posix + dt, value: f(propagator.propagate(start.roll(dt as Seconds))) });
  }

  return out;
};

describe('Propagator node and apsis search (QA 2026-10 regressions)', () => {
  /*
   * Report section 1 item 2, Propagator.ts:119,151,184,222. `this.state.period` is in MINUTES (about 92.6 for ISS)
   * but is divided by 60 and used as SECONDS, so the search window is about 1.5 s instead of 92.6 min.
   * Expected: ISS ascending node about 60 min after the TLE epoch. Actual: an epoch about 1.5 s after start.
   */
  it('ascendingNodeEpoch finds a node tens of minutes after start with z near 0 and heading north', () => {
    const tle = new Tle(ISS_LINE1, ISS_LINE2);
    const prop = new Sgp4Propagator(tle);
    const start = tle.epoch;
    const node = prop.ascendingNodeEpoch(start);
    const minutesAfter = (node.posix - start.posix) / 60;

    expect(minutesAfter).toBeGreaterThan(20);
    expect(minutesAfter).toBeLessThan(80);
    const s = prop.propagate(node);

    expect(Math.abs(s.position.z)).toBeLessThan(5);
    expect(s.velocity.z).toBeGreaterThan(0);
  });

  /*
   * Report section 1 item 2, Propagator.ts:151. Same minutes-as-seconds bug for descendingNodeEpoch.
   * Expected: |z| < 5 km and vz < 0 at the returned epoch. Actual: |z| of thousands of km near start.
   */
  it('descendingNodeEpoch returns an epoch where the ISS crosses the equator heading south', () => {
    const tle = new Tle(ISS_LINE1, ISS_LINE2);
    const prop = new Sgp4Propagator(tle);
    const start = tle.epoch;
    const node = prop.descendingNodeEpoch(start);
    const s = prop.propagate(node);

    expect(Math.abs(s.position.z)).toBeLessThan(5);
    expect(s.velocity.z).toBeLessThan(0);
    expect(node.posix - start.posix).toBeGreaterThan(60);
  });

  /*
   * Report section 1 item 2, Propagator.ts:184. apogeeEpoch scans 8 slices of about 0.19 s each.
   * Expected: radius at the returned epoch within 0.5 km of the max radius over one orbit (1 s scan).
   * Actual: a radius near start, several km below the true maximum.
   */
  it('apogeeEpoch returns the epoch of max radius over one full ISS orbit', () => {
    const tle = new Tle(ISS_LINE1, ISS_LINE2);
    const prop = new Sgp4Propagator(tle);
    const start = tle.epoch;
    const periodSec = prop.state.period * 60;
    const rMax = Math.max(...scan(prop, start, periodSec, 5, (s) => s.position.magnitude()).map((x) => x.value));
    const apo = prop.apogeeEpoch(start);
    const rApo = prop.propagate(apo).position.magnitude();

    expect(rMax - rApo).toBeLessThan(0.5);
    expect(apo.posix - start.posix).toBeGreaterThan(60);
  });

  /*
   * Report section 1 item 2, Propagator.ts:222. perigeeEpoch has the same 60x short window.
   * Expected: radius at the returned epoch within 0.5 km of the min radius over one orbit.
   */
  it('perigeeEpoch returns the epoch of min radius over one full ISS orbit', () => {
    const tle = new Tle(ISS_LINE1, ISS_LINE2);
    const prop = new Sgp4Propagator(tle);
    const start = tle.epoch;
    const periodSec = prop.state.period * 60;
    const rMin = Math.min(...scan(prop, start, periodSec, 5, (s) => s.position.magnitude()).map((x) => x.value));
    const peri = prop.perigeeEpoch(start);
    const rPeri = prop.propagate(peri).position.magnitude();

    expect(rPeri - rMin).toBeLessThan(0.5);
    expect(peri.posix - start.posix).toBeGreaterThan(60);
  });

  /*
   * Report 2.3, Propagator.ts:40-43. `ephemeris` loop is `while (t <= stop) { t += interval; push }`,
   * so the last sample is always one interval past stop.
   * Expected: window end == stop (start + 600 s). Actual: start + 660 s.
   */
  it('ephemeris ends exactly at stop', () => {
    const tle = new Tle(ISS_LINE1, ISS_LINE2);
    const prop = new KeplerPropagator(tle.state.toJ2000().toClassicalElements());
    const start = tle.epoch;
    const stop = start.roll(600 as Seconds);
    const interp = prop.ephemeris(start, stop, 60 as Seconds);

    expect(interp.window().end.posix).toBe(stop.posix);
    expect(interp.ephemeris.length).toBe(11);
  });
});

describe('RungeKuttaAdaptive (QA 2026-10 regressions)', () => {
  const epoch = EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z');
  const leo = (): J2000 => new J2000(
    epoch,
    new Vector3D<Kilometers>(6778 as Kilometers, 0 as Kilometers, 0 as Kilometers),
    new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 7.6686 as KilometersPerSecond, 0 as KilometersPerSecond),
  );

  /*
   * Report 2.3, RungeKuttaAdaptive.ts:246-249. Filter is `start >= start || stop <= finish`, which keeps
   * a maneuver that ends an hour BEFORE the window. Expected: it is excluded, window starts at `start`
   * and the state at finish matches an unmaneuvered run. Actual: window starts at start - 3600 s and the
   * 10 m/s burn is applied.
   */
  it('ephemerisManeuver excludes maneuvers that end entirely before the window', () => {
    const start = epoch;
    const finish = epoch.roll(1200 as Seconds);
    const before = new Thrust(
      epoch.roll(-3600 as Seconds),
      0 as MetersPerSecond,
      10 as MetersPerSecond,
      0 as MetersPerSecond,
    );
    const withMvr = new DormandPrince54Propagator(leo());
    const interp = withMvr.ephemerisManeuver(start, finish, [before], 60 as Seconds);
    const clean = new DormandPrince54Propagator(leo()).propagate(finish);
    const got = interp.interpolate(finish);

    expect(interp.window().start.posix).toBe(start.posix);
    expect(got).not.toBeNull();
    expect(got!.position.subtract(clean.position).magnitude()).toBeLessThan(1e-3);
  });

  /*
   * Report 2.3, RungeKuttaAdaptive.ts:251. `tMvr[0].start` is read unconditionally.
   * Expected: an empty maneuver list produces plain ephemeris. Actual: TypeError on undefined.start.
   */
  it('ephemerisManeuver with an empty maneuver list does not throw', () => {
    const prop = new DormandPrince54Propagator(leo());

    expect(() => prop.ephemerisManeuver(epoch, epoch.roll(600 as Seconds), [], 60 as Seconds)).not.toThrow();
  });

  /*
   * Report 2.3, RungeKuttaAdaptive.ts:188-193. After 1000 consecutive rejected steps `propagate()` returns
   * the cached state at the OLD epoch without any error. A force that flips sign on every call makes every
   * step fail the tolerance. Expected: throw, or return a state at the requested epoch.
   * Actual: silently returns a state whose epoch is not the requested one.
   */
  it('propagate throws or reaches the requested epoch after repeated step rejection', () => {
    class ChatteringForceModel extends ForceModel {
      private sign_ = 1;

      acceleration(state: J2000): Vector3D {
        this.sign_ = -this.sign_;

        return super.acceleration(state).add(new Vector3D(1e3 * this.sign_, 1e3 * this.sign_, 1e3 * this.sign_));
      }
    }
    const prop = new DormandPrince54Propagator(leo(), new ChatteringForceModel().setGravity());
    const target = epoch.roll(60 as Seconds);
    let threw = false;
    let result: J2000 | null = null;

    try {
      result = prop.propagate(target);
    } catch {
      threw = true;
    }

    const ok = threw || result?.epoch.posix === target.posix;

    expect(ok, `returned epoch ${result?.epoch.posix} for target ${target.posix} without error`).toBe(true);
  });
});
