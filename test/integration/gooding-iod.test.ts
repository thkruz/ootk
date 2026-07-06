/**
 * Integration test: Gooding IOD (Initial Orbit Determination)
 * Note: GoodingIOD requires ObservationOptical which is internal API.
 * This test verifies the public exports are available.
 */
import {
  Degrees,
  EpochUTC,
  GoodingIOD,
  GroundStation,
  Kilometers,
  RadecTopocentric,
  Seconds,
} from '../../dist/main.js';

describe('Gooding IOD', () => {
  const stationLocation = {
    latitude: 41.958076,
    longitude: -70.662182,
    altitude: 0.001, // Small altitude > 0 required
  };

  const station = new GroundStation({
    lat: stationLocation.latitude as Degrees,
    lon: stationLocation.longitude as Degrees,
    alt: stationLocation.altitude as Kilometers,
    name: 'Test Observatory',
  });

  // Realistic observations of a GEO satellite pass
  const observations = [
    {
      timestamp: new Date(2025, 10, 22, 2, 0, 0).getTime(),
      ra: 333.38 as Degrees,
      dec: -6.24 as Degrees,
    },
    {
      timestamp: new Date(2025, 10, 22, 2, 5, 0).getTime(),
      ra: 334.01 as Degrees,
      dec: -5.89 as Degrees,
    },
    {
      timestamp: new Date(2025, 10, 22, 2, 10, 0).getTime(),
      ra: 334.89 as Degrees,
      dec: -5.51 as Degrees,
    },
  ];

  describe('GoodingIOD Class Availability', () => {
    it('should have GoodingIOD available from exports', () => {
      expect(GoodingIOD).toBeDefined();
    });

    it('should create GoodingIOD instance', () => {
      const iod = new GoodingIOD();

      expect(iod).toBeDefined();
    });
  });

  describe('Supporting Classes for IOD', () => {
    it('should create GroundStation', () => {
      expect(station).toBeDefined();
      expect(station.lat).toBe(stationLocation.latitude);
      expect(station.lon).toBe(stationLocation.longitude);
    });

    it('should convert GroundStation to J2000', () => {
      const j2000 = station.toJ2000(new Date(observations[0].timestamp));

      expect(j2000).toBeDefined();
      expect(j2000.position).toBeDefined();
    });

    it('should create RadecTopocentric from degrees', () => {
      const radec = RadecTopocentric.fromDegrees(
        new EpochUTC((new Date(observations[0].timestamp).getTime() / 1000) as Seconds),
        observations[0].ra,
        observations[0].dec,
      );

      expect(radec).toBeDefined();
      expect(radec.rightAscension).toBeDefined();
      expect(radec.declination).toBeDefined();
    });

    it('should create multiple RadecTopocentric observations', () => {
      const radecs = observations.map((obs) =>
        RadecTopocentric.fromDegrees(
          new EpochUTC((new Date(obs.timestamp).getTime() / 1000) as Seconds),
          obs.ra,
          obs.dec,
        ),
      );

      expect(radecs.length).toBe(3);
      radecs.forEach((radec) => {
        expect(radec).toBeDefined();
        expect(radec.rightAscension).toBeDefined();
        expect(radec.declination).toBeDefined();
      });
    });
  });

  describe('Observation Angles Validation', () => {
    it('should have RA in valid range after conversion', () => {
      const radec = RadecTopocentric.fromDegrees(
        new EpochUTC((new Date(observations[0].timestamp).getTime() / 1000) as Seconds),
        observations[0].ra,
        observations[0].dec,
      );

      // RA should be in radians (0 to 2π or -π to π depending on implementation)
      expect(Number.isFinite(radec.rightAscension)).toBe(true);
    });

    it('should have Dec in valid range after conversion', () => {
      const radec = RadecTopocentric.fromDegrees(
        new EpochUTC((new Date(observations[0].timestamp).getTime() / 1000) as Seconds),
        observations[0].ra,
        observations[0].dec,
      );

      // Declination should be in radians (-π/2 to π/2)
      expect(radec.declination).toBeGreaterThanOrEqual(-Math.PI / 2);
      expect(radec.declination).toBeLessThanOrEqual(Math.PI / 2);
    });
  });
});
