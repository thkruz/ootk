/**
 * QA 2026-10 regression tests for src/coordinate.
 *
 * Source: hq/reports/ootk-qa-deep-dive-2026-10-13.md, section 1 items 5, 6, 16 (ITRF half), 17 and section 2.2.
 * Moved from test/qa/coordinate-covariance.qa.test.ts. These are permanent regression tests for the v8 fixes.
 */
import {
  ClassicalElements,
  EpochUTC,
  FormatTle,
  Geodetic,
  Hill,
  ITRF,
  J2000,
  OrbitRegime,
  Thrust,
  Tle,
  Vector3D,
  Waypoint,
  earthGravityParam,
  type Degrees,
  type Kilometers,
  type KilometersPerSecond,
  type MetersPerSecond,
  type Radians,
  type Seconds,
  type TleLine1,
} from '@src/main';
import { convert6DigitToA5, convertA5to6Digit } from '@src/coordinate/alpha5';

// Library mu (398600.4415), so circular test states are exactly circular to the library.
const MU = earthGravityParam;
const ISS_LINE1 = '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005' as TleLine1;
const ISS_EPOCH = new Date('2025-01-19T12:00:00.000Z');

const km = (v: number) => v as Kilometers;
const kms = (v: number) => v as KilometersPerSecond;

describe('alpha5 (QA 2026-10 regressions)', () => {
  // Report section 1 item 5, src/coordinate/alpha5.ts:112. The letter-O skip starts at first >= 24 instead
  // of >= 23, so 230000 encodes as 'O0000' (illegal letter) instead of 'P0000'.
  it('convert6DigitToA5 encodes 230000 as P0000, never the illegal letter O', () => {
    expect(convert6DigitToA5('230000')).toBe('P0000');
  });

  // Same defect: 239999 must encode with P and decode back to itself.
  it('convert6DigitToA5 output for 239999 round-trips through convertA5to6Digit', () => {
    const a5 = convert6DigitToA5('239999');

    expect(a5).not.toMatch(/^[IO]/u);
    expect(convertA5to6Digit(a5)).toBe('239999');
  });
});

describe('Tle.meanMoDev2 (QA 2026-10 regressions)', () => {
  // Report section 1 item 6, src/coordinate/Tle.ts:703-711. parseFloat on the raw field ignores the assumed
  // decimal point and exponent. ' 12345-5' must be 0.12345e-5 = 1.2345e-6; actual 12345.
  it('meanMoDev2 decodes " 12345-5" with the assumed decimal point and exponent as 1.2345e-6', () => {
    const line1 = `${ISS_LINE1.substring(0, 44)} 12345-5${ISS_LINE1.substring(52)}` as TleLine1;

    expect(line1.substring(44, 52)).toBe(' 12345-5');
    expect(Tle.meanMoDev2(line1)).toBeCloseTo(1.2345e-6, 12);
  });
});

describe('ITRF.toGeodetic (QA 2026-10 regressions)', () => {
  // Report section 1 item 16 (ITRF half), src/coordinate/frames.ts:346. South-pole branch uses z + radiusPolar.
  // (0, 0, -7000) must be alt = 7000 - 6356.75 = +643.25 km; actual -643.25 km.
  it('ITRF.toGeodetic gives +643 km altitude for a point 7000 km below the south pole', () => {
    const epoch = EpochUTC.fromDateTime(ISS_EPOCH);
    const itrf = new ITRF(epoch, new Vector3D(km(0), km(0), km(-7000)), new Vector3D(kms(0), kms(0), kms(0)));
    const geo = itrf.toGeodetic();

    expect(geo.lat).toBeCloseTo(-Math.PI / 2, 9);
    expect(geo.alt).toBeCloseTo(643.25, 0);
  });
});

describe('ClassicalElements (QA 2026-10 regressions)', () => {
  const epoch = EpochUTC.fromDateTime(ISS_EPOCH);

  const roundTripError = (state: J2000): number => {
    const back = ClassicalElements.fromStateVector(state).toJ2000();

    return back.position.subtract(state.position).magnitude();
  };

  // Report section 1 item 17, src/coordinate/ClassicalElements.ts:109-135. Circular equatorial orbit loses
  // true longitude: a state at (0, 7000, 0) comes back at (7000, 0, 0). Expected error < 1 m; actual 9,899 km.
  it('fromStateVector/toJ2000 round-trips a circular equatorial orbit and preserves true longitude', () => {
    const v = Math.sqrt(MU / 7000);
    const state = new J2000(epoch, new Vector3D(km(0), km(7000), km(0)), new Vector3D(kms(-v), kms(0), kms(0)));

    expect(roundTripError(state)).toBeLessThan(1e-3);
  });

  // Same item: retrograde equatorial (i = pi) ignores the mirror from rotX(-pi). Expected error < 1 m;
  // actual is thousands of km (report: 13,799 km).
  it('fromStateVector/toJ2000 round-trips a retrograde equatorial (i = pi) eccentric orbit', () => {
    const v = 1.05 * Math.sqrt(MU / 7000);
    const state = new J2000(epoch, new Vector3D(km(0), km(7000), km(0)), new Vector3D(kms(v), kms(0), kms(0)));

    expect(roundTripError(state)).toBeLessThan(1e-3);
  });

  // Report section 2.2 (L), src/coordinate/ClassicalElements.ts:248. MEO window is period 600 to 800 min.
  // Galileo (a = 29,600 km, period 844.7 min) must be MEO; actual OTHER.
  it('getOrbitRegime classifies a Galileo orbit (period 844.7 min) as MEO', () => {
    const galileo = new ClassicalElements({
      epoch,
      semimajorAxis: km(29600),
      eccentricity: 0.0002,
      inclination: (56 * Math.PI / 180) as Radians,
      rightAscension: 1 as Radians,
      argPerigee: 1 as Radians,
      trueAnomaly: 1 as Radians,
    });

    expect(galileo.period).toBeGreaterThan(840);
    expect(galileo.getOrbitRegime()).toBe(OrbitRegime.MEO);
  });
});

describe('EquinoctialElements (QA 2026-10 regressions)', () => {
  const epoch = EpochUTC.fromDateTime(ISS_EPOCH);
  const elements = new ClassicalElements({
    epoch,
    semimajorAxis: km(7000),
    eccentricity: 0.001,
    inclination: 0.9 as Radians,
    rightAscension: 4 as Radians,
    argPerigee: 1 as Radians,
    trueAnomaly: 1 as Radians,
  });

  // Report section 2.2 (C), src/coordinate/EquinoctialElements.ts:165-168. toClassicalElements returns
  // RAAN unwrapped in (-pi, pi]. Omega = 4 rad must round-trip to 4; actual -2.283.
  it('toClassicalElements returns RAAN in [0, 2pi): Omega = 4 rad round-trips to 4', () => {
    const back = elements.toEquinoctialElements().toClassicalElements();

    expect(back.rightAscension).toBeCloseTo(4, 9);
  });

  // Same finding: the negative RAAN then makes Tle.fromClassicalElements throw.
  it('Tle.fromClassicalElements accepts the result of an equinoctial round trip without throwing', () => {
    const back = elements.toEquinoctialElements().toClassicalElements();

    expect(() => Tle.fromClassicalElements(back)).not.toThrow();
  });
});

describe('Geodetic.isInView (QA 2026-10 regressions)', () => {
  // Report section 2.2 (C), src/coordinate/Geodetic.ts:186-190. Uses max(fov1, fov2) instead of fov1 + fov2.
  // Two 500 km points 35 deg apart: each fov is 22.0 deg, mutual limit 44.0 deg. Expected true; actual false.
  it('isInView reports two 500 km satellites 35 deg apart as mutually visible', () => {
    const a = Geodetic.fromDegrees(0 as Degrees, 0 as Degrees, km(500));
    const b = Geodetic.fromDegrees(0 as Degrees, 35 as Degrees, km(500));

    expect(a.isInView(b)).toBe(true);
  });
});

describe('Hill.maneuverSequence (QA 2026-10 regressions)', () => {
  // Report section 2.2 (L), src/coordinate/Hill.ts:262. Pre-maneuvers are filtered with center >= pivot, so a
  // pre-maneuver between epoch and pivot (the normal case) is dropped. Expected: it appears in the output.
  it('maneuverSequence keeps a pre-maneuver scheduled between the epoch and the pivot', () => {
    const t0 = EpochUTC.fromDateTime(ISS_EPOCH);
    const hill = new Hill(t0, new Vector3D(km(0), km(-1), km(0)), new Vector3D(kms(0), kms(0), kms(0)), km(6778));
    const pre = new Thrust(t0.roll(300 as Seconds), 0 as MetersPerSecond, 0.1 as MetersPerSecond, 0 as MetersPerSecond);
    const pivot = t0.roll(600 as Seconds);
    const wpt = new Waypoint(t0.roll(3000 as Seconds), new Vector3D(km(0), km(-0.5), km(0)));

    const output = hill.maneuverSequence(pivot, [wpt], [pre]);

    expect(output).toContain(pre);
  });
});

describe('FormatTle.eccentricity (QA 2026-10 regressions)', () => {
  // Report section 2.2 (C), src/coordinate/FormatTle.ts:119-129. Number input uses toString(), which goes
  // exponential below 1e-6. 5e-7 must format as '0000005'; actual '0000000'.
  it('eccentricity(5e-7) formats as 0000005', () => {
    expect(FormatTle.eccentricity(5e-7)).toBe('0000005');
  });
});
