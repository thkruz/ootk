import { Degrees, Kilometers, KilometersPerSecond, Seconds, TleLine1, TleLine2 } from '../../types/types';
import { J2000, Vector3D } from '../../main';
import { EpochUTC } from '../../time/EpochUTC';
import { EphemerisSatellite } from '../EphemerisSatellite';
import { GroundStation } from '../GroundStation';
import { Satellite } from '../Satellite';

describe('SpaceObject.rae()', () => {
  // ISS TLE for testing
  const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
  const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

  const testStation = new GroundStation({
    id: 8001,
    name: 'Test Ground Station',
    lat: 38.9 as Degrees,
    lon: -77.0 as Degrees,
    alt: 0.1 as Kilometers,
  });

  // Date close to TLE epoch
  const testDate = new Date('2022-07-22T11:16:14Z');

  describe('Satellite.rae()', () => {
    it('should return valid RAE values for known TLE/observer/date', () => {
      const sat = new Satellite({ tle1, tle2 });
      const rae = sat.rae(testStation, testDate);

      expect(rae).not.toBeNull();
      expect(rae!.rng).toBeGreaterThan(0);
      expect(rae!.az).toBeGreaterThanOrEqual(0);
      expect(rae!.az).toBeLessThan(360);
      expect(rae!.el).toBeGreaterThanOrEqual(-90);
      expect(rae!.el).toBeLessThanOrEqual(90);
    });

    it('should return null when propagation fails', () => {
      const sat = new Satellite({ tle1, tle2 });
      // Far future date should cause propagation failure
      const farFutureDate = new Date('2100-01-01T00:00:00Z');
      const rae = sat.rae(testStation, farFutureDate);

      expect(rae).toBeNull();
    });
  });

  describe('EphemerisSatellite.rae()', () => {
    // Base epoch: Jan 1, 2024 00:00:00 UTC
    const baseEpoch = 1704067200;

    const testEphemeris = [
      new J2000(
        new EpochUTC((baseEpoch + 0) as Seconds),
        new Vector3D(6878.137, 0, 0) as Vector3D<Kilometers>,
        new Vector3D(0, 7.612, 0) as Vector3D<KilometersPerSecond>,
      ),
      new J2000(
        new EpochUTC((baseEpoch + 600) as Seconds),
        new Vector3D(6000, 3000, 1000) as Vector3D<Kilometers>,
        new Vector3D(-2, 6, 1) as Vector3D<KilometersPerSecond>,
      ),
      new J2000(
        new EpochUTC((baseEpoch + 1200) as Seconds),
        new Vector3D(4000, 5000, 2000) as Vector3D<Kilometers>,
        new Vector3D(-4, 4, 2) as Vector3D<KilometersPerSecond>,
      ),
    ];

    it('should return valid RAE values (inherited method works)', () => {
      const sat = new EphemerisSatellite({
        id: 8002,
        name: 'Test Ephemeris Satellite',
        ephemeris: testEphemeris,
      });

      // Use date within ephemeris range
      const date = new Date((baseEpoch + 600) * 1000);
      const rae = sat.rae(testStation, date);

      expect(rae).not.toBeNull();
      expect(rae!.rng).toBeGreaterThan(0);
      expect(rae!.az).toBeGreaterThanOrEqual(0);
      expect(rae!.az).toBeLessThan(360);
      expect(rae!.el).toBeGreaterThanOrEqual(-90);
      expect(rae!.el).toBeLessThanOrEqual(90);
    });

    it('should throw when date is outside ephemeris range', () => {
      const sat = new EphemerisSatellite({
        id: 8003,
        name: 'Test Ephemeris Satellite',
        ephemeris: testEphemeris,
      });

      // Use date outside ephemeris range - EphemerisSatellite throws rather than returns null
      const outsideDate = new Date('2025-01-01T00:00:00Z');

      expect(() => sat.rae(testStation, outsideDate)).toThrow('outside ephemeris coverage');
    });
  });

  describe('az() returns valid degrees', () => {
    it('should return azimuth between 0 and 360 degrees', () => {
      const sat = new Satellite({ tle1, tle2 });
      const az = sat.az(testStation, testDate);

      expect(az).not.toBeNull();
      expect(az).toBeGreaterThanOrEqual(0);
      expect(az).toBeLessThan(360);
    });

    it('should not double-convert from radians (regression test)', () => {
      const sat = new Satellite({ tle1, tle2 });
      const az = sat.az(testStation, testDate);

      // If there was a double RAD2DEG conversion, az would be > 360 for most values
      // e.g., 45° * RAD2DEG = 2578°
      expect(az).not.toBeNull();
      expect(az).toBeLessThan(360);
    });
  });

  describe('el() returns valid degrees', () => {
    it('should return elevation between -90 and 90 degrees', () => {
      const sat = new Satellite({ tle1, tle2 });
      const el = sat.el(testStation, testDate);

      expect(el).not.toBeNull();
      expect(el).toBeGreaterThanOrEqual(-90);
      expect(el).toBeLessThanOrEqual(90);
    });

    it('should not double-convert from radians (regression test)', () => {
      const sat = new Satellite({ tle1, tle2 });
      const el = sat.el(testStation, testDate);

      // If there was a double RAD2DEG conversion, el would be > 90 or < -90
      // e.g., 45° * RAD2DEG = 2578°
      expect(el).not.toBeNull();
      expect(el).toBeGreaterThanOrEqual(-90);
      expect(el).toBeLessThanOrEqual(90);
    });
  });

  describe('rng() returns valid range', () => {
    it('should return positive range in kilometers', () => {
      const sat = new Satellite({ tle1, tle2 });
      const rng = sat.rng(testStation, testDate);

      expect(rng).not.toBeNull();
      expect(rng).toBeGreaterThan(0);
      // ISS is in LEO, so range should be reasonable (< 10000 km from surface)
      expect(rng).toBeLessThan(10000);
    });
  });
});
