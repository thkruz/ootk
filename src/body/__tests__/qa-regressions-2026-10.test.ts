/**
 * Permanent regression tests for the v8 fixes from the 2026-10-13 deep-dive audit, section 2.1
 * (body). Report: hq/reports/ootk-qa-deep-dive-2026-10-13.md
 *
 * Moved from test/qa/time-transforms-body.qa.test.ts. The IAU-1980 table-size check
 * (src/data/values/iau1980.ts) stays here next to the Earth.nutation test it supports.
 */
import { Body, EquatorFromVector, GeoVector, HourAngle, MakeTime, Observer } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import {
  CelestialBodyType,
  Degrees,
  Earth,
  EphemerisBody,
  EpochUTC,
  GroundStation,
  Kilometers,
  Moon,
  Sun,
  Vector3D,
} from '@src/main';
import { iau1980 } from '@src/data/values/iau1980';

const DEG = Math.PI / 180;
const ASEC = DEG / 3600;
const TAU = 2 * Math.PI;

describe('Earth (QA 2026-10 regressions)', () => {
  // Report 2.1. src/body/Earth.ts:146-150 smaToDrift returns (1 - T/Tsid) * 2pi, a per-revolution value.
  // Expected eastward drift for a = 41164 km: (n - wE) * 86400 s = 13.24 deg/day. Actual: 12.73.
  it('Earth.smaToDriftDegrees(41164) is about 13.24 deg/day (a per-day drift rate)', () => {
    expect(Earth.smaToDriftDegrees(41164)).toBeCloseTo(13.24, 1);
  });

  // Report 2.1. same formula. Expected for a = 7000 km: (n - wE) * 86400 s = about 4975 deg/day.
  // Actual: 335.6.
  it('Earth.smaToDriftDegrees(7000) is about 4975 deg/day', () => {
    const drift = Earth.smaToDriftDegrees(7000);

    expect(Math.abs(drift - 4975)).toBeLessThan(5);
  });

  // Report 2.1. src/data/values/iau1980.ts holds only 4 of the 106 IAU-1980 nutation terms.
  // Expected: at least the 10 largest Delta-psi terms. Actual: 4 rows.
  it('IAU-1980 nutation table has at least the 10 largest terms', () => {
    expect(iau1980.length).toBeGreaterThanOrEqual(10);
  });

  // Report 2.1. src/body/Earth.ts:105-128 Earth.nutation loops i < 4.
  // Reference: Delta-psi from the 13 largest IAU-1980 terms (Seidelmann 1982 / Explanatory Supplement
  // table 3.222.1, amplitudes in 0.0001 arcsec), using the same Delaunay arguments as Earth.ts. The
  // remaining 93 terms are each under 0.007 arcsec, so the 13-term sum is within a few hundredths of
  // an arcsec of the full series. Expected: |ootk - ref| < 0.05 arcsec. Actual: 0.078 arcsec on this date.
  it('Earth.nutation Delta-psi on 2026-04-04 matches the IAU-1980 series within 0.05 arcsec', () => {
    const epoch = EpochUTC.fromDateTime(new Date('2026-04-04T00:00:00Z'));
    const t = epoch.toTT().toJulianCenturies();
    const poly = (c: number[]) => ((c[0] * t + c[1]) * t + c[2]) * t + c[3];
    const l = poly([1.4343e-5, 0.0088553, 1325.0 * 360.0 + 198.8675605, 134.96340251]) * DEG;
    const lp = poly([3.8e-8, -0.0001537, 99.0 * 360.0 + 359.0502911, 357.52910918]) * DEG;
    const F = poly([-2.88e-7, -0.003542, 1342.0 * 360.0 + 82.0174577, 93.27209062]) * DEG;
    const D = poly([1.831e-6, -0.0017696, 1236.0 * 360.0 + 307.1114469, 297.85019547]) * DEG;
    const om = poly([2.139e-6, 0.0020756, -(5.0 * 360.0 + 134.1361851), 125.04455501]) * DEG;
    // [l, l', F, D, Om, A, B] with Delta-psi = (A + B t) sin(arg) * 1e-4 arcsec
    const terms: number[][] = [
      [0, 0, 0, 0, 1, -171996, -174.2],
      [0, 0, 2, -2, 2, -13187, -1.6],
      [0, 0, 2, 0, 2, -2274, -0.2],
      [0, 0, 0, 0, 2, 2062, 0.2],
      [0, 1, 0, 0, 0, 1426, -3.4],
      [1, 0, 0, 0, 0, 712, 0.1],
      [0, 1, 2, -2, 2, -517, 1.2],
      [0, 0, 2, 0, 1, -386, -0.4],
      [1, 0, 2, 0, 2, -301, 0],
      [0, -1, 2, -2, 2, 217, -0.5],
      [1, 0, 0, -2, 0, -158, 0],
      [0, 0, 2, -2, 1, 129, 0.1],
      [-1, 0, 2, 0, 2, 123, 0],
    ];
    let refAsec = 0;

    for (const [a1, a2, a3, a4, a5, A, B] of terms) {
      const arg = a1 * l + a2 * lp + a3 * F + a4 * D + a5 * om;

      refAsec += (A + B * t) * 1e-4 * Math.sin(arg);
    }
    const ootkAsec = Earth.nutation(epoch).dPsi / ASEC;

    expect(Math.abs(ootkAsec - refAsec)).toBeLessThan(0.05);
  });

  // Report 2.1. src/body/Earth.ts:128 gast = gmstAngle() + eqEq is not wrapped to [0, 2pi).
  // Find an epoch where GMST is within |eqEq| of the 0 / 2pi wrap, on the side eqEq pushes across.
  // Expected: gast in [0, 2pi). Actual: slightly above 2pi or slightly negative.
  it('Earth.nutation gast is wrapped to [0, 2pi) when GMST is within |eqEq| of the wrap', () => {
    const omega = 7.2921158553e-5;
    let epoch = EpochUTC.fromDateTime(new Date('2026-04-04T00:00:00Z'));

    // Step to GMST = 0 (mod 2pi).
    for (let k = 0; k < 4; k++) {
      let g = epoch.gmstAngle();

      if (g > Math.PI) {
        g -= TAU;
      }
      epoch = epoch.roll((-g / omega) as never);
    }
    const eqEq = Earth.nutation(epoch).eqEq;

    // Move half of |eqEq| to the side of zero that eqEq pushes across.
    epoch = epoch.roll((((eqEq > 0 ? -0.5 : 0.5) * Math.abs(eqEq)) / omega) as never);
    const { gast } = Earth.nutation(epoch);

    expect(gast).toBeGreaterThanOrEqual(0);
    expect(gast).toBeLessThan(TAU);
  });
});

describe('Celestial bodies (QA 2026-10 regressions)', () => {
  // Report 2.1. src/body/CelestialBody.ts:120-153 getRightAscension/getDeclination use
  // new Observer(0, 0, 0), a surface point, so the result is topocentric.
  // Expected: geocentric J2000 RA/Dec (GeoVector + EquatorFromVector). Actual: Moon off by up to 0.95 deg.
  it('Moon.getRightAscension / getDeclination are geocentric', () => {
    let worst = 0;

    for (let h = 0; h < 24; h += 3) {
      const date = new Date(Date.UTC(2026, 3, 4, h));
      const geo = EquatorFromVector(GeoVector(Body.Moon, MakeTime(date), true));
      const dRa = Math.abs(Moon.getRightAscension(date) / DEG - geo.ra * 15);
      const dDec = Math.abs(Moon.getDeclination(date) / DEG - geo.dec);

      worst = Math.max(worst, Math.min(dRa, 360 - dRa), dDec);
    }

    expect(worst).toBeLessThan(0.01);
  });

  // Report 2.1. src/body/SunBody.ts:301-324 lightingRatio has no annular branch. Beyond the umbra tip
  // (about 1.38e6 km), e.g. Sun-Earth L2 at 1.5e6 km anti-sun, acos gets an argument > 1.
  // Expected: annular ratio 1 - aCent^2 / aSun^2, about 0.15. Actual: NaN.
  it('Sun.lightingRatio at Sun-Earth L2 directly behind Earth is the annular value, not NaN', () => {
    const sunPos = new Vector3D(149597870 as Kilometers, 0 as Kilometers, 0 as Kilometers);
    const satPos = new Vector3D(-1500000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
    const [, aCent, aSun] = Sun.eclipseAngles(satPos, sunPos);
    const ratio = Sun.lightingRatio(satPos, sunPos);

    expect(ratio).toBeCloseTo(1 - (aCent * aCent) / (aSun * aSun), 3);
  });

  // Report 2.1. src/body/CelestialBody.ts:240-249 when set precedes rise the transit is the search
  // start time. Sun from 0N 0E starting 2026-03-20T10:00Z (Sun up, hour angle about -32 deg).
  // Expected: transit at hour angle 0 (within 0.5 deg). Actual: the start time, |HA| about 32 deg.
  it('getRiseSetTimes transit is a real culmination when the body is already up', () => {
    const site = new GroundStation({ lat: 0 as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers });
    const { transit } = Sun.getRiseSetTimes(site, new Date('2026-03-20T10:00:00Z'));

    expect(transit).not.toBeNull();
    let ha = HourAngle(Body.Sun, MakeTime(transit as Date), new Observer(0, 0, 0)) * 15;

    if (ha > 180) {
      ha -= 360;
    }
    expect(Math.abs(ha)).toBeLessThan(0.5);
  });

  // Report 2.1. src/body/EphemerisBody.ts:122-123 sorts params.ephemeris in place.
  // Expected: the caller's array keeps its order. Actual: it is reordered.
  it('EphemerisBody does not reorder the caller ephemeris array', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const pt = (dayOffset: number) => ({
      epoch: EpochUTC.fromDateTime(new Date(t0 + dayOffset * 86400000)),
      position: new Vector3D((400000 + dayOffset) as Kilometers, 0 as Kilometers, 0 as Kilometers),
    });
    const ephemeris = [2, 0, 1, 3, 4, 5, 6, 7, 8, 9].map(pt);
    const before = ephemeris.map((e) => e.epoch.posix);

    new EphemerisBody({ id: 9001, name: 'QA', bodyType: CelestialBodyType.ASTEROID, ephemeris });

    expect(ephemeris.map((e) => e.epoch.posix)).toEqual(before);
  });

  // Report 2.1. src/body/EphemerisBody.ts:319-333 'spline' is a Hermite spline that uses velocity as
  // tangents; position-only data gets zero tangents. Circular geocentric orbit r = 384400 km,
  // period 27.32 d, sampled daily without velocities, queried at quarter days.
  // Expected: interpolation error well under 1000 km (Lagrange on the same data is sub-km).
  // Actual: thousands of km.
  it('EphemerisBody spline interpolation of position-only daily data stays within 1000 km', () => {
    const r = 384400;
    const period = 27.321661 * 86400;
    const t0 = Date.UTC(2026, 0, 1);
    const truth = (ms: number) => {
      const th = (TAU * (ms - t0)) / 1000 / period;

      return [r * Math.cos(th), r * Math.sin(th), 0];
    };
    const data = Array.from({ length: 20 }, (_, i) => {
      const ms = t0 + i * 86400000;
      const [x, y, z] = truth(ms);

      return { date: new Date(ms), position: { x, y, z } };
    });
    const body = EphemerisBody.fromData(9002, 'QA spline', CelestialBodyType.ASTEROID, data, {
      interpolationType: 'spline',
    });
    let worst = 0;

    for (let d = 5; d < 14; d++) {
      const ms = t0 + (d + 0.25) * 86400000;
      const p = body.eci(new Date(ms));
      const [x, y, z] = truth(ms);

      worst = Math.max(worst, Math.hypot(p.x - x, p.y - y, p.z - z));
    }

    expect(worst).toBeLessThan(1000);
  });
});
