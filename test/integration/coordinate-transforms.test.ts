/**
 * Integration test: Coordinate transformations
 */
import {
  ClassicalElements,
  EpochUTC,
  Geodetic,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Radians,
  Satellite,
  Seconds,
  TleLine1,
  TleLine2,
  Vector3D,
} from '../../dist/main.js';
import { ISS_TLE, STARLINK_TLE } from './lib/testData';

describe('Coordinate Transformations', () => {
  let epoch: EpochUTC;

  beforeEach(() => {
    epoch = EpochUTC.fromDateTimeString('2024-06-15T12:00:00Z');
  });

  describe('Classical Elements', () => {
    let elements: ClassicalElements;

    beforeEach(() => {
      elements = new ClassicalElements({
        epoch,
        semimajorAxis: 6943.5 as Kilometers,
        eccentricity: 0.001,
        inclination: (51.6 * Math.PI / 180) as Radians,
        rightAscension: (200 * Math.PI / 180) as Radians,
        argPerigee: (90 * Math.PI / 180) as Radians,
        trueAnomaly: (45 * Math.PI / 180) as Radians,
      });
    });

    it('should store orbital elements correctly', () => {
      expect(elements.semimajorAxis).toBeCloseTo(6943.5, 1);
      expect(elements.eccentricity).toBeCloseTo(0.001, 4);
      expect(elements.inclination).toBeCloseTo(51.6 * Math.PI / 180, 4);
    });

    it('should convert to Equinoctial elements', () => {
      const equinoctial = elements.toEquinoctialElements();

      expect(equinoctial).toBeDefined();
      expect(equinoctial.semimajorAxis).toBeCloseTo(elements.semimajorAxis, 3);
    });

    it('should convert to position/velocity', () => {
      const pv = elements.toPositionVelocity();

      expect(pv.position).toBeDefined();
      expect(pv.velocity).toBeDefined();
      expect(pv.position.x).toBeDefined();
      expect(pv.position.y).toBeDefined();
      expect(pv.position.z).toBeDefined();

      // Magnitude should be close to semi-major axis
      const r = Math.sqrt(pv.position.x ** 2 + pv.position.y ** 2 + pv.position.z ** 2);

      expect(r).toBeGreaterThan(6900);
      expect(r).toBeLessThan(7000);
    });

    it('should calculate orbital parameters', () => {
      expect(elements.meanMotion).toBeGreaterThan(0);
      expect(elements.period).toBeGreaterThan(90); // minutes (~96 for this orbit)
      expect(elements.apogee).toBeGreaterThan(500); // km altitude
      expect(elements.perigee).toBeGreaterThan(500);
    });

    it('should propagate to new epoch', () => {
      const futureEpoch = epoch.roll(3600 as Seconds);
      const propagated = elements.propagate(futureEpoch);

      expect(propagated).toBeDefined();
      // True anomaly should change
      expect(propagated.trueAnomaly).not.toBeCloseTo(elements.trueAnomaly, 2);
    });

    it('should convert to J2000 and back', () => {
      const j2000 = elements.toJ2000();
      const elementsBack = j2000.toClassicalElements();

      expect(elementsBack.semimajorAxis).toBeCloseTo(elements.semimajorAxis, 2);
      expect(elementsBack.eccentricity).toBeCloseTo(elements.eccentricity, 4);
      expect(elementsBack.inclination).toBeCloseTo(elements.inclination, 4);
    });
  });

  describe('Equinoctial Elements', () => {
    it('should create from classical elements', () => {
      const classical = new ClassicalElements({
        epoch,
        semimajorAxis: 7000 as Kilometers,
        eccentricity: 0.01,
        inclination: (45 * Math.PI / 180) as Radians,
        rightAscension: 0 as Radians,
        argPerigee: 0 as Radians,
        trueAnomaly: 0 as Radians,
      });

      const equinoctial = classical.toEquinoctialElements();

      expect(equinoctial).toBeDefined();
      expect(equinoctial.semimajorAxis).toBeCloseTo(7000, 1);
    });

    it('should convert back to classical elements', () => {
      const classical = new ClassicalElements({
        epoch,
        semimajorAxis: 7000 as Kilometers,
        eccentricity: 0.01,
        inclination: (45 * Math.PI / 180) as Radians,
        rightAscension: (30 * Math.PI / 180) as Radians,
        argPerigee: (60 * Math.PI / 180) as Radians,
        trueAnomaly: (90 * Math.PI / 180) as Radians,
      });

      const equinoctial = classical.toEquinoctialElements();
      const classicalBack = equinoctial.toClassicalElements();

      expect(classicalBack.semimajorAxis).toBeCloseTo(classical.semimajorAxis, 2);
      expect(classicalBack.eccentricity).toBeCloseTo(classical.eccentricity, 4);
    });
  });

  describe('J2000 Frame Transformations', () => {
    let j2000: J2000;

    beforeEach(() => {
      j2000 = new J2000(
        epoch,
        new Vector3D(6000 as Kilometers, 2000 as Kilometers, 3000 as Kilometers),
        new Vector3D(-1 as KilometersPerSecond, 6 as KilometersPerSecond, 3 as KilometersPerSecond)
      );
    });

    it('should store position and velocity', () => {
      expect(j2000.position.x).toBe(6000);
      expect(j2000.position.y).toBe(2000);
      expect(j2000.position.z).toBe(3000);
      expect(j2000.velocity.x).toBe(-1);
    });

    it('should convert to ITRF', () => {
      const itrf = j2000.toITRF();

      expect(itrf).toBeDefined();
      // Magnitude should be preserved
      expect(itrf.position.magnitude()).toBeCloseTo(j2000.position.magnitude(), 1);
    });

    it('should convert to Geodetic via ITRF', () => {
      const geodetic = j2000.toITRF().toGeodetic();

      expect(geodetic).toBeDefined();
      expect(geodetic.lat).toBeGreaterThanOrEqual(-Math.PI / 2);
      expect(geodetic.lat).toBeLessThanOrEqual(Math.PI / 2);
      expect(geodetic.lon).toBeGreaterThanOrEqual(-Math.PI);
      expect(geodetic.lon).toBeLessThanOrEqual(Math.PI);
    });

    it('should convert to Classical Elements', () => {
      const elements = j2000.toClassicalElements();

      expect(elements).toBeDefined();
      // Semi-major axis depends on the specific state vector energy
      expect(elements.semimajorAxis).toBeGreaterThan(0);
    });

    it('should round-trip ITRF -> J2000', () => {
      const itrf = j2000.toITRF();
      const j2000Back = itrf.toJ2000();

      expect(j2000Back.position.x).toBeCloseTo(j2000.position.x, 3);
      expect(j2000Back.position.y).toBeCloseTo(j2000.position.y, 3);
      expect(j2000Back.position.z).toBeCloseTo(j2000.position.z, 3);
    });
  });

  describe('RIC (Radial-Intrack-Crosstrack)', () => {
    it('should calculate RIC between two satellites', () => {
      const sat1 = Satellite.fromTLE(
        ISS_TLE.line1 as TleLine1,
        ISS_TLE.line2 as TleLine2
      );
      const sat2 = Satellite.fromTLE(
        STARLINK_TLE.line1 as TleLine1,
        STARLINK_TLE.line2 as TleLine2
      );

      const ric = sat1.toRIC(sat2);

      expect(ric).toBeDefined();
      expect(ric.position).toBeDefined();
      // Different satellites should have non-zero relative position
      expect(ric.range).toBeGreaterThan(0);
    });

    it('should have zero RIC for same satellite', () => {
      const sat1 = Satellite.fromTLE(
        ISS_TLE.line1 as TleLine1,
        ISS_TLE.line2 as TleLine2
      );
      const sat2 = Satellite.fromTLE(
        ISS_TLE.line1 as TleLine1,
        ISS_TLE.line2 as TleLine2
      );

      const ric = sat1.toRIC(sat2);

      expect(ric.position.x).toBeCloseTo(0, 3);
      expect(ric.position.y).toBeCloseTo(0, 3);
      expect(ric.position.z).toBeCloseTo(0, 3);
    });
  });

  describe('Geodetic Coordinates', () => {
    it('should create from latitude, longitude, altitude', () => {
      const geodetic = new Geodetic(
        (45 * Math.PI / 180) as Radians, // 45 deg N
        (-75 * Math.PI / 180) as Radians, // 75 deg W
        0.1 as Kilometers // 100m altitude
      );

      expect(geodetic).toBeDefined();
      expect(geodetic.lat).toBeCloseTo(45 * Math.PI / 180, 5);
      expect(geodetic.lon).toBeCloseTo(-75 * Math.PI / 180, 5);
      expect(geodetic.alt).toBeCloseTo(0.1, 5);
    });

    it('should convert to ITRF', () => {
      const geodetic = new Geodetic(
        (45 * Math.PI / 180) as Radians,
        (-75 * Math.PI / 180) as Radians,
        0.1 as Kilometers
      );

      const itrf = geodetic.toITRF(epoch);

      expect(itrf).toBeDefined();
      // Position magnitude should be near Earth radius
      expect(itrf.position.magnitude()).toBeCloseTo(6371, -1);
    });

    it('should round-trip ITRF -> Geodetic', () => {
      const geodetic = new Geodetic(
        (30 * Math.PI / 180) as Radians,
        (120 * Math.PI / 180) as Radians,
        0.5 as Kilometers
      );

      const itrf = geodetic.toITRF(epoch);
      const geodeticBack = itrf.toGeodetic();

      expect(geodeticBack.lat).toBeCloseTo(geodetic.lat, 4);
      expect(geodeticBack.lon).toBeCloseTo(geodetic.lon, 4);
      expect(geodeticBack.alt).toBeCloseTo(geodetic.alt, 2);
    });
  });
});
