/**
 * v8 regression tests for src/objects (QA 2026-10, report section 1 item 1 and section 2.4).
 *
 * Each block checks a property or an independently derived value, complementing the single
 * values pinned in test/qa/objects-observation.qa.test.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AccessCalculator,
  ClassicalElements,
  DEG2RAD,
  CenterBody,
  CenterBodyMu,
  Degrees,
  DynamicGroundObject,
  EpochUTC,
  EphemerisSatellite,
  GroundStation,
  History,
  InterpolatorType,
  ITRF,
  J2000,
  Kilometers,
  KilometersPerSecond,
  OpticalSensor,
  parseCenterBody,
  Radians,
  Satellite,
  Seconds,
  SensorType,
  SpaceObject,
  Star,
  TEME,
  Tle,
  TleLine1,
  TleLine2,
  Vector3D,
  VisualizationHelpers,
} from '../../main';
import type { OmmDataFormat } from '../../interfaces/OmmFormat';
import type { ParsedOem } from '../../parsers/OemTypes';

const DEG = Math.PI / 180;

const baseOmm: OmmDataFormat = {
  OBJECT_NAME: 'TEST',
  OBJECT_ID: '1998-067A',
  NORAD_CAT_ID: '25544',
  EPOCH: '2024-01-13T01:02:03.456789',
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

/** ISS TLE from the repo fixture src/coordinate/__tests__/fixtures/stations.2le (first entry). */
function issFromFixture(): Satellite {
  const here = dirname(fileURLToPath(import.meta.url));
  const lines = readFileSync(join(here, '../../coordinate/__tests__/fixtures/stations.2le'), 'utf8').split(/\r?\n/u);

  return Satellite.fromTLE(lines[0] as TleLine1, lines[1] as TleLine2);
}

describe('v8: OMM epoch keeps fractional seconds (report 1.1)', () => {
  // 2024-01-13 is day 13. 01:02:03.456789 = 3723.456789 s, so the day of year is
  // 13 + 3723.456789 / 86400 = 13 + 0.0430955646875 = 13.0430955646875, i.e. 1 + 0.04309556...
  // past the start of day 13 (TLE convention: Jan 1 00:00 is day 1.0). The TLE field rounds this
  // to 8 decimals: 24013.04309556, which is 0.0000000046875 day (0.405 ms) earlier.
  const exactDoy = 13 + 3723.456789 / 86400;
  const tleDoy = 13.04309556;

  it('satrec.epochdays matches 13 + 3723.456789 / 86400 and the TLE field 24013.04309556', () => {
    const omm = Satellite.fromOmm(baseOmm);

    expect(Math.abs(omm.satrec.epochdays - exactDoy)).toBeLessThan(1e-12);
    expect(omm.tle1.slice(18, 32)).toBe('24013.04309556');

    const tle = Satellite.fromTLE(omm.tle1, omm.tle2);

    expect(Math.abs(tle.satrec.epochdays - tleDoy)).toBeLessThan(1e-12);
    // Same epoch to the TLE quantization of 0.5e-8 day
    expect(Math.abs(omm.satrec.epochdays - tle.satrec.epochdays)).toBeLessThanOrEqual(0.5e-8);
  });

  it('OMM and TLE satellites agree to 1 mm once the TLE epoch rounding is accounted for', () => {
    const omm = Satellite.fromOmm(baseOmm);
    const tle = Satellite.fromTLE(omm.tle1, omm.tle2);
    // The TLE epoch is delta = (exactDoy - tleDoy) days = 0.405 ms earlier. satrec.jdsatepoch is a
    // single double (resolution 2^-31 day = 40 us near JD 2.46e6), so the stored difference
    // equals delta only to that resolution: check it to one ulp, then use the stored value.
    const deltaDays = exactDoy - tleDoy;
    const storedDeltaDays = omm.satrec.jdsatepoch - tle.satrec.jdsatepoch;
    const jdUlp = 2 ** -31;

    expect(deltaDays * 86400).toBeCloseTo(0.000405, 6);
    expect(Math.abs(storedDeltaDays - deltaDays)).toBeLessThanOrEqual(jdUlp);

    // Same elements, epochs storedDelta apart: at any date the TLE's time since epoch is
    // storedDelta larger, so r_tle(t) = r_omm(t) + v storedDelta + O(a dt^2) (~1e-9 km).
    const deltaS = storedDeltaDays * 86400;
    const date = new Date(Date.UTC(2024, 0, 13, 2, 30, 0));
    const a = omm.eci(date)!;
    const b = tle.eci(date)!;
    const predicted = {
      x: a.position.x + a.velocity.x * deltaS,
      y: a.position.y + a.velocity.y * deltaS,
      z: a.position.z + a.velocity.z * deltaS,
    };
    const residualKm = Math.hypot(b.position.x - predicted.x, b.position.y - predicted.y, b.position.z - predicted.z);

    expect(residualKm).toBeLessThan(1e-6);
  });

  it('parses a day-of-year EPOCH and a trailing Z the same way as the calendar form', () => {
    const calendar = Satellite.fromOmm(baseOmm);
    const ordinal = Satellite.fromOmm({ ...baseOmm, EPOCH: '2024-013T01:02:03.456789Z' });

    expect(ordinal.satrec.epochdays).toBe(calendar.satrec.epochdays);
    expect(ordinal.satrec.jdsatepoch).toBe(calendar.satrec.jdsatepoch);
  });
});

describe('v8: sccNum5 / sccNum6 keep leading zeros (plan section 3)', () => {
  it('catalog number 5 gives sccNum "5", sccNum5 "00005" and sccNum6 "000005" from OMM and TLE', () => {
    const omm = Satellite.fromOmm({ ...baseOmm, NORAD_CAT_ID: '5' });
    const tle = Satellite.fromTLE(omm.tle1, omm.tle2);

    for (const sat of [omm, tle]) {
      expect(sat.sccNum).toBe('5');
      expect(sat.sccNum5).toBe('00005');
      expect(sat.sccNum6).toBe('000005');
    }
    // TLE columns 3-7 carry the same 5-character form
    expect(omm.tle1.slice(2, 7)).toBe(omm.sccNum5);
  });

  it('catalog number 0 (as VIMPEL entries carry) stays "0" with padded fixed-width forms', () => {
    const sat = Satellite.fromOmm({ ...baseOmm, NORAD_CAT_ID: '0' });

    expect(sat.sccNum).toBe('0');
    expect(sat.sccNum5).toBe('00000');
    expect(sat.sccNum6).toBe('000000');
  });

  it('6-digit IDs keep their alpha-5 form and need no padding', () => {
    const sat = Satellite.fromOmm({ ...baseOmm, NORAD_CAT_ID: '100000' });

    // Alpha-5: A = 10, so 100000 is "A0000"
    expect(sat.sccNum5).toBe('A0000');
    expect(sat.sccNum6).toBe('100000');
  });
});

describe('v8: Satellite apogee / perigee reference (plan section 6)', () => {
  it('altitude + 6378.137 km equals the geocentric radius, and apogee - perigee = 2 a e', () => {
    const sat = Satellite.fromOmm(baseOmm);

    expect(sat.apogee + 6378.137).toBeCloseTo(sat.apogeeRadius, 9);
    expect(sat.perigee + 6378.137).toBeCloseTo(sat.perigeeRadius, 9);
    expect(sat.apogee - sat.perigee).toBeCloseTo(2 * sat.semiMajorAxis * sat.eccentricity, 9);
    /*
     * Verifier fix M.6: Satellite, Tle and ClassicalElements now derive a from the mean motion with
     * one mu, WGS-72 398600.8 km^3/s^2 (the SGP4 convention), so they agree to 1e-6 km. v7 and
     * early v8 used 398600.8 in Satellite and 398600.4418 in Tle (2.01 m apart).
     */
    const tle = sat.toTle();

    expect(Math.abs(sat.semiMajorAxis - tle.semimajorAxis)).toBeLessThan(1e-6);
    expect(Math.abs(sat.apogee - tle.apogee)).toBeLessThan(1e-6);
    expect(Math.abs(sat.perigee - tle.perigee)).toBeLessThan(1e-6);

    const elements = new ClassicalElements({
      epoch: EpochUTC.fromDateTime(new Date(Date.UTC(2024, 0, 1))),
      semimajorAxis: sat.semiMajorAxis,
      eccentricity: sat.eccentricity,
      inclination: (sat.inclination * DEG2RAD) as Radians,
      rightAscension: (sat.rightAscension * DEG2RAD) as Radians,
      argPerigee: (sat.argOfPerigee * DEG2RAD) as Radians,
      trueAnomaly: 0 as Radians,
      mu: Tle.WGS72_MU,
    });

    expect(Math.abs(elements.apogee - sat.apogee)).toBeLessThan(1e-6);
    expect(Math.abs(elements.perigee - sat.perigee)).toBeLessThan(1e-6);
    // Same mu both ways: the Keplerian mean motion recovers the TLE mean motion
    expect(elements.revsPerDay).toBeCloseTo(sat.meanMotion, 10);
    // Kepler III, a^3 n^2 = mu with n in rad/s (Vallado, 4th ed., section 1.3)
    const nRad = (sat.meanMotion * 2 * Math.PI) / 86400;

    expect(sat.semiMajorAxis ** 3 * nRad ** 2).toBeCloseTo(398600.8, 6);
  });
});

describe('v8: Satellite.rae against an independent topocentric computation', () => {
  it('ISS fixture look angles match a hand-built WGS-84 / GMST (IAU-82) topocentric frame', () => {
    const sat = issFromFixture();
    const date = new Date(Date.UTC(2026, 2, 12, 20, 0, 0));
    const sub = sat.lla(date)!;
    // A site 5 deg south of the sub-satellite point, so the ISS is well above the horizon
    const latDeg = Math.max(-85, sub.lat - 5);
    const site = new GroundStation({ lat: latDeg as Degrees, lon: sub.lon, alt: 0.2 as Kilometers });

    // GMST, IAU-82 (Vallado, Fundamentals of Astrodynamics, 4th ed., eq. 3-47), UT1 = UTC
    const jd = date.getTime() / 86400000 + 2440587.5;
    const t = (jd - 2451545.0) / 36525;
    const gmstSec = 67310.54841 + (876600 * 3600 + 8640184.812866) * t + 0.093104 * t * t - 6.2e-6 * t * t * t;
    const gmst = ((((gmstSec % 86400) + 86400) % 86400) / 86400) * 2 * Math.PI;

    // TEME -> pseudo-ECEF: rotate by -GMST about z
    const r = sat.eci(date)!.position;
    const sx = Math.cos(gmst) * r.x + Math.sin(gmst) * r.y;
    const sy = -Math.sin(gmst) * r.x + Math.cos(gmst) * r.y;
    const sz = r.z;

    // Site ECEF on WGS-84 (a = 6378.137 km, f = 1 / 298.257223563)
    const a = 6378.137;
    const f = 1 / 298.257223563;
    const e2 = f * (2 - f);
    const phi = latDeg * DEG;
    const lam = sub.lon * DEG;
    const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const ox = (n + 0.2) * Math.cos(phi) * Math.cos(lam);
    const oy = (n + 0.2) * Math.cos(phi) * Math.sin(lam);
    const oz = (n * (1 - e2) + 0.2) * Math.sin(phi);

    // ENU and look angles
    const dx = sx - ox;
    const dy = sy - oy;
    const dz = sz - oz;
    const east = -Math.sin(lam) * dx + Math.cos(lam) * dy;
    const north = -Math.sin(phi) * Math.cos(lam) * dx - Math.sin(phi) * Math.sin(lam) * dy + Math.cos(phi) * dz;
    const up = Math.cos(phi) * Math.cos(lam) * dx + Math.cos(phi) * Math.sin(lam) * dy + Math.sin(phi) * dz;
    const rng = Math.hypot(dx, dy, dz);
    const az = ((Math.atan2(east, north) / DEG) + 360) % 360;
    const el = Math.asin(up / rng) / DEG;

    const rae = sat.rae(site, date)!;

    // Satellite.rae uses the same GMST-only Earth-fixed frame, so agreement is at round-off
    // level (1e-6 km, 1e-6 deg). A full ITRF chain would differ by the equation of the
    // equinoxes (~1 arcsec) plus polar motion (~0.3 arcsec): tens of meters at this range.
    expect(el).toBeGreaterThan(10);
    expect(Math.abs(rae.rng - rng)).toBeLessThan(1e-6);
    expect(Math.abs(rae.az - az)).toBeLessThan(1e-6);
    expect(Math.abs(rae.el - el)).toBeLessThan(1e-6);
  });
});

describe('v8: history records direct eci() calls only (plan section 7)', () => {
  it('rae, toRae, ecef, lla and access sweeps leave the history empty; eci records', () => {
    const sat = Satellite.fromOmm(baseOmm);
    const site = new GroundStation({ lat: 40 as Degrees, lon: -75 as Degrees, alt: 0.1 as Kilometers });
    const date = new Date(Date.UTC(2024, 0, 13, 3, 0, 0));

    sat.enableHistory();
    sat.rae(site, date);
    sat.toRae(site, date);
    sat.ecef(date);
    sat.lla(date);
    AccessCalculator.calculateAccess(site, sat, date, new Date(date.getTime() + 3600000));
    expect(sat.history!.length).toBe(0);

    sat.eci(date);
    expect(sat.history!.length).toBe(1);
  });

  it('a far-future sweep sample does not block a real-time sample (sampling is symmetric)', () => {
    const h = new History<number>({ samplingInterval: 1000 });
    const t = Date.UTC(2024, 0, 1);

    h.add(new Date(t), 1);
    h.add(new Date(t + 500), 2); // within 1 s after: skipped
    h.add(new Date(t - 500), 3); // within 1 s before: skipped
    h.add(new Date(t + 86400000), 4);
    h.add(new Date(t + 2000), 5); // earlier than the last, but 1 day away from it: kept

    expect(h.getAll().map((e) => e.data)).toEqual([1, 4, 5]);
  });

  it('clone() copies nested objects and keeps class prototypes', () => {
    const h = new History<{ v: Vector3D; list: number[] }>();

    h.add(new Date(0), { v: new Vector3D(1, 2, 3), list: [1, 2] });
    const c = h.clone();

    h.getAll()[0].data.list.push(3);
    expect(c.getAll()[0].data.list).toEqual([1, 2]);
    expect(c.getAll()[0].data.v).toBeInstanceOf(Vector3D);
    expect(c.getAll()[0].data.v.magnitude()).toBeCloseTo(Math.sqrt(14), 12);
  });
});

describe('v8: AccessCalculator edge refinement (plan section 7)', () => {
  const site = new GroundStation({ lat: 0 as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers });
  const start = Date.UTC(2024, 0, 1);

  /** Overhead (0,0) while visible(t), otherwise antipodal. */
  const fake = (visible: (ms: number) => boolean): SpaceObject =>
    ({
      ecef: (d: Date) => (visible(d.getTime()) ? { x: 7000, y: 0, z: 0 } : { x: -7000, y: 0, z: 0 }),
    }) as unknown as SpaceObject;

  it('rise and set land on the exact millisecond for arbitrary edges and coarse steps', () => {
    const rise = start + 12345;
    const set = start + 98761;
    const target = fake((ms) => ms >= rise && ms < set);

    for (const step of [7000, 10000, 60000]) {
      const windows = AccessCalculator.calculateAccess(site, target, new Date(start), new Date(start + 300000), {}, step);

      expect(windows.length).toBe(1);
      expect(windows[0].start.getTime()).toBe(rise);
      expect(windows[0].end.getTime()).toBe(set);
      expect(windows[0].duration).toBe(set - rise);
      expect(windows[0].maxElevationTime.getTime()).toBeGreaterThanOrEqual(rise);
      expect(windows[0].maxElevationTime.getTime()).toBeLessThan(set);
    }
  });

  it('a real ISS pass starts and ends at elevation 0 to within the 1 ms resolution', () => {
    const sat = issFromFixture();
    const obs = new GroundStation({ lat: 40 as Degrees, lon: -75 as Degrees, alt: 0.1 as Kilometers });
    const from = new Date(Date.UTC(2026, 2, 12, 20, 0, 0));
    const pass = AccessCalculator.getNextAccess(obs, sat, from, {}, 2)!;

    expect(pass).not.toBeNull();
    // Elevation rate near the horizon is below 0.1 deg/s, so 1 ms moves it < 1e-4 deg
    expect(Math.abs(sat.el(obs, pass.start)!)).toBeLessThan(1e-3);
    expect(Math.abs(sat.el(obs, pass.end)!)).toBeLessThan(1e-3);
    expect(pass.maxElevation).toBeGreaterThan(0);
  });
});

describe('v8: DynamicGroundObject observer and interpolation (report 2.4)', () => {
  const t0 = new Date('2024-01-13T02:00:00Z');
  const t1 = new Date('2024-01-13T03:00:00Z');

  it('a moving observer matches a fixed station at the interpolated position, mid-path', () => {
    const sat = Satellite.fromOmm(baseOmm);
    const mover = new DynamicGroundObject({
      id: 1,
      name: 'Ship',
      interpolationMethod: 'greatCircle',
      waypoints: [
        { time: t0, lat: 10 as Degrees, lon: 20 as Degrees, alt: 0 as Kilometers },
        { time: t1, lat: 12 as Degrees, lon: 25 as Degrees, alt: 0 as Kilometers },
      ],
    });
    const mid = new Date((t0.getTime() + t1.getTime()) / 2);
    const lla = mover.getLLA(mid)!;
    const fixed = new GroundStation({ lat: lla.lat, lon: lla.lon, alt: lla.alt });
    const a = sat.rae(mover, mid)!;
    const b = sat.rae(fixed, mid)!;

    expect(Math.abs(a.rng - b.rng)).toBeLessThan(1e-9);
    expect(Math.abs(a.az - b.az)).toBeLessThan(1e-9);
    // Outside the waypoint range there is no position, so no look angles
    expect(sat.rae(mover, new Date(t1.getTime() + 1000))).toBeNull();
  });

  it('spline on unequally spaced waypoints reproduces data that is linear in time', () => {
    // A natural cubic spline through points on a straight line (in time) is that line. With
    // knots treated as equally spaced (pre-v8) the 10 s and 1000 s gaps distort it.
    const base = t0.getTime();
    const times = [0, 10, 1010, 1100];
    const obj = new DynamicGroundObject({
      id: 2,
      name: 'Rover',
      interpolationMethod: 'spline',
      waypoints: times.map((s) => ({
        time: new Date(base + s * 1000),
        lat: (0.001 * s) as Degrees,
        lon: (0.002 * s) as Degrees,
        alt: 0 as Kilometers,
      })),
    });

    for (const s of [5, 300, 700, 1050]) {
      const lla = obj.getLLA(new Date(base + s * 1000))!;

      expect(lla.lat).toBeCloseTo(0.001 * s, 9);
      expect(lla.lon).toBeCloseTo(0.002 * s, 9);
    }
  });

  it('great-circle interpolation between antipodal waypoints stays finite', () => {
    const obj = new DynamicGroundObject({
      id: 3,
      name: 'Antipodes',
      waypoints: [
        { time: t0, lat: 0 as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers },
        { time: t1, lat: 0 as Degrees, lon: 180 as Degrees, alt: 0 as Kilometers },
      ],
    });
    const lla = obj.getLLA(new Date((t0.getTime() + t1.getTime()) / 2))!;

    expect(Number.isFinite(lla.lat)).toBe(true);
    expect(Number.isFinite(lla.lon)).toBe(true);
  });
});

describe('v8: GroundObject validation and clone (report 2.4)', () => {
  it('accepts negative but finite altitudes; rejects NaN or infinite coordinates', () => {
    expect(() => new GroundStation({ lat: 31.5 as Degrees, lon: 35.5 as Degrees, alt: -0.43 as Kilometers })).not.toThrow();
    expect(() => new GroundStation({ lat: 0 as Degrees, lon: NaN as Degrees, alt: 0 as Kilometers })).toThrow('Invalid longitude');
    expect(() => new GroundStation({ lat: 0 as Degrees, lon: 0 as Degrees, alt: Infinity as Kilometers })).toThrow('Invalid altitude');
  });

  it('GroundStation.clone() re-parents cloned sensors to the copy', () => {
    const station = new GroundStation({ lat: 10 as Degrees, lon: 10 as Degrees, alt: 0 as Kilometers });
    const sensor = new OpticalSensor({
      id: 7,
      name: 'Scope',
      sensorType: SensorType.OPTICAL,
      fieldOfView: { minRange: 100 as Kilometers, maxRange: 40000 as Kilometers, boresightEl: 45 as Degrees, halfAngle: 60 as Degrees },
    });

    sensor.setParent(station);
    station.addSensor(sensor);
    const copy = station.clone();

    expect(copy.sensors[0]).not.toBe(sensor);
    expect((copy.sensors[0] as OpticalSensor).parent).toBe(copy);
    expect(sensor.parent).toBe(station);
  });
});

describe('v8: EphemerisSatellite frames (report 2.4)', () => {
  const base = 1704067200;
  const w = 7.612 / 6878.137;
  const j2000States = Array.from({ length: 12 }, (_, i) => {
    const th = w * i * 60;

    return new J2000(
      new EpochUTC((base + i * 60) as Seconds),
      new Vector3D(6878.137 * Math.cos(th), 6878.137 * Math.sin(th), 100 * Math.sin(th)) as Vector3D<Kilometers>,
      new Vector3D(-7.612 * Math.sin(th), 7.612 * Math.cos(th), 0.1 * Math.cos(th)) as Vector3D<KilometersPerSecond>,
    );
  });
  const at = new EpochUTC((base + 300) as Seconds);

  it('TEME-stored ephemeris returns the same J2000 state as the J2000-stored original', () => {
    const asTeme = j2000States.map((s) => {
      const teme = s.toTEME();

      return new J2000(teme.epoch, teme.position, teme.velocity);
    });
    const ref = new EphemerisSatellite({ id: 1, name: 'J', ephemeris: j2000States });
    const sat = new EphemerisSatellite({ id: 1, name: 'T', ephemeris: asTeme, referenceFrame: 'TEME' });
    const a = ref.getJ2000(at)!;
    const b = sat.getJ2000(at)!;

    // Rotation round trip J2000 -> TEME -> J2000 at each node; interpolation is linear in the data
    expect(b.position.subtract(a.position).magnitude()).toBeLessThan(1e-6);
    expect(sat.getTEME(at)).toBeInstanceOf(TEME);
  });

  it('an ITRF OEM is rotated into J2000 and matches the EME2000 OEM', () => {
    const header = { CCSDS_OEM_VERS: '2.0', CREATION_DATE: '2024-01-01T00:00:00', ORIGINATOR: 'QA' };
    const meta = { OBJECT_NAME: 'T', OBJECT_ID: '2024-001A', CENTER_NAME: 'EARTH', TIME_SYSTEM: 'UTC' };
    const itrfStates = j2000States.map((s) => {
      const itrf = s.toITRF();

      return new J2000(itrf.epoch, itrf.position, itrf.velocity);
    });
    const build = (frame: string, eph: J2000[]): ParsedOem =>
      ({ header, dataBlocks: [{ metadata: { ...meta, REF_FRAME: frame }, ephemeris: eph }] }) as unknown as ParsedOem;
    const eme = EphemerisSatellite.fromParsedOem(build('EME2000', j2000States)).getJ2000(at)!;
    const itrf = EphemerisSatellite.fromParsedOem(build('ITRF2014', itrfStates)).getJ2000(at)!;

    expect(itrf.position.subtract(eme.position).magnitude()).toBeLessThan(1e-6);
    expect(itrf).toBeInstanceOf(J2000);
    expect(new ITRF(itrf.epoch, itrf.position, itrf.velocity)).toBeDefined();
    expect(() => EphemerisSatellite.fromParsedOem(build('TOD', j2000States))).toThrow('REF_FRAME');
  });

  it('clone() keeps the interpolator type and order; the last point interpolates to itself', () => {
    const sat = new EphemerisSatellite({
      id: 1,
      name: 'T',
      ephemeris: j2000States,
      interpolatorType: InterpolatorType.LAGRANGE,
      interpolatorOrder: 4,
    });
    const last = j2000States[j2000States.length - 1];
    const copy = sat.clone();

    expect(copy.toString()).toBe(sat.toString());
    expect(copy.getJ2000(at)!.position.subtract(sat.getJ2000(at)!.position).magnitude()).toBe(0);

    const end = sat.getLinearInterpolatedState(last.epoch)!;
    const lastTeme = last.toTEME();

    expect(end.position.x).toBeCloseTo(lastTeme.position.x, 9);
    expect(sat.getLinearInterpolatedState(new EpochUTC((last.epoch.posix + 1) as Seconds))).toBeNull();
  });

  it('a non-Earth center has no Earth-fixed position', () => {
    const sat = new EphemerisSatellite({ id: 1, name: 'M', ephemeris: j2000States, centerBody: CenterBody.MOON });
    const date = new Date((base + 300) * 1000);

    expect(sat.ecef(date)).toBeNull();
    expect(sat.lla(date)).toBeNull();
    expect(() => sat.toITRF(date)).toThrow();
  });
});

describe('v8: CenterBody (report 2.4)', () => {
  it('maps MARS to the planet, AREOCENTRIC to Mars, and "Mars Barycenter" to the barycenter', () => {
    expect(parseCenterBody('MARS')).toBe(CenterBody.MARS);
    expect(parseCenterBody('areocentric')).toBe(CenterBody.MARS);
    expect(parseCenterBody('Mars Barycenter')).toBe(CenterBody.MARS_BARYCENTER);
  });

  it('Jupiter barycenter GM exceeds the planet GM by the Galilean moons', () => {
    // Planet GM 126686534 (the pre-v8 value) plus Io 5959.916, Europa 3202.739, Ganymede 9887.834
    // and Callisto 7179.289 km^3/s^2 (JPL JUP365 satellite ephemeris) = 126712763.8.
    const galilean = 5959.916 + 3202.739 + 9887.834 + 7179.289;

    expect(Math.abs(CenterBodyMu[CenterBody.JUPITER_BARYCENTER] - (126686534 + galilean))).toBeLessThan(5);
  });
});

describe('v8: Star (report 2.4)', () => {
  it('eci() rotated back to J2000 recovers the catalog RA/Dec', () => {
    const ra = 1.7677943 as Radians;
    const dec = -0.2917512 as Radians;
    const star = new Star({ id: 1, name: 'Sirius', ra, dec });
    const date = new Date('2024-03-01T03:00:00Z');
    const p = star.eci(undefined, date);
    const j2000 = new TEME(
      EpochUTC.fromDateTime(date),
      new Vector3D(p.x, p.y, p.z),
      Vector3D.origin as Vector3D<KilometersPerSecond>,
    ).toJ2000().position;

    expect(Math.atan2(j2000.y, j2000.x)).toBeCloseTo(ra, 9);
    expect(Math.asin(j2000.z / j2000.magnitude())).toBeCloseTo(dec, 9);
  });

  it('the J2000 celestial pole is at an elevation equal to the observer latitude (to precession)', () => {
    // The true pole of 2024 is ~0.13 deg from the J2000 pole (precession ~20 arcsec/yr in dec)
    const pole = new Star({ id: 2, name: 'Pole', ra: 0 as Radians, dec: (Math.PI / 2) as Radians });
    const el = pole.rae({ lat: 40 as Degrees, lon: -75 as Degrees, alt: 0 as Kilometers }, new Date('2024-03-01T03:00:00Z')).el;

    expect(Math.abs(el - 40)).toBeLessThan(0.2);
  });
});

describe('v8: VisualizationHelpers orbit track altitude (report 2.4)', () => {
  it('altitude is geodetic: equals lla().alt and differs from |r| - 6378.137 at high latitude', () => {
    const sat = issFromFixture();
    const start = new Date(Date.UTC(2026, 2, 12, 20, 0, 0));
    const track = VisualizationHelpers.generateOrbitTrack(sat, start, 1, 90);
    let maxDiff = 0;

    for (const pt of track) {
      expect(pt.altitude).toBeCloseTo(sat.lla(pt.time)!.alt, 6);
      maxDiff = Math.max(maxDiff, Math.abs(pt.altitude - (Math.hypot(pt.position.x, pt.position.y, pt.position.z) - 6378.137)));
    }
    // At 51.6 deg the ellipsoid surface is ~13 km below the equatorial radius
    expect(maxDiff).toBeGreaterThan(10);
  });
});
