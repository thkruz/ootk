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
} from '../../main';

const ASEC = Math.PI / 180 / 3600;
const TAU = 2 * Math.PI;

describe('Earth.nutation against SOFA/ERFA (IAU 1980, iau_NUT80 and iau_EQEQ94)', () => {
  // Reference values from pyerfa 2.0.1.5 (ERFA = SOFA): erfa.nut80, erfa.eqeq94 and erfa.obl80
  // at TT = UTC + 69.184 s. ERFA uses its own arcsecond polynomials for the Delaunay arguments,
  // so agreement to about 1e-4 arcsec is the expected level.
  const cases = [
    {
      iso: '2026-04-04T00:00:00Z',
      dPsi: 2.8278135731035026e-5,
      dEps: 4.343124342526464e-5,
      eqEq: 2.5940183946184438e-5,
      mEps: 0.409033215242905,
    },
    {
      iso: '2024-01-13T01:28:46.817Z',
      dPsi: -2.225609360535491e-5,
      dEps: 3.94947201397512e-5,
      eqEq: -2.041542340424904e-5,
      mEps: 0.4090382606043439,
    },
  ];

  it.each(cases)('$iso matches ERFA to 1e-3 arcsec', ({ iso, dPsi, dEps, eqEq, mEps }) => {
    const n = Earth.nutation(EpochUTC.fromDateTime(new Date(iso)));

    expect(Math.abs(n.dPsi - dPsi) / ASEC).toBeLessThan(1e-3);
    expect(Math.abs(n.dEps - dEps) / ASEC).toBeLessThan(1e-3);
    expect(Math.abs(n.eqEq - eqEq) / ASEC).toBeLessThan(1e-3);
    expect(Math.abs(n.mEps - mEps) / ASEC).toBeLessThan(1e-3);
    expect(n.eps).toBeCloseTo(n.mEps + n.dEps, 15);
  });

  it('gast is in [0, 2pi) and equals GMST + eqEq modulo 2pi over a sweep of epochs', () => {
    const t0 = Date.parse('2026-01-01T00:00:00Z');

    for (let k = 0; k < 500; k++) {
      const epoch = EpochUTC.fromDateTime(new Date(t0 + k * 3_599_917));
      const { gast, eqEq } = Earth.nutation(epoch);
      let diff = (gast - epoch.gmstAngle() - eqEq) % TAU;

      if (diff > Math.PI) {
        diff -= TAU;
      }
      if (diff < -Math.PI) {
        diff += TAU;
      }

      expect(gast).toBeGreaterThanOrEqual(0);
      expect(gast).toBeLessThan(TAU);
      expect(Math.abs(diff)).toBeLessThan(1e-12);
    }
  });
});

describe('Earth drift rate', () => {
  it('is zero at the geostationary radius 42164.17 km (Vallado, Table D-3 / Soop, Handbook of Geostationary Orbits)', () => {
    expect(Math.abs(Earth.smaToDriftDegrees(42164.17))).toBeLessThan(1e-3);
  });

  it('near GEO follows the linearised rate d(lambda)/da = -1.5 n / a, about -0.01284 deg/day per km (Soop, ch. 3)', () => {
    const da = 10;
    const geo = Earth.driftDegreesToSma(0);
    const slope = (Earth.smaToDriftDegrees(geo + da) - Earth.smaToDriftDegrees(geo - da)) / (2 * da);

    expect(slope).toBeCloseTo(-0.01284, 4);
  });

  it('driftDegreesToSma inverts smaToDriftDegrees from LEO to beyond GEO', () => {
    for (const a of [6800, 7000, 26560, 41164, 42164, 43000]) {
      expect(Earth.driftDegreesToSma(Earth.smaToDriftDegrees(a))).toBeCloseTo(a, 6);
    }
  });
});

describe('Sun.lightingRatio on the anti-sun axis', () => {
  const sunPos = new Vector3D(149597870 as Kilometers, 0 as Kilometers, 0 as Kilometers);
  const at = (x: number, y = 0) => Sun.lightingRatio(new Vector3D(-x as Kilometers, y as Kilometers, 0 as Kilometers), sunPos);
  // Geometric umbra length L = R_E d / (R_S - R_E) with R_E = 6378.1363 km, R_S = 695500 km,
  // d = 149597870 km: about 1.3846e6 km (Vallado, Fig. 5-15 geometry).
  const umbraLength = (6378.1363 * 149597870) / (695500 - 6378.1363);

  it('the umbra tip is at about 1.384e6 km', () => {
    expect(umbraLength).toBeGreaterThan(1.38e6);
    expect(umbraLength).toBeLessThan(1.39e6);
  });

  it('is 0 inside the umbra and positive just beyond its tip', () => {
    expect(at(umbraLength - 5000)).toBe(0);
    const beyond = at(umbraLength + 5000);

    expect(beyond).toBeGreaterThan(0);
    expect(beyond).toBeLessThan(0.02);
  });

  it('grows monotonically beyond the tip and never returns NaN off axis', () => {
    let last = 0;

    for (let x = umbraLength + 1000; x < 3e6; x += 50000) {
      const r = at(x);

      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
    for (let y = 0; y <= 40000; y += 500) {
      const r = at(1.5e6, y);

      expect(Number.isNaN(r)).toBe(false);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it('annular value at 1.5e6 km matches the small-angle disk ratio 1 - (R_E (d + x) / (R_S x))^2', () => {
    const x = 1.5e6;
    const smallAngle = 1 - ((6378.1363 * (149597870 + x)) / (695500 * x)) ** 2;

    // asin vs small angle differs by O(theta^2 / 6) relative, theta about 4e-3 rad.
    expect(at(x)).toBeCloseTo(smallAngle, 5);
  });
});

describe('Moon RA/Dec are the direction of Moon.eci()', () => {
  it('unit vector from RA/Dec equals eci() / |eci()| over a day', () => {
    for (let h = 0; h < 24; h += 2) {
      const date = new Date(Date.UTC(2026, 6, 1, h));
      const ra = Moon.getRightAscension(date);
      const dec = Moon.getDeclination(date);
      const u = Moon.eci(date).normalize();

      expect(Math.cos(dec) * Math.cos(ra)).toBeCloseTo(u.x, 9);
      expect(Math.cos(dec) * Math.sin(ra)).toBeCloseTo(u.y, 9);
      expect(Math.sin(dec)).toBeCloseTo(u.z, 9);
    }
  });
});

describe('getRiseSetTimes transit', () => {
  const site = new GroundStation({ lat: 0 as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers });
  // Solar noon at 0N 0E on 2026-03-20 is 12:07:27 UTC (equation of time about -7.4 min; NOAA
  // solar calculator).
  const solarNoon = Date.parse('2026-03-20T12:07:27Z');

  it.each([['2026-03-20T00:00:00Z'], ['2026-03-20T09:00:00Z'], ['2026-03-20T15:00:00Z']])(
    'from %s the Sun transit is 2026-03-20 solar noon',
    (start) => {
      const { transit } = Sun.getRiseSetTimes(site, new Date(start));

      expect(transit).not.toBeNull();
      expect(Math.abs((transit as Date).getTime() - solarNoon)).toBeLessThan(60_000);
    },
  );

  /*
   * Verifier fix M.10: the old check started at 00:00 and compared +/- 10 min, which a transit
   * minutes off (or a midpoint of rise and set) also passed. Start after noon (15:00), use a
   * 40 deg N site where the elevation peak is smooth, and bracket the maximum to +/- 30 s.
   */
  it('from a 15:00 start the elevation at transit is a maximum to within 30 s', () => {
    const midLat = new GroundStation({ lat: 40 as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers });
    const { transit } = Sun.getRiseSetTimes(midLat, new Date('2026-03-20T15:00:00Z'));
    const t = (transit as Date).getTime();
    const el = (ms: number) => Sun.getAzEl(midLat, new Date(ms), false).el;

    // Same solar noon as at 0N 0E (transit depends on longitude only)
    expect(Math.abs(t - solarNoon)).toBeLessThan(60_000);
    expect(el(t)).toBeGreaterThan(el(t - 30_000));
    expect(el(t)).toBeGreaterThan(el(t + 30_000));
    // Peak elevation is 90 - 40 + declination (about -0.04 deg near the equinox)
    expect(el(t)).toBeCloseTo(50, 0);
  });
});

describe('EphemerisBody position-only spline', () => {
  const r = 384400;
  const period = 27.321661 * 86400;
  const t0 = Date.UTC(2026, 0, 1);
  const truth = (ms: number) => {
    const th = (TAU * (ms - t0)) / 1000 / period;

    return [r * Math.cos(th), r * Math.sin(th), 0];
  };
  const build = (stepDays: number, withVelocity: boolean) => {
    const w = TAU / period;
    const data = Array.from({ length: Math.round(20 / stepDays) }, (_, i) => {
      const ms = t0 + i * stepDays * 86400000;
      const [x, y, z] = truth(ms);
      const th = w * (ms - t0) / 1000;

      return {
        date: new Date(ms),
        position: { x, y, z },
        velocity: withVelocity ? { x: -r * w * Math.sin(th), y: r * w * Math.cos(th), z: 0 } : undefined,
      };
    });

    return EphemerisBody.fromData(9100, 'spline', CelestialBodyType.ASTEROID, data, { interpolationType: 'spline' });
  };
  const worstError = (body: EphemerisBody) => {
    let worst = 0;

    for (let d = 5; d < 14; d += 0.25) {
      const ms = t0 + (d + 0.1) * 86400000;
      const p = body.eci(new Date(ms));
      const [x, y, z] = truth(ms);

      worst = Math.max(worst, Math.hypot(p.x - x, p.y - y, p.z - z));
    }

    return worst;
  };

  it('is within 10 km of the Hermite spline that has exact velocities', () => {
    // Hermite error bound with exact tangents: h^4 max|f''''| / 384 = r (w h)^4 / 384, about 3 km
    // for daily samples (de Boor, A Practical Guide to Splines, ch. IV).
    expect(worstError(build(1, true))).toBeLessThan(5);
    expect(worstError(build(1, false))).toBeLessThan(10);
  });

  it('error falls by more than 8x when the sample spacing is halved (convergence of order >= 3)', () => {
    expect(worstError(build(0.5, false))).toBeLessThan(worstError(build(1, false)) / 8);
  });

  it('keeps the caller array order and contents', () => {
    const ephemeris = [3, 1, 2, 0, 4].map((d) => ({
      epoch: EpochUTC.fromDateTime(new Date(t0 + d * 86400000)),
      position: new Vector3D((1000 + d) as Kilometers, 0 as Kilometers, 0 as Kilometers),
    }));
    const copy = [...ephemeris];
    const body = new EphemerisBody({ id: 9101, name: 'order', bodyType: CelestialBodyType.ASTEROID, ephemeris });

    expect(ephemeris).toEqual(copy);
    expect(body.getValidityWindow().start.getTime()).toBe(t0);
  });
});
