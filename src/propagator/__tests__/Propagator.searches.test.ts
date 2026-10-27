/**
 * QA 2026-10 regression tests for Propagator node/apsis searches and ephemeris sampling
 * (report section 1 item 2 and section 2.3, Propagator.ts).
 *
 * The node and apsis epochs are checked against closed-form two-body timing on a
 * KeplerPropagator, which is independent of the SGP4 values used in the qa proof tests:
 * the time from mean anomaly M0 to M is (M - M0) / n with n = sqrt(mu / a^3)
 * (Vallado, Fundamentals of Astrodynamics and Applications, 4th ed., section 2.2).
 */
import { ClassicalElements, EpochUTC, Kilometers, Radians, Seconds } from '../../main';
import { KeplerPropagator } from '../KeplerPropagator';

const TAU = 2 * Math.PI;
const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));

/** Eccentric anomaly to mean anomaly via Kepler's equation; true to eccentric via the half-angle form. */
const meanFromTrue = (nu: number, e: number): number => {
  const ecc = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));

  return ecc - e * Math.sin(ecc);
};

const wrap = (x: number): number => ((x % TAU) + TAU) % TAU;

describe('Propagator node and apsis searches (QA 2026-10, period in minutes)', () => {
  const a = 7200 as Kilometers;
  const e = 0.1;
  const argPerigee = 0.5;
  const trueAnomaly0 = 0.3;
  const elements = new ClassicalElements({
    epoch,
    semimajorAxis: a,
    eccentricity: e,
    inclination: 0.9 as Radians,
    rightAscension: 0.4 as Radians,
    argPerigee: argPerigee as Radians,
    trueAnomaly: trueAnomaly0 as Radians,
  });
  const n = elements.meanMotion; // rad/s
  const m0 = meanFromTrue(trueAnomaly0, e);
  /** Seconds from epoch until the mean anomaly reaches m (first time after epoch). */
  const timeToMean = (m: number): number => wrap(m - m0) / n;

  it('ascendingNodeEpoch matches the two-body time to argument of latitude 0', () => {
    // Ascending node: u = argPerigee + nu = 2pi, so nu = 2pi - argPerigee.
    const expected = timeToMean(meanFromTrue(TAU - argPerigee, e));
    const node = new KeplerPropagator(elements).ascendingNodeEpoch(epoch);

    expect(node.posix - epoch.posix).toBeCloseTo(expected, 1);
  });

  it('descendingNodeEpoch matches the two-body time to argument of latitude pi', () => {
    const expected = timeToMean(meanFromTrue(Math.PI - argPerigee, e));
    const node = new KeplerPropagator(elements).descendingNodeEpoch(epoch);

    expect(node.posix - epoch.posix).toBeCloseTo(expected, 1);
  });

  it('perigeeEpoch is at mean anomaly 0 and apogeeEpoch at mean anomaly pi', () => {
    const peri = new KeplerPropagator(elements).perigeeEpoch(epoch);
    const apo = new KeplerPropagator(elements).apogeeEpoch(epoch);

    // Radius is flat at an apsis (dr/dt = 0), so the golden-section time is good to about 1 s.
    expect(Math.abs(peri.posix - epoch.posix - timeToMean(0))).toBeLessThan(1);
    expect(Math.abs(apo.posix - epoch.posix - timeToMean(Math.PI))).toBeLessThan(1);
  });

  it('ascending and descending nodes of a circular orbit are half a period apart', () => {
    // Circular orbit: the node times are (2pi - u0) / n and (pi - u0) / n exactly.
    const u0 = 1.0;
    const circular = new ClassicalElements({
      epoch,
      semimajorAxis: 6778.137 as Kilometers,
      eccentricity: 0,
      inclination: 0.9 as Radians,
      rightAscension: 0.1 as Radians,
      argPerigee: 0 as Radians,
      trueAnomaly: u0 as Radians,
    });
    const nc = circular.meanMotion;
    const asc = new KeplerPropagator(circular).ascendingNodeEpoch(epoch);
    const desc = new KeplerPropagator(circular).descendingNodeEpoch(epoch);

    expect(asc.posix - epoch.posix).toBeCloseTo((TAU - u0) / nc, 1);
    expect(desc.posix - epoch.posix).toBeCloseTo((Math.PI - u0) / nc, 1);
  });

  /*
   * Verifier fix M.11: an equatorial orbit (z = 0 throughout) has no node. The scan found no sign
   * change and the golden-section search still returned an arbitrary epoch; now it throws.
   */
  it('throws a clear error for an equatorial orbit, which has no node', () => {
    const equatorial = new ClassicalElements({
      epoch,
      semimajorAxis: 7000 as Kilometers,
      eccentricity: 0.001,
      inclination: 0 as Radians,
      rightAscension: 0 as Radians,
      argPerigee: 0.3 as Radians,
      trueAnomaly: 1 as Radians,
    });

    expect(() => new KeplerPropagator(equatorial).ascendingNodeEpoch(epoch)).toThrow(/No ascending node/u);
    expect(() => new KeplerPropagator(equatorial).descendingNodeEpoch(epoch)).toThrow(/No descending node/u);
  });
});

describe('Propagator.ephemeris sampling (QA 2026-10, no sample past stop)', () => {
  const elements = new ClassicalElements({
    epoch,
    semimajorAxis: 7000 as Kilometers,
    eccentricity: 0.001,
    inclination: 0.9 as Radians,
    rightAscension: 0.1 as Radians,
    argPerigee: 0.2 as Radians,
    trueAnomaly: 0.3 as Radians,
  });

  it('ends exactly at stop when the span is not a multiple of the interval', () => {
    const stop = epoch.roll(650 as Seconds);
    const interp = new KeplerPropagator(elements).ephemeris(epoch, stop, 60 as Seconds);
    const times = interp.ephemeris.map((s) => s.epoch.posix - epoch.posix);

    // 0, 60, ..., 600 and then the shortened final step to 650.
    expect(times).toEqual([0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 650]);
    expect(interp.window().end.posix).toBe(stop.posix);
  });

  it('returns a single sample when start equals stop', () => {
    const interp = new KeplerPropagator(elements).ephemeris(epoch, epoch, 60 as Seconds);

    expect(interp.ephemeris.length).toBe(1);
  });
});
