import fc from 'fast-check';
import { deg2rad, rad2deg } from '../conversions';
import { calcGmst, ecef2eci, ecef2rae, eci2ecef, eci2lla, eci2rae, lla2ecef, rae2ecef, rae2eci } from '../transforms';
import { Degrees, EcefVec3, Kilometers, LlaVec3, Radians, RaeVec3, TemeVec3 } from '../../types/types';

/** Property tests (fast-check) for the coordinate transforms. Tolerances are absolute km / degrees. */

const gmstArb = fc.double({ min: 0, max: 2 * Math.PI, noNaN: true });
const vecArb = fc.record({
  x: fc.double({ min: -50_000, max: 50_000, noNaN: true }),
  y: fc.double({ min: -50_000, max: 50_000, noNaN: true }),
  z: fc.double({ min: -50_000, max: 50_000, noNaN: true }),
});
const llaArb = fc.record({
  lat: fc.double({ min: -89, max: 89, noNaN: true }) as fc.Arbitrary<Degrees>,
  lon: fc.double({ min: -179.99, max: 179.99, noNaN: true }) as fc.Arbitrary<Degrees>,
  alt: fc.double({ min: -5, max: 40_000, noNaN: true }) as fc.Arbitrary<Kilometers>,
});
const dateArb = fc.date({ min: new Date('2000-01-01T00:00:00Z'), max: new Date('2050-01-01T00:00:00Z'), noInvalidDate: true });

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const norm = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);

describe('coordinate transforms (properties)', () => {
  it('deg2rad and rad2deg are inverses', () => {
    fc.assert(fc.property(fc.double({ min: -720, max: 720, noNaN: true }), (d) => {
      expect(near(rad2deg(deg2rad(d as Degrees)), d, 1e-9)).toBe(true);
    }));
  });

  it('ECI -> ECF -> ECI returns the vector', () => {
    fc.assert(fc.property(vecArb, gmstArb, (v, g) => {
      const back = ecef2eci(eci2ecef(v as TemeVec3, g), g);

      expect(near(back.x, v.x, 1e-7) && near(back.y, v.y, 1e-7) && near(back.z, v.z, 1e-9)).toBe(true);
    }));
  });

  it('ECI <-> ECF rotation preserves magnitude and z', () => {
    fc.assert(fc.property(vecArb, gmstArb, (v, g) => {
      const ecef = eci2ecef(v as TemeVec3, g);

      expect(near(norm(ecef), norm(v), 1e-7)).toBe(true);
      expect(ecef.z).toBe(v.z);
    }));
  });

  it('LLA -> ECF -> ECI -> LLA round trips (geodetic)', () => {
    fc.assert(fc.property(llaArb, gmstArb, (lla, g) => {
      const eci = ecef2eci(lla2ecef(lla), g);
      const back = eci2lla(eci, g);
      let dLon = Math.abs(back.lon - lla.lon);

      dLon = Math.min(dLon, 360 - dLon);
      expect(near(back.lat, lla.lat, 1e-6)).toBe(true);
      expect(dLon).toBeLessThan(1e-6);
      expect(near(back.alt, lla.alt, 1e-5)).toBe(true);
    }));
  });

  it('ECF -> RAE -> ECF round trips for a ground observer', () => {
    fc.assert(fc.property(llaArb, vecArb, (obs, v) => {
      const ecef = v as EcefVec3<Kilometers>;
      const rae = ecef2rae(obs, ecef);
      const back = rae2ecef(rae as RaeVec3<Kilometers, Degrees>, obs);

      // asin() near |el| = 90 deg resolves angles only to ~sqrt(eps) = 1.5e-8 rad, so the lateral error grows with range there.
      const tol = 1e-6 + rae.rng * 3e-8;

      expect(near(back.x, ecef.x, tol) && near(back.y, ecef.y, tol) && near(back.z, ecef.z, tol)).toBe(true);
    }));
  });

  it('RAE range equals the distance between the site and the target in ECF', () => {
    fc.assert(fc.property(llaArb, vecArb, (obs, v) => {
      const site = lla2ecef(obs);
      const rae = ecef2rae(obs, v as EcefVec3<Kilometers>);

      expect(near(rae.rng, Math.hypot(v.x - site.x, v.y - site.y, v.z - site.z), 1e-6)).toBe(true);
      expect(rae.el).toBeGreaterThanOrEqual(-90 - 1e-9);
      expect(rae.el).toBeLessThanOrEqual(90 + 1e-9);
    }));
  });

  it('ECI -> RAE (eci2rae) is consistent with ECI -> ECF -> RAE', () => {
    fc.assert(fc.property(llaArb, vecArb, dateArb, (obs, v, date) => {
      const { gmst } = calcGmst(date);
      const viaEcf = ecef2rae(obs, eci2ecef(v as TemeVec3, gmst));
      const direct = eci2rae(date, v as TemeVec3<Kilometers>, obs);

      expect(near(direct.rng, viaEcf.rng, 1e-6)).toBe(true);
      expect(near(direct.el, viaEcf.el, 1e-6)).toBe(true);
      // azimuth is undefined at the zenith/nadir; compare only away from it
      if (Math.abs(viaEcf.el) < 89.9) {
        const dAz = Math.abs(direct.az - viaEcf.az);

        expect(Math.min(dAz, 360 - dAz)).toBeLessThan(1e-6);
      }
    }));
  });

  it('RAE -> ECI -> RAE round trips at a fixed epoch', () => {
    fc.assert(fc.property(
      llaArb,
      fc.double({ min: 1, max: 40_000, noNaN: true }),
      fc.double({ min: 0, max: 359.999, noNaN: true }),
      fc.double({ min: -89, max: 89, noNaN: true }),
      dateArb,
      (obs, rng, az, el, date) => {
        const { gmst } = calcGmst(date);
        const rae = { rng: rng as Kilometers, az: az as Degrees, el: el as Degrees };
        const eci = rae2eci(rae, obs, gmst);
        const back = eci2rae(date, eci as TemeVec3<Kilometers>, obs);

        expect(near(back.rng, rng, 1e-6)).toBe(true);
        expect(near(back.el, el, 1e-6)).toBe(true);
        const dAz = Math.abs(back.az - az);

        expect(Math.min(dAz, 360 - dAz)).toBeLessThan(1e-6);
      },
    ));
  });
});
