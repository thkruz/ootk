import fc from 'fast-check';
import { EpochUTC, Geodetic, J2000, Kilometers, KilometersPerSecond, Radians, Vector3D } from '../../main';

/** Property tests (fast-check) for the J2000 / TEME / ITRF / Geodetic frame conversions. */

const dateArb = fc.date({ min: new Date('2000-06-01T00:00:00Z'), max: new Date('2040-01-01T00:00:00Z'), noInvalidDate: true });
const posArb = fc.record({
  x: fc.double({ min: -50_000, max: 50_000, noNaN: true }),
  y: fc.double({ min: -50_000, max: 50_000, noNaN: true }),
  z: fc.double({ min: -50_000, max: 50_000, noNaN: true }),
});
const velArb = fc.record({
  x: fc.double({ min: -10, max: 10, noNaN: true }),
  y: fc.double({ min: -10, max: 10, noNaN: true }),
  z: fc.double({ min: -10, max: 10, noNaN: true }),
});
const geoArb = fc.record({
  lat: fc.double({ min: -1.5, max: 1.5, noNaN: true }),
  lon: fc.double({ min: -3.1, max: 3.1, noNaN: true }),
  alt: fc.double({ min: -5, max: 40_000, noNaN: true }),
});

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

describe('frame conversions (properties)', () => {
  it('J2000 -> ITRF -> J2000 returns position and velocity', () => {
    fc.assert(fc.property(dateArb, posArb, velArb, (date, p, v) => {
      const j2k = new J2000(
        EpochUTC.fromDateTime(date),
        new Vector3D(p.x as Kilometers, p.y as Kilometers, p.z as Kilometers),
        new Vector3D(v.x as KilometersPerSecond, v.y as KilometersPerSecond, v.z as KilometersPerSecond),
      );
      const back = j2k.toITRF().toJ2000();

      expect(near(back.position.x, p.x, 1e-6) && near(back.position.y, p.y, 1e-6) && near(back.position.z, p.z, 1e-6)).toBe(true);
      expect(near(back.velocity.x, v.x, 1e-9) && near(back.velocity.y, v.y, 1e-9) && near(back.velocity.z, v.z, 1e-9)).toBe(true);
    }));
  });

  it('J2000 -> TEME -> J2000 returns the position', () => {
    fc.assert(fc.property(dateArb, posArb, velArb, (date, p, v) => {
      const j2k = new J2000(
        EpochUTC.fromDateTime(date),
        new Vector3D(p.x as Kilometers, p.y as Kilometers, p.z as Kilometers),
        new Vector3D(v.x as KilometersPerSecond, v.y as KilometersPerSecond, v.z as KilometersPerSecond),
      );
      const back = j2k.toTEME().toJ2000();

      expect(near(back.position.x, p.x, 1e-6) && near(back.position.y, p.y, 1e-6) && near(back.position.z, p.z, 1e-6)).toBe(true);
    }));
  });

  it('frame rotations preserve position magnitude', () => {
    fc.assert(fc.property(dateArb, posArb, (date, p) => {
      const j2k = new J2000(EpochUTC.fromDateTime(date), new Vector3D(p.x as Kilometers, p.y as Kilometers, p.z as Kilometers), Vector3D.origin as Vector3D<KilometersPerSecond>);
      const m = j2k.position.magnitude();

      expect(near(j2k.toITRF().position.magnitude(), m, 1e-6)).toBe(true);
      expect(near(j2k.toTEME().position.magnitude(), m, 1e-6)).toBe(true);
    }));
  });

  it('Geodetic -> ITRF -> Geodetic round trips', () => {
    fc.assert(fc.property(dateArb, geoArb, (date, g) => {
      const geo = new Geodetic(g.lat as Radians, g.lon as Radians, g.alt as Kilometers);
      const back = geo.toITRF(EpochUTC.fromDateTime(date)).toGeodetic();

      expect(near(back.lat, g.lat, 1e-9)).toBe(true);
      expect(near(back.lon, g.lon, 1e-9)).toBe(true);
      expect(near(back.alt, g.alt, 1e-6)).toBe(true);
    }));
  });
});
