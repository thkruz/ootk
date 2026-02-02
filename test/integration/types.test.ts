/**
 * Integration test: TypeScript type verification
 * This test ensures that TypeScript types are correctly exported
 * and can be used for type checking.
 */
import {
  Days,
  DEG2RAD,
  Degrees,
  EpochUTC,
  GroundStation,
  Kilometers,
  KilometersPerSecond,
  Minutes,
  RAD2DEG,
  Radians,
  Satellite,
  Seconds,
  Tle,
  TleLine1,
  TleLine2,
  Vector3D,
} from '../../dist/main.js';

describe('TypeScript Type Exports', () => {
  describe('Unit Types', () => {
    it('should allow Degrees type casting', () => {
      const deg: Degrees = 45.0 as Degrees;

      expect(typeof deg).toBe('number');
      expect(deg).toBe(45.0);
    });

    it('should allow Radians type casting', () => {
      const rad: Radians = (Math.PI / 4) as Radians;

      expect(typeof rad).toBe('number');
      expect(rad).toBeCloseTo(Math.PI / 4, 10);
    });

    it('should allow Kilometers type casting', () => {
      const km: Kilometers = 6371 as Kilometers;

      expect(typeof km).toBe('number');
      expect(km).toBe(6371);
    });

    it('should allow KilometersPerSecond type casting', () => {
      const kps: KilometersPerSecond = 7.8 as KilometersPerSecond;

      expect(typeof kps).toBe('number');
      expect(kps).toBe(7.8);
    });

    it('should allow Seconds type casting', () => {
      const sec: Seconds = 86400 as Seconds;

      expect(typeof sec).toBe('number');
      expect(sec).toBe(86400);
    });

    it('should allow Minutes type casting', () => {
      const min: Minutes = 92 as Minutes;

      expect(typeof min).toBe('number');
      expect(min).toBe(92);
    });

    it('should allow Days type casting', () => {
      const days: Days = 365 as Days;

      expect(typeof days).toBe('number');
      expect(days).toBe(365);
    });
  });

  describe('TLE Line Types', () => {
    it('should allow TleLine1 type casting', () => {
      const line1: TleLine1 = '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002' as TleLine1;

      expect(typeof line1).toBe('string');
      expect(line1.startsWith('1')).toBe(true);
    });

    it('should allow TleLine2 type casting', () => {
      const line2: TleLine2 = '2 25544  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550100010' as TleLine2;

      expect(typeof line2).toBe('string');
      expect(line2.startsWith('2')).toBe(true);
    });
  });

  describe('Class Type Inference', () => {
    it('should correctly infer Satellite type', () => {
      const sat = Satellite.fromTLE(
        '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002' as TleLine1,
        '2 25544  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550100010' as TleLine2
      );

      // TypeScript should correctly type these as Degrees
      const inc: Degrees = sat.inclination;
      const raan: Degrees = sat.rightAscension;

      expect(inc).toBeDefined();
      expect(raan).toBeDefined();
      expect(typeof inc).toBe('number');
    });

    it('should correctly infer Vector3D generic types', () => {
      const vec: Vector3D<Kilometers> = new Vector3D(
        1000 as Kilometers,
        2000 as Kilometers,
        3000 as Kilometers
      );

      expect(vec.x).toBe(1000);
      expect(vec.y).toBe(2000);
      expect(vec.z).toBe(3000);
    });

    it('should correctly infer EpochUTC type', () => {
      const epoch: EpochUTC = EpochUTC.now();
      const posix = epoch.posix;

      expect(typeof posix).toBe('number');
      expect(posix).toBeGreaterThan(0);
    });

    it('should correctly type Tle class', () => {
      const tle = new Tle(
        '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002' as TleLine1,
        '2 25544  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550100010' as TleLine2
      );

      expect(tle.line1).toBeDefined();
      expect(tle.line2).toBeDefined();
      expect(tle.epoch).toBeDefined();
    });

    it('should correctly type GroundStation', () => {
      const ground = new GroundStation({
        lat: 45 as Degrees,
        lon: -75 as Degrees,
        alt: 0.1 as Kilometers,
        name: 'Test Station',
      });

      expect(ground.name).toBe('Test Station');
    });
  });

  describe('Constants Type Checking', () => {
    it('should have correct DEG2RAD value', () => {
      expect(DEG2RAD).toBeCloseTo(Math.PI / 180, 10);
    });

    it('should have correct RAD2DEG value', () => {
      expect(RAD2DEG).toBeCloseTo(180 / Math.PI, 10);
    });

    it('should allow unit conversion using constants', () => {
      const degrees = 90;
      const radians = (degrees * DEG2RAD) as Radians;

      expect(radians).toBeCloseTo(Math.PI / 2, 10);
    });
  });

  describe('Generic Type Usage', () => {
    it('should work with Vector3D generics', () => {
      const posKm: Vector3D<Kilometers> = new Vector3D(
        100 as Kilometers,
        200 as Kilometers,
        300 as Kilometers
      );
      const velKps: Vector3D<KilometersPerSecond> = new Vector3D(
        1 as KilometersPerSecond,
        2 as KilometersPerSecond,
        3 as KilometersPerSecond
      );

      expect(posKm.magnitude()).toBeCloseTo(374.166, 2);
      expect(velKps.magnitude()).toBeCloseTo(3.742, 2);
    });
  });
});
