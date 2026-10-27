/**
 * QA 2026-10 regression tests for src/objects.
 *
 * Source: hq/reports/ootk-qa-deep-dive-2026-10-13.md, section 1 item 1 and section 2.4.
 * Permanent regression tests for the v8 fixes; each test asserts the corrected behavior.
 * Moved from test/qa/objects-observation.qa.test.ts.
 */
import {
  AccessCalculator,
  Degrees,
  DynamicGroundObject,
  EpochUTC,
  EphemerisSatellite,
  GroundStation,
  History,
  InterpolatorType,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Radians,
  Satellite,
  Seconds,
  SpaceObject,
  Star,
  TleLine1,
  TleLine2,
  Vector3D,
} from '@src/main';
import type { OmmDataFormat } from '@src/interfaces/OmmFormat';
import type { ParsedOem } from '@src/parsers/OemTypes';

// Same shape as the fixture in src/objects/__tests__/Satellite.fromOmm.test.ts, with a
// fractional-second EPOCH.
const issOmm: OmmDataFormat = {
  OBJECT_NAME: 'ISS (ZARYA)',
  OBJECT_ID: '1998-067A',
  NORAD_CAT_ID: '25544',
  EPOCH: '2024-01-12T19:18:27.745920',
  MEAN_MOTION: 15.5,
  ECCENTRICITY: 0.0001137,
  INCLINATION: 51.6415,
  RA_OF_ASC_NODE: 161.8339,
  ARG_OF_PERICENTER: 35.9781,
  MEAN_ANOMALY: 54.7009,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 1,
  BSTAR: 0.00003879,
  MEAN_MOTION_DOT: 0,
  MEAN_MOTION_DDOT: 0,
};

// Day of year 12 plus 19:18:27.745920 as a fraction of a day.
const EXPECTED_DOY = 12 + (19 * 3600 + 18 * 60 + 27.74592) / 86400;

function tleChecksum(line: string): number {
  let sum = 0;

  for (const ch of line.slice(0, 68)) {
    if (ch >= '0' && ch <= '9') {
      sum += Number(ch);
    } else if (ch === '-') {
      sum += 1;
    }
  }

  return sum % 10;
}

function withChecksum(line: string): string {
  return line.slice(0, 68) + String(tleChecksum(line));
}

type Xyz = { x: number; y: number; z: number };

function angleDeg(a: Xyz, b: Xyz): number {
  const na = Math.hypot(a.x, a.y, a.z);
  const nb = Math.hypot(b.x, b.y, b.z);
  const dot = Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y + a.z * b.z) / (na * nb)));

  return (Math.acos(dot) * 180) / Math.PI;
}

function makeEphemeris(): J2000[] {
  const base = 1704067200;
  const states: J2000[] = [];
  const w = 7.612 / 6878.137;

  // Circular 6878 km equatorial orbit sampled every 60 s.
  for (let i = 0; i < 12; i++) {
    const t = i * 60;
    const th = w * t;

    states.push(
      new J2000(
        new EpochUTC((base + t) as Seconds),
        new Vector3D(6878.137 * Math.cos(th), 6878.137 * Math.sin(th), 0) as Vector3D<Kilometers>,
        new Vector3D(-7.612 * Math.sin(th), 7.612 * Math.cos(th), 0) as Vector3D<KilometersPerSecond>,
      ),
    );
  }

  return states;
}

/** A fake target whose ECEF is directly overhead (0,0) when visible(t) is true, else antipodal. */
function fakeTarget(visible: (ms: number) => boolean): SpaceObject {
  return {
    ecef: (date: Date) => (visible(date.getTime()) ? { x: 7000, y: 0, z: 0 } : { x: -7000, y: 0, z: 0 }),
  } as unknown as SpaceObject;
}

describe('Satellite.fromOmm epoch (QA 2026-10 regressions)', () => {
  // Report 1.1, Satellite.ts:433-438. Date.UTC truncates 27.745920 s to 27 s, so epochDay is
  // 0.745920 s (8.633e-6 day) early. Expected 12.8044878... ; actual 12.8044791...
  it('fromOmm keeps fractional seconds of EPOCH in the derived epoch day', () => {
    const sat = Satellite.fromOmm(issOmm);

    expect(Math.abs(sat.epochDay - EXPECTED_DOY)).toBeLessThan(1e-9);
    expect(Math.abs(sat.satrec.epochdays - EXPECTED_DOY)).toBeLessThan(1e-9);
  });

  // Report 1.1, Satellite.ts:433-438 and 480-499. The generated TLE line 1 epoch field must be
  // the correctly rounded epoch (24012.80448780), not the truncated one (24012.80447917).
  it('fromOmm writes the fractional-second epoch into TLE line 1 cols 19-32', () => {
    const sat = Satellite.fromOmm(issOmm);

    expect(sat.tle1.slice(18, 32)).toBe('24012.80448780');
  });

  // Report 1.1. Propagating the OMM satellite at its own epoch must agree with a TLE whose
  // epoch field is correctly rounded. Expected < 0.1 km; actual about 5.7 km (0.746 s x 7.66 km/s).
  it('fromOmm satellite propagates to the same position as the correctly rounded TLE at epoch', () => {
    const sat = Satellite.fromOmm(issOmm);
    const epochField = `24${String(Math.floor(EXPECTED_DOY)).padStart(3, '0')}.${(EXPECTED_DOY % 1).toFixed(8).slice(2)}`;
    const tle1 = withChecksum(sat.tle1.slice(0, 18) + epochField + sat.tle1.slice(32)) as TleLine1;
    const ref = Satellite.fromTLE(tle1, sat.tle2 as TleLine2);
    const epochDate = new Date(Date.UTC(2024, 0, 12, 19, 18, 27, 746));

    const a = sat.eci(epochDate)!.position;
    const b = ref.eci(epochDate)!.position;
    const dist = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

    expect(dist).toBeLessThan(0.1);
  });
});

describe('Satellite identifiers and TLE generation (QA 2026-10 regressions)', () => {
  // Report 2.4 (L), Satellite.ts:108-113, 393-404. TLE sat number 00005 should give a 5-char
  // sccNum5 "00005"; actual "5".
  it('sccNum5 keeps leading zeros for a low catalog number from a TLE', () => {
    const iss = Satellite.fromOmm(issOmm);
    const tle1 = withChecksum(`${iss.tle1.slice(0, 2)}00005${iss.tle1.slice(7)}`) as TleLine1;
    const tle2 = withChecksum(`${iss.tle2.slice(0, 2)}00005${iss.tle2.slice(7)}`) as TleLine2;
    const sat = Satellite.fromTLE(tle1, tle2);

    expect(sat.sccNum5).toBe('00005');
  });

  // Report 2.4 (P), Satellite.ts:497. String(undefined) || 'U' yields "undefined", so TLE
  // line 1 col 8 becomes "u". Expected "U".
  it('fromOmm writes classification U when CLASSIFICATION_TYPE is missing', () => {
    const { CLASSIFICATION_TYPE: _omit, ...rest } = issOmm;
    const sat = Satellite.fromOmm(rest as OmmDataFormat);

    expect(sat.tle1.charAt(7)).toBe('U');
    expect(sat.tle1).not.toMatch(/undefined/u);
  });

  // Report 2.4 (L), Satellite.ts:422-423, 470-471. Perigee/apogee heights use 6371 km instead
  // of the WGS-84 equatorial radius 6378.137 km used by VisualizationHelpers: off by 7.137 km.
  it('perigee and apogee are heights above the 6378.137 km equatorial radius', () => {
    const sat = Satellite.fromOmm(issOmm);
    const a = sat.semiMajorAxis;
    const e = sat.eccentricity;

    expect(sat.perigee).toBeCloseTo(a * (1 - e) - 6378.137, 2);
    expect(sat.apogee).toBeCloseTo(a * (1 + e) - 6378.137, 2);
  });
});

describe('Star (QA 2026-10 regressions)', () => {
  const sirius = { id: 1, name: 'Sirius', ra: 1.7677943 as Radians, dec: -0.2917512 as Radians };
  const date = new Date('2024-03-01T03:00:00Z');

  // Report 2.4 (C), Star.ts:61-80. Default observer lat: 180 makes astronomy-engine throw.
  it('rae() with default arguments does not throw', () => {
    const star = new Star(sirius);

    expect(() => star.rae()).not.toThrow();
  });

  // Report 2.4 (C), Star.ts:61-67. Same default observer lat: 180 on eci().
  it('eci() with default arguments does not throw', () => {
    const star = new Star(sirius);

    expect(() => star.eci()).not.toThrow();
  });

  // Report 2.4 (C), Star.ts:61-67. eci(lla) computes az/el at lla but rebuilds ECEF from
  // (0,0), so the direction depends on the observer. Expected < 2 deg (parallax at 250000 km
  // is about 1.5 deg); actual is tens of degrees.
  it('eci(lla) points the same direction for a (40,-75) observer as for a (0,0) observer', () => {
    const star = new Star(sirius);
    const origin = star.eci({ lat: 0 as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers }, date);
    const remote = star.eci({ lat: 40 as Degrees, lon: -75 as Degrees, alt: 0 as Kilometers }, date);

    expect(angleDeg(origin, remote)).toBeLessThan(2);
  });
});

describe('DynamicGroundObject as observer (QA 2026-10 regressions)', () => {
  // Report 2.4 (C), Satellite.ts:891 with DynamicGroundObject.ts:117-123. Satellite.rae reads
  // the readonly lat/lon/alt frozen at the first waypoint (0,0). One hour later the object is
  // at (0,90); look angles must match a static station there. Actual range differs by
  // thousands of km.
  it('Satellite.rae on a moving observer uses its position at the requested time', () => {
    const sat = Satellite.fromOmm(issOmm);
    const t0 = new Date('2024-01-12T20:00:00Z');
    const t1 = new Date('2024-01-12T21:00:00Z');
    const mover = new DynamicGroundObject({
      id: 1,
      name: 'Mover',
      interpolationMethod: 'linear',
      waypoints: [
        { time: t0, lat: 0 as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers },
        { time: t1, lat: 0 as Degrees, lon: 90 as Degrees, alt: 0 as Kilometers },
      ],
    });
    const fixed = new GroundStation({ lat: 0 as Degrees, lon: 90 as Degrees, alt: 0 as Kilometers });

    const moving = sat.rae(mover, t1)!;
    const reference = sat.rae(fixed, t1)!;

    expect(Math.abs(moving.rng - reference.rng)).toBeLessThan(1e-6);
    expect(Math.abs(moving.az - reference.az)).toBeLessThan(1e-6);
    expect(Math.abs(moving.el - reference.el)).toBeLessThan(1e-6);
  });
});

describe('History (QA 2026-10 regressions)', () => {
  // Report 2.4 (L), History.ts:59-70. After a forward sweep sample at T+7d, a real-time sample
  // at T (7 days away, far outside the 1 s interval) is dropped. Expected 2 entries; actual 1.
  it('samplingInterval does not block a sample that is earlier than the last sweep sample', () => {
    const h = new History<number>({ samplingInterval: 1000 });
    const t = Date.UTC(2024, 0, 1);

    h.add(new Date(t + 7 * 86400000), 1);
    h.add(new Date(t), 2);

    expect(h.length).toBe(2);
  });

  // Report 2.4 (L), Satellite.ts:709-711 with History.ts. rae() calls eci() internally and that
  // internal call is recorded. Expected 0 entries after rae(); actual 1.
  it('Satellite.rae does not record its internal eci() call into history', () => {
    const sat = Satellite.fromOmm(issOmm);
    const site = new GroundStation({ lat: 40 as Degrees, lon: -75 as Degrees, alt: 0.1 as Kilometers });

    sat.enableHistory();
    sat.rae(site, new Date('2024-01-12T20:00:00Z'));

    expect(sat.history!.length).toBe(0);
  });

  // Report 2.4 (L), History.ts clone(). clone() is documented as a deep copy but only spreads
  // the top level, so nested position objects are shared. Expected clone keeps 1; actual 999.
  it('clone() deep-copies nested entry data', () => {
    const h = new History<{ position: { x: number } }>();

    h.add(new Date(0), { position: { x: 1 } });
    const c = h.clone();

    h.getAll()[0].data.position.x = 999;

    expect(c.getAll()[0].data.position.x).toBe(1);
  });
});

describe('EphemerisSatellite (QA 2026-10 regressions)', () => {
  // Report 2.4 (C), EphemerisSatellite.ts:268-283. referenceFrame TEME casts the J2000
  // interpolator output to TEME and calls .toJ2000(), which does not exist: TypeError.
  it('getJ2000 works for an ephemeris stored with referenceFrame TEME', () => {
    const eph = makeEphemeris();
    const sat = new EphemerisSatellite({ id: 1, name: 'T', ephemeris: eph, referenceFrame: 'TEME' });

    expect(() => sat.getJ2000(new EpochUTC((eph[0].epoch.posix + 90) as Seconds))).not.toThrow();
  });

  // Report 2.4 (C), EphemerisSatellite.ts:157. REF_FRAME ITRF is silently treated as J2000, so
  // an Earth-fixed OEM gives the same inertial position as EME2000 (off by Earth rotation).
  // Expected: rejected, or a J2000 position differing by > 1 km; actual: identical (0 km).
  it('fromParsedOem rejects REF_FRAME ITRF or converts it to a J2000 state distinct from EME2000', () => {
    const eph = makeEphemeris();
    const meta = {
      OBJECT_NAME: 'T',
      OBJECT_ID: '2024-001A',
      CENTER_NAME: 'EARTH',
      TIME_SYSTEM: 'UTC',
      START_TIME: '2024-01-01T00:00:00',
      STOP_TIME: '2024-01-01T00:11:00',
    };
    const build = (frame: string): ParsedOem =>
      ({
        header: { CCSDS_OEM_VERS: '2.0', CREATION_DATE: '2024-01-01T00:00:00', ORIGINATOR: 'QA' },
        dataBlocks: [{ metadata: { ...meta, REF_FRAME: frame }, ephemeris: eph }],
      }) as unknown as ParsedOem;
    const epoch = new EpochUTC((eph[0].epoch.posix + 90) as Seconds);
    const eme = EphemerisSatellite.fromParsedOem(build('EME2000')).getJ2000(epoch)!;
    let itrf: J2000 | null;

    try {
      itrf = EphemerisSatellite.fromParsedOem(build('ITRF')).getJ2000(epoch);
    } catch {
      // Rejecting an unsupported frame is an acceptable fix.
      return;
    }

    expect(itrf).not.toBeNull();
    expect(itrf!.position.subtract(eme.position).magnitude()).toBeGreaterThan(1);
  });

  // Report 2.4 (C), EphemerisSatellite.ts:559-567. clone() drops interpolatorType and order,
  // so a cubic-spline satellite becomes Lagrange 10. Expected "cubic-spline"; actual "lagrange".
  it('clone() keeps the interpolator type', () => {
    const sat = new EphemerisSatellite({
      id: 1,
      name: 'T',
      ephemeris: makeEphemeris(),
      interpolatorType: InterpolatorType.CUBIC_SPLINE,
    });

    expect(sat.clone().toString()).toMatch(/Interpolator: cubic-spline/u);
  });

  // Report 2.4 (C), EphemerisSatellite.ts:466-499. At the last point t0 == t1, so linear
  // interpolation divides by zero. Expected null or a finite position; actual NaN.
  it('getLinearInterpolatedState at the last ephemeris point returns null or finite values', () => {
    const eph = makeEphemeris();
    const sat = new EphemerisSatellite({ id: 1, name: 'T', ephemeris: eph });
    const state = sat.getLinearInterpolatedState(eph[eph.length - 1].epoch);
    const ok = state === null || (Number.isFinite(state.position.x) && Number.isFinite(state.position.y));

    expect(ok).toBe(true);
  });
});

describe('AccessCalculator (QA 2026-10 regressions)', () => {
  const site = new GroundStation({ lat: 0 as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers });
  const start = Date.UTC(2024, 0, 1);
  const step = 10000;

  // Report 2.4 (C), AccessCalculator.ts:117-150. Target visible at start - step but not at
  // start: a window [start, start] of zero length is emitted with maxElevationTime at
  // start - step, outside the window. Expected duration > 0; actual 0.
  it('calculateAccess never emits a zero-length window with maxElevationTime outside it', () => {
    const target = fakeTarget((ms) => ms < start);
    const windows = AccessCalculator.calculateAccess(site, target, new Date(start), new Date(start + 60000), {}, step);

    // Verifier fix M.10: the loop alone passed on an empty result. The target is never visible
    // inside [start, start + 60 s], so there must be no window at all.
    expect(windows.length).toBe(0);
    for (const w of windows) {
      expect(w.duration).toBeGreaterThan(0);
      expect(w.maxElevationTime.getTime()).toBeGreaterThanOrEqual(w.start.getTime());
    }

    // Visible from start - 30 s to start + 25 s: exactly one window, clipped to start
    const straddling = fakeTarget((ms) => ms >= start - 30000 && ms < start + 25000);
    const clipped = AccessCalculator.calculateAccess(site, straddling, new Date(start), new Date(start + 60000), {}, step);

    expect(clipped.length).toBe(1);
    expect(clipped[0].start.getTime()).toBe(start);
    expect(clipped[0].duration).toBeGreaterThan(0);
  });

  // Report 2.4 (C), AccessCalculator.ts:117-150. Edges are not root-found. Rise at start + 1 s
  // with a 10 s step: expected start within 0.5 s of the true rise; actual 9 s late.
  it('calculateAccess refines the window start to the true rise time', () => {
    const rise = start + 1000;
    const target = fakeTarget((ms) => ms >= rise && ms < rise + 120000);
    const windows = AccessCalculator.calculateAccess(site, target, new Date(start), new Date(start + 300000), {}, step);

    expect(windows.length).toBe(1);
    expect(Math.abs(windows[0].start.getTime() - rise)).toBeLessThan(500);
  });

  // Report 2.4 (C), AccessCalculator.ts:186. Strict > skips a pass starting exactly at
  // `after`. Expected a window starting at `after`; actual null.
  it('getNextAccess returns a pass that starts exactly at the after time', () => {
    const target = fakeTarget((ms) => ms >= start && ms < start + 120000);
    const next = AccessCalculator.getNextAccess(site, target, new Date(start), {}, 0.01);

    expect(next).not.toBeNull();
    expect(next!.start.getTime()).toBe(start);
  });

  // Guard for the fix above (also passed before the fix): a pass already in progress at `after` (visible at
  // after - step) must still be skipped. A naive change of > to >= would re-admit it.
  it('getNextAccess still skips a pass that is already in progress at the after time', () => {
    const target = fakeTarget((ms) => ms >= start - 60000 && ms < start + 120000);
    const next = AccessCalculator.getNextAccess(site, target, new Date(start), {}, 0.01);

    expect(next === null || next.start.getTime() > start + 120000).toBe(true);
  });
});

describe('GroundObject validation (QA 2026-10 regressions)', () => {
  // Report 2.4 (L), GroundObject.ts:234-236. A Dead Sea site (alt -0.43 km) is rejected.
  it('accepts a negative altitude such as the Dead Sea shore', () => {
    expect(
      () => new GroundStation({ lat: 31.5 as Degrees, lon: 35.5 as Degrees, alt: -0.43 as Kilometers }),
    ).not.toThrow();
  });

  // Report 2.4 (L), GroundObject.ts:234-236. NaN passes the < and > checks. Expected a throw; none.
  it('rejects NaN latitude', () => {
    expect(() => new GroundStation({ lat: NaN as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers })).toThrow();
  });
});

