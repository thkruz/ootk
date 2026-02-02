/**
 * Integration test: Observation Formats
 * Migrated from examples/observations.ts
 */
import {
  Degrees,
  EpochUTC,
  GroundStation,
  Kilometers,
  RadecGeocentric,
  RadecTopocentric,
  Radians,
  Satellite,
  TleLine1,
  TleLine2,
} from '../../dist/main.js';
import { ISS_TLE } from './lib/testData';

describe('Observation Formats', () => {
  const observationTime = new Date('2024-01-28T12:00:00.000Z');
  const epoch = EpochUTC.fromDateTime(observationTime);

  const observatory = new GroundStation({
    lat: 34.5 as Degrees,
    lon: -117.9 as Degrees,
    alt: 1.2 as Kilometers,
    name: 'Example Observatory',
  });

  const satellite = new Satellite({
    tle1: ISS_TLE.line1 as TleLine1,
    tle2: ISS_TLE.line2 as TleLine2,
  });

  describe('Topocentric RADEC Observations', () => {
    it('should create topocentric observation from state vector', () => {
      const satState = satellite.toJ2000(observationTime);
      const siteState = observatory.toJ2000(observationTime);
      const topoRadec = RadecTopocentric.fromStateVector(satState, siteState);

      expect(topoRadec).toBeDefined();
      expect(topoRadec.rightAscension).toBeDefined();
      expect(topoRadec.declination).toBeDefined();
      expect(topoRadec.range).toBeDefined();
    });

    it('should have valid right ascension range', () => {
      const satState = satellite.toJ2000(observationTime);
      const siteState = observatory.toJ2000(observationTime);
      const topoRadec = RadecTopocentric.fromStateVector(satState, siteState);

      expect(topoRadec.rightAscension).toBeGreaterThanOrEqual(0);
      expect(topoRadec.rightAscension).toBeLessThan(2 * Math.PI);
    });

    it('should have valid declination range', () => {
      const satState = satellite.toJ2000(observationTime);
      const siteState = observatory.toJ2000(observationTime);
      const topoRadec = RadecTopocentric.fromStateVector(satState, siteState);

      expect(topoRadec.declination).toBeGreaterThanOrEqual(-Math.PI / 2);
      expect(topoRadec.declination).toBeLessThanOrEqual(Math.PI / 2);
    });

    it('should have positive range', () => {
      const satState = satellite.toJ2000(observationTime);
      const siteState = observatory.toJ2000(observationTime);
      const topoRadec = RadecTopocentric.fromStateVector(satState, siteState);

      expect(topoRadec.range).toBeGreaterThan(0);
    });
  });

  describe('Geocentric RADEC Observations', () => {
    it('should create geocentric observation from state vector', () => {
      const satState = satellite.toJ2000(observationTime);
      const geoRadec = RadecGeocentric.fromStateVector(satState);

      expect(geoRadec).toBeDefined();
      expect(geoRadec.rightAscension).toBeDefined();
      expect(geoRadec.declination).toBeDefined();
      expect(geoRadec.range).toBeDefined();
    });

    it('should have valid right ascension range', () => {
      const satState = satellite.toJ2000(observationTime);
      const geoRadec = RadecGeocentric.fromStateVector(satState);

      expect(geoRadec.rightAscension).toBeGreaterThanOrEqual(0);
      expect(geoRadec.rightAscension).toBeLessThan(2 * Math.PI);
    });

    it('should have valid declination range', () => {
      const satState = satellite.toJ2000(observationTime);
      const geoRadec = RadecGeocentric.fromStateVector(satState);

      expect(geoRadec.declination).toBeGreaterThanOrEqual(-Math.PI / 2);
      expect(geoRadec.declination).toBeLessThanOrEqual(Math.PI / 2);
    });
  });

  describe('Comparing Observation Formats', () => {
    it('should have different values for topocentric vs geocentric', () => {
      const satState = satellite.toJ2000(observationTime);
      const siteState = observatory.toJ2000(observationTime);
      const topoRadec = RadecTopocentric.fromStateVector(satState, siteState);
      const geoRadec = RadecGeocentric.fromStateVector(satState);

      // Topocentric and geocentric observations should generally differ
      // due to the observer's offset from Earth's center
      // Range will definitely differ
      expect(topoRadec.range).not.toBeCloseTo(geoRadec.range, 0);
    });

    it('should compare with RAE observations', () => {
      const satState = satellite.toJ2000(observationTime);
      const siteState = observatory.toJ2000(observationTime);
      const topoRadec = RadecTopocentric.fromStateVector(satState, siteState);

      const rae = observatory.rae(satellite, observationTime);

      // Both should have valid range values
      expect(topoRadec.range).toBeGreaterThan(0);
      expect(rae.rng).toBeGreaterThan(0);

      // Ranges should be reasonably similar (within 1% of each other)
      // Some difference is expected due to coordinate frame differences
      const rangeDiffPercent = Math.abs(topoRadec.range - rae.rng) / rae.rng * 100;

      expect(rangeDiffPercent).toBeLessThan(1);
    });
  });

  describe('Creating RADEC from Angles', () => {
    it('should create topocentric observation from angles', () => {
      const manualTopoRadec = new RadecTopocentric(
        epoch,
        1.5 as Radians,
        0.5 as Radians,
        1200 as Kilometers,
      );

      expect(manualTopoRadec).toBeDefined();
      expect(manualTopoRadec.rightAscension).toBe(1.5);
      expect(manualTopoRadec.declination).toBe(0.5);
      expect(manualTopoRadec.range).toBe(1200);
    });

    it('should convert RADEC to position vector', () => {
      const manualTopoRadec = new RadecTopocentric(
        epoch,
        1.5 as Radians,
        0.5 as Radians,
        1200 as Kilometers,
      );

      // Get position relative to the site
      const siteState = observatory.toJ2000(observationTime);
      const positionFromRadec = manualTopoRadec.position(siteState);

      expect(positionFromRadec).toBeDefined();
      expect(positionFromRadec.x).toBeDefined();
      expect(positionFromRadec.y).toBeDefined();
      expect(positionFromRadec.z).toBeDefined();
    });
  });

  describe('Tracking Satellite Motion in RADEC', () => {
    it('should track satellite position over time', () => {
      const positions: {
        ra: number;
        dec: number;
        range: number;
      }[] = [];

      for (let i = 0; i < 6; i++) {
        const trackTime = new Date(observationTime.getTime() + i * 5 * 60 * 1000);
        const trackState = satellite.toJ2000(trackTime);
        const siteState = observatory.toJ2000(trackTime);
        const trackRadec = RadecTopocentric.fromStateVector(trackState, siteState);

        positions.push({
          ra: trackRadec.rightAscension,
          dec: trackRadec.declination,
          range: trackRadec.range,
        });
      }

      expect(positions.length).toBe(6);

      // All positions should be valid
      positions.forEach((pos) => {
        // RA can be in range [-π, π] or [0, 2π] depending on implementation
        expect(Number.isFinite(pos.ra)).toBe(true);
        expect(pos.dec).toBeGreaterThanOrEqual(-Math.PI / 2);
        expect(pos.dec).toBeLessThanOrEqual(Math.PI / 2);
        expect(pos.range).toBeGreaterThan(0);
      });
    });
  });

  describe('Multiple Satellites in Geocentric RADEC', () => {
    const satellites = [
      {
        name: 'ISS',
        sat: new Satellite({
          tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
          tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
        }),
      },
      {
        name: 'Hubble',
        sat: new Satellite({
          tle1: '1 20580U 90037B   24028.50123227  .00000825  00000-0  39644-4 0  9997' as TleLine1,
          tle2: '2 20580  28.4696 273.2640 0002975 297.7865 189.2151 15.09696656316758' as TleLine2,
        }),
      },
    ];

    it('should calculate geocentric RADEC for multiple satellites', () => {
      satellites.forEach((satInfo) => {
        const satJ2000 = satInfo.sat.toJ2000(observationTime);
        const satGeoRadec = RadecGeocentric.fromStateVector(satJ2000);

        expect(satGeoRadec).toBeDefined();
        expect(satGeoRadec.rightAscension).toBeGreaterThanOrEqual(0);
        expect(satGeoRadec.declination).toBeGreaterThanOrEqual(-Math.PI / 2);
      });
    });

    it('should have different positions for different satellites', () => {
      const radec1 = RadecGeocentric.fromStateVector(
        satellites[0].sat.toJ2000(observationTime),
      );
      const radec2 = RadecGeocentric.fromStateVector(
        satellites[1].sat.toJ2000(observationTime),
      );

      // Different satellites should have different positions
      expect(radec1.rightAscension).not.toBeCloseTo(radec2.rightAscension, 1);
    });
  });

  describe('Angular Separation', () => {
    it('should calculate angular separation between satellites', () => {
      const sat1 = new Satellite({
        tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
        tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
      });

      const sat2 = new Satellite({
        tle1: '1 20580U 90037B   24028.50123227  .00000825  00000-0  39644-4 0  9997' as TleLine1,
        tle2: '2 20580  28.4696 273.2640 0002975 297.7865 189.2151 15.09696656316758' as TleLine2,
      });

      const radec1 = RadecGeocentric.fromStateVector(sat1.toJ2000(observationTime));
      const radec2 = RadecGeocentric.fromStateVector(sat2.toJ2000(observationTime));

      const ra1 = radec1.rightAscension;
      const dec1 = radec1.declination;
      const ra2 = radec2.rightAscension;
      const dec2 = radec2.declination;

      // Calculate angular separation using spherical trigonometry
      const angularSep = Math.acos(
        Math.sin(dec1) * Math.sin(dec2) +
        Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2),
      );

      // Angular separation should be a valid angle
      expect(angularSep).toBeGreaterThanOrEqual(0);
      expect(angularSep).toBeLessThanOrEqual(Math.PI);

      // Convert to degrees for readability
      const angularSepDeg = angularSep * (180 / Math.PI);

      expect(angularSepDeg).toBeGreaterThan(0);
    });
  });
});
