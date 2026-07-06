/**
 * Integration test: Orbital Elements and Conversions
 * Migrated from examples/orbital-elements.ts
 */
import {
  ClassicalElements,
  Degrees,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Radians,
  Satellite,
  Tle,
  TleLine1,
  TleLine2,
  Vector3D,
} from '../../dist/main.js';
import { ISS_TLE } from './lib/testData';

describe('Orbital Elements and Conversions', () => {
  const date = new Date('2024-01-28T13:05:27.451Z');
  const earthRadius = 6378.137;

  describe('Extract Orbital Elements from TLE', () => {
    it('should extract orbital elements from ISS TLE', () => {
      const sat = new Satellite({
        tle1: ISS_TLE.line1 as TleLine1,
        tle2: ISS_TLE.line2 as TleLine2,
      });

      const j2000State = sat.toJ2000(date);
      const elements = j2000State.toClassicalElements();

      expect(elements).toBeDefined();
      expect(elements.semimajorAxis).toBeGreaterThan(6700);
      expect(elements.semimajorAxis).toBeLessThan(6900);
      expect(elements.eccentricity).toBeLessThan(0.01);
    });

    it('should have valid inclination', () => {
      const sat = new Satellite({
        tle1: ISS_TLE.line1 as TleLine1,
        tle2: ISS_TLE.line2 as TleLine2,
      });

      const j2000State = sat.toJ2000(date);
      const elements = j2000State.toClassicalElements();

      // ISS inclination is about 51.6 degrees
      const incDeg = elements.inclination * (180 / Math.PI);

      expect(incDeg).toBeGreaterThan(50);
      expect(incDeg).toBeLessThan(53);
    });

    it('should calculate period correctly', () => {
      const sat = new Satellite({
        tle1: ISS_TLE.line1 as TleLine1,
        tle2: ISS_TLE.line2 as TleLine2,
      });

      const j2000State = sat.toJ2000(date);
      const elements = j2000State.toClassicalElements();

      // ISS period is about 92 minutes
      expect(elements.period).toBeGreaterThan(90);
      expect(elements.period).toBeLessThan(95);
    });

    it('should calculate apogee and perigee', () => {
      const sat = new Satellite({
        tle1: ISS_TLE.line1 as TleLine1,
        tle2: ISS_TLE.line2 as TleLine2,
      });

      const j2000State = sat.toJ2000(date);
      const elements = j2000State.toClassicalElements();

      const apogee = elements.semimajorAxis * (1 + elements.eccentricity);
      const perigee = elements.semimajorAxis * (1 - elements.eccentricity);

      // ISS altitude is about 400-420 km
      const apogeeAlt = apogee - earthRadius;
      const perigeeAlt = perigee - earthRadius;

      expect(apogeeAlt).toBeGreaterThan(350);
      expect(apogeeAlt).toBeLessThan(500);
      expect(perigeeAlt).toBeGreaterThan(350);
      expect(perigeeAlt).toBeLessThan(500);
    });
  });

  describe('Create Classical Elements and Convert to State Vector', () => {
    it('should create custom orbital elements', () => {
      const customElements = new ClassicalElements({
        epoch: EpochUTC.fromDateTime(date),
        semimajorAxis: 8000 as Kilometers,
        eccentricity: 0.1,
        inclination: 45 as Degrees,
        rightAscension: 90 as Degrees,
        argPerigee: 30 as Degrees,
        trueAnomaly: 0 as Degrees,
      });

      expect(customElements.semimajorAxis).toBe(8000);
      expect(customElements.eccentricity).toBe(0.1);
    });

    it('should convert classical elements to state vector', () => {
      const customElements = new ClassicalElements({
        epoch: EpochUTC.fromDateTime(date),
        semimajorAxis: 8000 as Kilometers,
        eccentricity: 0.1,
        inclination: 45 as Degrees,
        rightAscension: 90 as Degrees,
        argPerigee: 30 as Degrees,
        trueAnomaly: 0 as Degrees,
      });

      const stateVector = customElements.toJ2000();

      expect(stateVector).toBeDefined();
      expect(stateVector.position).toBeDefined();
      expect(stateVector.velocity).toBeDefined();

      // Verify position magnitude is reasonable (periapsis)
      const r = Math.sqrt(
        stateVector.position.x ** 2 +
        stateVector.position.y ** 2 +
        stateVector.position.z ** 2,
      );

      // At true anomaly = 0, we're at periapsis
      const expectedPeriapsis = 8000 * (1 - 0.1);

      expect(r).toBeCloseTo(expectedPeriapsis, 0);
    });
  });

  describe('Convert State Vector to Classical Elements', () => {
    it('should convert J2000 state to classical elements', () => {
      const customState = new J2000(
        EpochUTC.fromDateTime(date),
        new Vector3D(
          -4040.9257 as Kilometers,
          -4884.0906 as Kilometers,
          3522.9643 as Kilometers,
        ),
        new Vector3D(
          5.4662 as KilometersPerSecond,
          -3.4425 as KilometersPerSecond,
          -2.4854 as KilometersPerSecond,
        ),
      );

      const elements = customState.toClassicalElements();

      expect(elements).toBeDefined();
      expect(elements.semimajorAxis).toBeGreaterThan(6000);
      expect(elements.eccentricity).toBeGreaterThanOrEqual(0);
      expect(elements.eccentricity).toBeLessThan(1);
    });

    it('should have valid angular elements', () => {
      const customState = new J2000(
        EpochUTC.fromDateTime(date),
        new Vector3D(
          -4040.9257 as Kilometers,
          -4884.0906 as Kilometers,
          3522.9643 as Kilometers,
        ),
        new Vector3D(
          5.4662 as KilometersPerSecond,
          -3.4425 as KilometersPerSecond,
          -2.4854 as KilometersPerSecond,
        ),
      );

      const elements = customState.toClassicalElements();

      // All angular elements should be in valid range
      expect(elements.inclination).toBeGreaterThanOrEqual(0);
      expect(elements.inclination).toBeLessThanOrEqual(Math.PI);

      expect(elements.rightAscension).toBeGreaterThanOrEqual(0);
      expect(elements.rightAscension).toBeLessThanOrEqual(2 * Math.PI);

      expect(elements.trueAnomaly).toBeGreaterThanOrEqual(0);
      expect(elements.trueAnomaly).toBeLessThanOrEqual(2 * Math.PI);
    });
  });

  describe('Create TLE from Classical Elements', () => {
    it('should generate TLE from GEO orbit elements', () => {
      const geoElements = new ClassicalElements({
        epoch: EpochUTC.fromDateTime(date),
        semimajorAxis: 42164 as Kilometers,
        eccentricity: 0.0001,
        inclination: 0.1 as Degrees,
        rightAscension: 0 as Degrees,
        argPerigee: 0 as Degrees,
        trueAnomaly: 0 as Degrees,
      });

      const tle = Tle.fromClassicalElements(geoElements);

      expect(tle).toBeDefined();
      expect(tle.line1).toBeDefined();
      expect(tle.line2).toBeDefined();
      expect(tle.line1.length).toBe(69);
      expect(tle.line2.length).toBe(69);
    });

    it('should verify TLE by reading back', () => {
      const geoElements = new ClassicalElements({
        epoch: EpochUTC.fromDateTime(date),
        semimajorAxis: 42164 as Kilometers,
        eccentricity: 0.0001,
        inclination: 0.1 as Degrees,
        rightAscension: 0 as Degrees,
        argPerigee: 0 as Degrees,
        trueAnomaly: 0 as Degrees,
      });

      const tle = Tle.fromClassicalElements(geoElements);
      const verifyTle = new Satellite({
        tle1: tle.line1,
        tle2: tle.line2,
      });

      const verifyState = verifyTle.toJ2000(date);
      const verifyElements = verifyState.toClassicalElements();

      // Semi-major axis should be close to original
      expect(verifyElements.semimajorAxis).toBeCloseTo(42164, -1);

      // Period should be ~1436 minutes for GEO
      expect(verifyElements.period).toBeGreaterThan(1430);
      expect(verifyElements.period).toBeLessThan(1445);
    });
  });

  describe('Different Orbit Types', () => {
    const orbitConfigs = [
      {
        name: 'LEO (Circular)',
        sma: 6778 as Kilometers,
        ecc: 0.001,
        inc: 51.6 as Degrees,
        expectedAltMin: 390,
        expectedAltMax: 410,
      },
      {
        name: 'MEO (GPS-like)',
        sma: 26560 as Kilometers,
        ecc: 0.01,
        inc: 55 as Degrees,
        expectedAltMin: 19900,
        expectedAltMax: 20500,
      },
      {
        name: 'HEO (Molniya)',
        sma: 26554 as Kilometers,
        ecc: 0.74,
        inc: 63.4 as Degrees,
        expectedAltMin: 500, // Perigee
        expectedAltMax: 40000, // Apogee
      },
    ];

    orbitConfigs.forEach((config) => {
      it(`should create ${config.name} orbit`, () => {
        const elements = new ClassicalElements({
          epoch: EpochUTC.fromDateTime(date),
          semimajorAxis: config.sma,
          eccentricity: config.ecc,
          inclination: config.inc,
          rightAscension: 0 as Degrees,
          argPerigee: 0 as Degrees,
          trueAnomaly: 0 as Degrees,
        });

        const apogee = elements.semimajorAxis * (1 + elements.eccentricity);
        const perigee = elements.semimajorAxis * (1 - elements.eccentricity);

        const apogeeAlt = apogee - earthRadius;
        const perigeeAlt = perigee - earthRadius;

        expect(perigeeAlt).toBeGreaterThan(config.expectedAltMin);
        expect(apogeeAlt).toBeLessThan(config.expectedAltMax);
      });
    });
  });

  describe('Round-Trip Conversion', () => {
    it('should preserve elements through state vector conversion', () => {
      const originalElements = new ClassicalElements({
        epoch: EpochUTC.fromDateTime(date),
        semimajorAxis: 7500 as Kilometers,
        eccentricity: 0.05,
        inclination: 45 as Degrees,
        rightAscension: 90 as Degrees,
        argPerigee: 30 as Degrees,
        trueAnomaly: 60 as Degrees,
      });

      const stateVector = originalElements.toJ2000();
      const recoveredElements = stateVector.toClassicalElements();

      expect(recoveredElements.semimajorAxis).toBeCloseTo(originalElements.semimajorAxis, 0);
      expect(recoveredElements.eccentricity).toBeCloseTo(originalElements.eccentricity, 5);
    });
  });
});
