import { ClassicalElements } from '../../coordinate/ClassicalElements';
import { Tle } from '../../coordinate/Tle';
import { EpochUTC } from '../../time/EpochUTC';
import { eci2lla } from '../../transforms/transforms';
import type { Kilometers, Radians, Seconds, TemeVec3 } from '../../types/types';
import { DEG2RAD, RAD2DEG, secondsPerDay } from '../../utils/constants';
import { breakupLocationAtEpoch } from '../BreakupLocation';
import { fragmentDispersionStats, normalizeFragment } from '../BreakupFragments';
import { j2SecularRates } from '../J2Secular';
import { SYNTH_T0, syntheticCloud } from './synthetic-cloud';

// Cosmos 1408 (13552) from the ootk full-catalog fixture.
const LINE1 = '1 13552U 82092A   22221.72076898  .00006048  00000-0  18252-3 0  9992';
const LINE2 = '2 13552  82.5703 215.1908 0023755 276.3810  83.4728 15.33774661184129';

const wrapDeg = (x: number): number => ((((x + 180) % 360) + 360) % 360) - 180;

describe('breakupLocationAtEpoch', () => {
  it('matches a direct SGP4 propagate and TEME-to-geodetic conversion for TLE input', () => {
    const tle = new Tle(LINE1, LINE2);
    const epoch = tle.epoch.roll((-3.25 * secondsPerDay) as Seconds);
    const loc = breakupLocationAtEpoch({ line1: LINE1, line2: LINE2 }, epoch)!;
    const teme = tle.propagate(epoch);
    const lla = eci2lla(teme.position as unknown as TemeVec3, epoch.gmstAngle());

    expect(loc.propagator).toBe('sgp4');
    expect(loc.epoch).toBe(epoch);
    // Different frame chains (TEME + GMST vs J2000 + IAU-76/FK5 to ITRF) agree to a few hundredths of a degree.
    expect(loc.latitudeDeg).toBeCloseTo(lla.lat, 1);
    expect(Math.abs(wrapDeg(loc.longitudeDeg - lla.lon))).toBeLessThan(0.05);
    expect(loc.altitudeKm).toBeCloseTo(lla.alt, 0);
    expect(loc.eci.position.magnitude()).toBeCloseTo(teme.position.magnitude(), 6);
  });

  it('gives the same answer for a Tle instance and for its lines', () => {
    const tle = new Tle(LINE1, LINE2);
    const epoch = tle.epoch.roll(3600 as Seconds);
    const a = breakupLocationAtEpoch(tle, epoch)!;
    const b = breakupLocationAtEpoch({ line1: LINE1, line2: LINE2 }, epoch)!;

    expect(a.latitudeDeg).toBe(b.latitudeDeg);
    expect(a.longitudeDeg).toBe(b.longitudeDeg);
  });

  it('returns the element set position at its own epoch for classical elements', () => {
    const { parent } = syntheticCloud({ count: 1 });
    const loc = breakupLocationAtEpoch(parent, SYNTH_T0)!;
    const expected = parent.toJ2000();
    const geo = expected.toITRF().toGeodetic();

    expect(loc.propagator).toBe('secular-j2');
    expect(loc.eci.position.distance(expected.position)).toBeLessThan(1e-6);
    expect(loc.latitudeDeg).toBeCloseTo(geo.latDeg, 9);
    expect(loc.longitudeDeg).toBeCloseTo(geo.lonDeg, 9);
  });

  it('carries RAAN with the secular J2 rate for classical elements', () => {
    const { parent } = syntheticCloud({ count: 1 });
    const dt = 10 * secondsPerDay;
    const loc = breakupLocationAtEpoch(parent, SYNTH_T0.roll(dt as Seconds))!;
    const h = loc.eci.position.cross(loc.eci.velocity);
    const raan = Math.atan2(h.x, -h.y);
    const expected = parent.rightAscension + j2SecularRates(parent.semimajorAxis, parent.eccentricity, parent.inclination).raanDot * dt;

    expect(wrapDeg((raan - expected) * RAD2DEG)).toBeCloseTo(0, 9);
    expect(Math.acos(h.z / h.magnitude()) * RAD2DEG).toBeCloseTo(parent.inclination * RAD2DEG, 9);
  });

  it('returns null when plain elements carry no mean anomaly', () => {
    const { fragments } = syntheticCloud({ count: 1 });
    const { meanAnomaly: _unused, ...withoutM } = fragments[0];

    expect(breakupLocationAtEpoch(withoutM, SYNTH_T0)).toBeNull();
    expect(breakupLocationAtEpoch(fragments[0], SYNTH_T0)).not.toBeNull();
  });
});

describe('j2SecularRates', () => {
  it('gives the sun-synchronous rate at 700 km and 98.19 deg', () => {
    const rates = j2SecularRates(7078.1363, 0, 98.19 * DEG2RAD);

    expect(rates.raanDot * secondsPerDay * RAD2DEG).toBeCloseTo(0.9856, 2);
  });

  it('matches ClassicalElements.nodalPrecessionRate', () => {
    const el = new ClassicalElements({
      epoch: EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z'),
      semimajorAxis: 7200 as Kilometers,
      eccentricity: 0.01,
      inclination: (51.6 * DEG2RAD) as Radians,
      rightAscension: 0 as Radians,
      argPerigee: 0 as Radians,
      trueAnomaly: 0 as Radians,
    });

    expect(j2SecularRates(el.semimajorAxis, el.eccentricity, el.inclination).raanDot).toBeCloseTo(el.nodalPrecessionRate, 18);
  });

  it('freezes the argument of perigee at the critical inclination', () => {
    const rates = j2SecularRates(26600, 0.74, Math.acos(Math.sqrt(1 / 5)));

    expect(Math.abs(rates.argPerigeeDot)).toBeLessThan(1e-20);
    // 3 cos^2 i - 1 = -0.4 there, so the J2 mean-anomaly correction is negative.
    expect(rates.meanAnomalyDot).toBeLessThan(rates.meanMotion);
  });

  it('returns NaN for non-elliptic input', () => {
    expect(j2SecularRates(7000, 1.2, 0).raanDot).toBeNaN();
    expect(j2SecularRates(-7000, 0, 0).raanDot).toBeNaN();
  });
});

describe('normalizeFragment and fragmentDispersionStats', () => {
  it('reads a TLE from lines and from a Tle instance the same way', () => {
    const a = normalizeFragment({ line1: LINE1, line2: LINE2 })!;
    const b = normalizeFragment(new Tle(LINE1, LINE2))!;

    expect(Math.abs(a.epochPosix - b.epochPosix)).toBeLessThan(1e-3);
    expect(a.raanDot).toBe(b.raanDot);
    expect(a.meanMotionDot).toBeCloseTo(2 * 0.00006048, 12);
    expect(a.rightAscension * RAD2DEG).toBeCloseTo(215.1908, 10);
    expect(a.revsPerDay).toBeCloseTo(15.33774661, 8);
  });

  it('returns null for unusable input', () => {
    expect(normalizeFragment({ line1: 'x', line2: 'y' })).toBeNull();
    expect(normalizeFragment({ epoch: SYNTH_T0, eccentricity: 0, inclination: 1, rightAscension: 0, argPerigee: 0 })).toBeNull();
  });

  it('reports a tight RAAN spread at the event and a wide one 400 days later', () => {
    const { fragments } = syntheticCloud({ count: 40, ageDays: 400, argLatDeg: 30, seed: 7 });
    const atEvent = fragmentDispersionStats(fragments, SYNTH_T0)!;
    const now = fragmentDispersionStats(fragments)!;

    expect(atEvent.count).toBe(40);
    expect(atEvent.raanSpreadDeg).toBeLessThan(0.5);
    expect(now.raanSpreadDeg).toBeGreaterThan(20);
    expect(now.epoch.posix).toBe(Math.max(...fragments.map((f) => f.epoch.posix)));
    expect(now.inclinationMeanDeg).toBeCloseTo(82.56, 0);
    expect(now.raanDotStdDegPerDay).toBeGreaterThan(0);
    expect(now.perigeeMinKm).toBeLessThan(now.apogeeMaxKm);
    expect(atEvent.raanMeanDeg).toBeGreaterThanOrEqual(0);
    expect(atEvent.raanMeanDeg).toBeLessThan(360);
    expect(fragmentDispersionStats([])).toBeNull();
  });
});
