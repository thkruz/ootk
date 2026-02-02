/**
 * Integration test: Complete satellite tracking workflow
 * Tests the typical user workflow of creating a satellite,
 * propagating its position, and calculating observation data.
 */
import {
  Degrees,
  GroundStation,
  Kilometers,
  Satellite,
  Tle,
  TleLine1,
  TleLine2,
} from '../../dist/main.js';
import { ISS_TLE, KENNEDY_SPACE_CENTER } from './lib/testData';

describe('Satellite Tracking Workflow', () => {
  let satellite: Satellite;

  beforeEach(() => {
    satellite = Satellite.fromTLE(
      ISS_TLE.line1 as TleLine1,
      ISS_TLE.line2 as TleLine2,
      ISS_TLE.name
    );
  });

  describe('Satellite Creation', () => {
    it('should create a Satellite from TLE lines', () => {
      expect(satellite).toBeDefined();
      expect(satellite.name).toBe(ISS_TLE.name);
    });

    it('should parse orbital elements from TLE', () => {
      expect(satellite.inclination).toBeCloseTo(51.64, 1);
      expect(satellite.eccentricity).toBeLessThan(0.01);
      expect(satellite.period).toBeGreaterThan(90); // ~92 minutes for ISS
      expect(satellite.period).toBeLessThan(95);
    });

    it('should create from Tle object', () => {
      const tle = new Tle(ISS_TLE.line1 as TleLine1, ISS_TLE.line2 as TleLine2);
      const sat = Satellite.fromTle(tle, 'ISS');

      expect(sat.inclination).toBe(satellite.inclination);
    });

    it('should have correct semi-major axis for LEO', () => {
      // ISS orbits at ~420km altitude, Earth radius ~6371km
      // So semi-major axis should be ~6791km
      expect(satellite.semiMajorAxis).toBeGreaterThan(6700);
      expect(satellite.semiMajorAxis).toBeLessThan(6900);
    });
  });

  describe('Position Propagation', () => {
    it('should propagate to current time and return ECI position', () => {
      const pv = satellite.eci();

      expect(pv).not.toBeNull();
      expect(pv!.position).toBeDefined();
      expect(pv!.velocity).toBeDefined();
      expect(pv!.position.x).toBeDefined();
      expect(pv!.position.y).toBeDefined();
      expect(pv!.position.z).toBeDefined();
    });

    it('should propagate to specific date', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      const pv = satellite.eci(date);

      expect(pv).not.toBeNull();
      // Position should be within reasonable range for LEO
      const r = Math.sqrt(
        pv!.position.x ** 2 +
        pv!.position.y ** 2 +
        pv!.position.z ** 2
      );

      expect(r).toBeGreaterThan(6400); // Above Earth surface
      expect(r).toBeLessThan(7000); // ISS altitude ~420km
    });

    it('should calculate LLA position', () => {
      const lla = satellite.lla();

      expect(lla).not.toBeNull();
      expect(lla!.lat).toBeGreaterThanOrEqual(-90);
      expect(lla!.lat).toBeLessThanOrEqual(90);
      expect(lla!.lon).toBeGreaterThanOrEqual(-180);
      expect(lla!.lon).toBeLessThanOrEqual(180);
      expect(lla!.alt).toBeGreaterThan(350); // ISS altitude in km
      expect(lla!.alt).toBeLessThan(500);
    });

    it('should convert to J2000 frame', () => {
      const j2000 = satellite.toJ2000();

      expect(j2000).toBeDefined();
      expect(j2000.position).toBeDefined();
      expect(j2000.velocity).toBeDefined();
    });

    it('should convert to classical elements', () => {
      const elements = satellite.toClassicalElements();

      expect(elements).toBeDefined();
      expect(elements.semimajorAxis).toBeGreaterThan(6700);
      expect(elements.eccentricity).toBeLessThan(0.01);
    });
  });

  describe('Ground Station Observation', () => {
    let groundStation: GroundStation;

    beforeEach(() => {
      groundStation = new GroundStation({
        lat: KENNEDY_SPACE_CENTER.lat as Degrees,
        lon: KENNEDY_SPACE_CENTER.lon as Degrees,
        alt: KENNEDY_SPACE_CENTER.alt as Kilometers,
        name: KENNEDY_SPACE_CENTER.name,
      });
    });

    it('should calculate RAE (Range, Azimuth, Elevation)', () => {
      const rae = satellite.rae(groundStation);

      expect(rae).not.toBeNull();
      expect(rae!.rng).toBeGreaterThan(0);
      expect(rae!.az).toBeGreaterThanOrEqual(0);
      expect(rae!.az).toBeLessThanOrEqual(360);
      expect(rae!.el).toBeGreaterThanOrEqual(-90);
      expect(rae!.el).toBeLessThanOrEqual(90);
    });

    it('should calculate range to ground station', () => {
      const rng = satellite.rng(groundStation);

      expect(rng).not.toBeNull();
      expect(rng).toBeGreaterThan(0);
      // Range varies based on satellite position relative to ground station
      // For LEO, max range when satellite is on opposite side of Earth is ~13,000 km
      expect(rng).toBeLessThan(15000);
    });

    it('should calculate doppler factor', () => {
      const doppler = satellite.dopplerFactor(groundStation);

      expect(doppler).toBeDefined();
      // Doppler factor should be close to 1 (slight shift)
      expect(doppler).toBeGreaterThan(0.99);
      expect(doppler).toBeLessThan(1.01);
    });
  });

  describe('Inter-Satellite Operations', () => {
    it('should calculate RIC relative position', () => {
      const sat2 = Satellite.fromTLE(
        ISS_TLE.line1 as TleLine1,
        ISS_TLE.line2 as TleLine2,
        'ISS Copy'
      );

      const ric = satellite.toRIC(sat2);

      expect(ric).toBeDefined();
      expect(ric.position).toBeDefined();
      // Same satellite should have zero relative position
      expect(ric.position.x).toBeCloseTo(0, 3);
      expect(ric.position.y).toBeCloseTo(0, 3);
      expect(ric.position.z).toBeCloseTo(0, 3);
    });

    it('should calculate range via RIC', () => {
      const sat2 = Satellite.fromTLE(
        ISS_TLE.line1 as TleLine1,
        ISS_TLE.line2 as TleLine2,
        'ISS Copy'
      );

      const ric = satellite.toRIC(sat2);

      // Same satellite should have zero range
      expect(ric.range).toBeCloseTo(0, 3);
    });
  });

  describe('Sun Status', () => {
    it('should determine sun illumination status', () => {
      const status = satellite.getSunStatus();

      // Status is a numeric enum value (0, 1, 2, or 3)
      expect(typeof status).toBe('number');
      expect(status).toBeGreaterThanOrEqual(0);
      expect(status).toBeLessThanOrEqual(3);
    });
  });

  describe('Clone and Copy', () => {
    it('should clone satellite correctly', () => {
      const clone = satellite.clone();

      expect(clone).toBeDefined();
      expect(clone.name).toBe(satellite.name);
      expect(clone.inclination).toBe(satellite.inclination);
      expect(clone.tle1).toBe(satellite.tle1);
      expect(clone.tle2).toBe(satellite.tle2);
    });
  });
});
