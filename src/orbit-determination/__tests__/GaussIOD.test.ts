/**
 * @file GaussIOD test suite
 * @description Tests for Gauss angles-only Initial Orbit Determination
 * Based on Vallado Example 7-2 and other test cases
 *
 * Reference: Vallado, D.A., Fundamentals of Astrodynamics and Applications, 4th ed., 2013
 * Section 7.3: Gauss's Method, Example 7-2
 */

import { ClassicalElements, DEG2RAD, Degrees, Earth, J2000, Kilometers, KilometersPerSecond, Radians, Sgp4, Vector3D } from '@src/main';
import { GroundStation } from '../../objects/GroundStation';
import { RadecTopocentric } from '@src/observation';
import { ObservationOptical } from '@src/observation/ObservationOptical';
import { GaussIOD } from '@src/orbit-determination/GaussIOD';
import { KeplerPropagator } from '@src/propagator/KeplerPropagator';
import { EpochUTC } from '@src/time';


describe('GaussIOD', () => {
  const mu = Earth.mu;

  /**
   * Vallado Example 7-2
   * This is the canonical test case from Vallado's textbook with known correct results
   */
  describe('Vallado Example 7-2', () => {
    it('should match Vallado Example 7-2 results', () => {
      // Observation data from Vallado Example 7-2
      const rtasc1 = 0.939913 as Degrees;
      const rtasc2 = 45.025748 as Degrees;
      const rtasc3 = 67.886655 as Degrees;

      const decl1 = 18.667717 as Degrees;
      const decl2 = 35.664741 as Degrees;
      const decl3 = 36.996583 as Degrees;

      // Julian dates (JD 2456159.5 + fractional day)
      const d1 = Sgp4.invjday(2456159.5, 0.4864351851851852);
      const d2 = Sgp4.invjday(2456159.5, 0.49199074074074073);
      const d3 = Sgp4.invjday(2456159.5, 0.4947685185185185);
      const t1 = EpochUTC.fromDate({
        year: d1.year,
        month: d1.mon,
        day: d1.day,
        hour: d1.hr,
        minute: d1.min,
        second: d1.sec,
      });
      const t2 = EpochUTC.fromDate({
        year: d2.year,
        month: d2.mon,
        day: d2.day,
        hour: d2.hr,
        minute: d2.min,
        second: d2.sec,
      });
      const t3 = EpochUTC.fromDate({
        year: d3.year,
        month: d3.mon,
        day: d3.day,
        hour: d3.hr,
        minute: d3.min,
        second: d3.sec,
      });

      // Site position vectors (ECI, in km) from Vallado Example 7-2
      const rseci1 = new Vector3D(4054.881 as Kilometers, 2748.195 as Kilometers, 4074.237 as Kilometers);
      const rseci2 = new Vector3D(3956.224 as Kilometers, 2888.232 as Kilometers, 4074.364 as Kilometers);
      const rseci3 = new Vector3D(3905.073 as Kilometers, 2956.935 as Kilometers, 4074.430 as Kilometers);

      // Create site objects with the ECI positions
      const site1 = new J2000(t1, rseci1, Vector3D.zero as Vector3D<KilometersPerSecond>);
      const site2 = new J2000(t2, rseci2, Vector3D.zero as Vector3D<KilometersPerSecond>);
      const site3 = new J2000(t3, rseci3, Vector3D.zero as Vector3D<KilometersPerSecond>);

      // Convert RA/Dec to radians and create RadecTopocentric observations
      const raDec1 = new RadecTopocentric(
        t1,
        rtasc1 * DEG2RAD as Radians,
        decl1 * DEG2RAD as Radians,
      );
      const raDec2 = new RadecTopocentric(
        t2,
        rtasc2 * DEG2RAD as Radians,
        decl2 * DEG2RAD as Radians,
      );
      const raDec3 = new RadecTopocentric(
        t3,
        rtasc3 * DEG2RAD as Radians,
        decl3 * DEG2RAD as Radians,
      );

      // Create observations
      const obs1 = new ObservationOptical(site1, raDec1);
      const obs2 = new ObservationOptical(site2, raDec2);
      const obs3 = new ObservationOptical(site3, raDec3);

      // Run Gauss IOD
      const iod = new GaussIOD(mu);
      const orbit = iod.estimate(obs1, obs2, obs3);

      expect(orbit).not.toBeNull();

      if (orbit) {
        // Expected results from Vallado Example 7-2
        const expectedPosX = 6313.378130210396 as Kilometers;
        const expectedPosY = 5247.50563344895 as Kilometers;
        const expectedPosZ = 6467.707164431651 as Kilometers;

        const expectedVelX = -4.185488280436629 as Kilometers;
        const expectedVelY = 4.7884929168898145 as Kilometers;
        const expectedVelZ = 1.721714659663034 as Kilometers;

        // Check position (should be within ~1 km)
        expect(orbit.position.x).toBeCloseTo(expectedPosX, 0);
        expect(orbit.position.y).toBeCloseTo(expectedPosY, 0);
        expect(orbit.position.z).toBeCloseTo(expectedPosZ, 0);

        // Check velocity (should be within ~0.01 km/s)
        expect(orbit.velocity.x).toBeCloseTo(expectedVelX, 2);
        expect(orbit.velocity.y).toBeCloseTo(expectedVelY, 2);
        expect(orbit.velocity.z).toBeCloseTo(expectedVelZ, 2);
      }
    });
  });

  /**
   * Test Gauss IOD with GEO orbit
   * High altitude circular orbit with minimal inclination
   */
  describe('GEO orbit observations', () => {
    it('should determine orbit from three GEO observations', () => {
      const propagator = new KeplerPropagator(
        new ClassicalElements({
          epoch: EpochUTC.fromDateTimeString('2023-06-09T17:00:00.000Z'),
          semimajorAxis: 42_164 as Kilometers,
          eccentricity: 0.001,
          inclination: 0.1 * DEG2RAD as Radians,
          argPerigee: 180.0 * DEG2RAD as Radians,
          rightAscension: 90.0 * DEG2RAD as Radians,
          trueAnomaly: 0.0 * DEG2RAD as Radians,
        }),
      );

      // Ground station location (Kazakhstan)
      const stationLat = 43.05722 as Degrees;
      const stationLon = 76.971667 as Degrees;
      const stationAlt = 2.735 as Kilometers;

      const sensor = new GroundStation({
        lat: stationLat,
        lon: stationLon,
        alt: stationAlt,
      });

      // Observation times (roughly 6-minute intervals)
      const t1 = EpochUTC.fromDateTimeString('2023-06-09T17:04:59.100Z');
      const t2 = EpochUTC.fromDateTimeString('2023-06-09T17:10:50.660Z');
      const t3 = EpochUTC.fromDateTimeString('2023-06-09T17:16:21.090Z');

      // Generate synthetic observations
      const raDec1 = RadecTopocentric.fromStateVector(propagator.propagate(t1), sensor.toJ2000(t1.toDateTime()));
      const raDec2 = RadecTopocentric.fromStateVector(propagator.propagate(t2), sensor.toJ2000(t2.toDateTime()));
      const raDec3 = RadecTopocentric.fromStateVector(propagator.propagate(t3), sensor.toJ2000(t3.toDateTime()));

      const obs1 = new ObservationOptical(sensor.toJ2000(t1.toDateTime()), raDec1);
      const obs2 = new ObservationOptical(sensor.toJ2000(t2.toDateTime()), raDec2);
      const obs3 = new ObservationOptical(sensor.toJ2000(t3.toDateTime()), raDec3);

      // Run Gauss IOD
      const iod = new GaussIOD(mu);
      const orbit = iod.estimate(obs1, obs2, obs3);

      expect(orbit).not.toBeNull();

      if (orbit) {
        const elements = orbit.toClassicalElements();

        // Verify orbital elements (Gauss IOD typically has ~1-2 km accuracy for well-spaced observations)
        expect(elements.semimajorAxis).toBeCloseTo(42_164, 0); // Within 1 km
        expect(elements.eccentricity).toBeCloseTo(0.001, 2);
        expect(elements.inclinationDegrees).toBeCloseTo(0.1, 1);
      }
    });
  });

  /**
   * Test Gauss IOD with MEO orbit
   * Medium Earth Orbit (GPS-like)
   */
  describe('MEO orbit observations', () => {
    it('should determine orbit from three MEO observations', () => {
      const propagator = new KeplerPropagator(
        new ClassicalElements({
          epoch: EpochUTC.fromDateTimeString('2023-01-01T12:00:00.000Z'),
          semimajorAxis: 26_560 as Kilometers, // GPS altitude
          eccentricity: 0.01,
          inclination: 55.0 * DEG2RAD as Radians,
          argPerigee: 45.0 * DEG2RAD as Radians,
          rightAscension: 120.0 * DEG2RAD as Radians,
          trueAnomaly: 30.0 * DEG2RAD as Radians,
        }),
      );

      const stationLat = 34.0 as Degrees;
      const stationLon = -118.0 as Degrees;
      const stationAlt = 0.3 as Kilometers;

      const sensor = new GroundStation({
        lat: stationLat,
        lon: stationLon,
        alt: stationAlt,
      });

      // Shorter time intervals for MEO (3-minute intervals)
      const t1 = EpochUTC.fromDateTimeString('2023-01-01T12:00:00.000Z');
      const t2 = EpochUTC.fromDateTimeString('2023-01-01T12:03:00.000Z');
      const t3 = EpochUTC.fromDateTimeString('2023-01-01T12:06:00.000Z');

      const raDec1 = RadecTopocentric.fromStateVector(propagator.propagate(t1), sensor.toJ2000(t1.toDateTime()));
      const raDec2 = RadecTopocentric.fromStateVector(propagator.propagate(t2), sensor.toJ2000(t2.toDateTime()));
      const raDec3 = RadecTopocentric.fromStateVector(propagator.propagate(t3), sensor.toJ2000(t3.toDateTime()));

      const obs1 = new ObservationOptical(sensor.toJ2000(t1.toDateTime()), raDec1);
      const obs2 = new ObservationOptical(sensor.toJ2000(t2.toDateTime()), raDec2);
      const obs3 = new ObservationOptical(sensor.toJ2000(t3.toDateTime()), raDec3);

      const iod = new GaussIOD(mu);
      const orbit = iod.estimate(obs1, obs2, obs3);

      expect(orbit).not.toBeNull();

      if (orbit) {
        const elements = orbit.toClassicalElements();

        // MEO orbits should also converge well
        expect(Math.abs(elements.semimajorAxis - 26_560)).toBeLessThanOrEqual(10);
        expect(elements.eccentricity).toBeCloseTo(0.01, 1);
        expect(elements.inclinationDegrees).toBeCloseTo(55.0, 2);
      }
    });
  });

  /**
   * Test Gauss IOD with LEO orbit
   * Low Earth Orbit (ISS-like)
   */
  describe('LEO orbit observations', () => {
    it('should determine orbit from three LEO observations', () => {
      const propagator = new KeplerPropagator(
        new ClassicalElements({
          epoch: EpochUTC.fromDateTimeString('2023-03-15T08:00:00.000Z'),
          semimajorAxis: 6_778 as Kilometers, // ~400 km altitude
          eccentricity: 0.0001,
          inclination: 51.6 * DEG2RAD as Radians,
          argPerigee: 0.0 * DEG2RAD as Radians,
          rightAscension: 45.0 * DEG2RAD as Radians,
          trueAnomaly: 0.0 * DEG2RAD as Radians,
        }),
      );

      const stationLat = 28.5 as Degrees; // Cape Canaveral
      const stationLon = -80.5 as Degrees;
      const stationAlt = 0.01 as Kilometers;

      const sensor = new GroundStation({
        lat: stationLat,
        lon: stationLon,
        alt: stationAlt,
      });

      // Very short intervals for LEO (1-minute intervals)
      const t1 = EpochUTC.fromDateTimeString('2023-03-15T08:00:00.000Z');
      const t2 = EpochUTC.fromDateTimeString('2023-03-15T08:01:00.000Z');
      const t3 = EpochUTC.fromDateTimeString('2023-03-15T08:02:00.000Z');

      const raDec1 = RadecTopocentric.fromStateVector(propagator.propagate(t1), sensor.toJ2000(t1.toDateTime()));
      const raDec2 = RadecTopocentric.fromStateVector(propagator.propagate(t2), sensor.toJ2000(t2.toDateTime()));
      const raDec3 = RadecTopocentric.fromStateVector(propagator.propagate(t3), sensor.toJ2000(t3.toDateTime()));

      const obs1 = new ObservationOptical(sensor.toJ2000(t1.toDateTime()), raDec1);
      const obs2 = new ObservationOptical(sensor.toJ2000(t2.toDateTime()), raDec2);
      const obs3 = new ObservationOptical(sensor.toJ2000(t3.toDateTime()), raDec3);

      const iod = new GaussIOD(mu);
      const orbit = iod.estimate(obs1, obs2, obs3);

      expect(orbit).not.toBeNull();

      if (orbit) {
        const elements = orbit.toClassicalElements();

        // LEO can be more challenging due to faster motion
        expect(Math.abs(elements.semimajorAxis - 6_778)).toBeLessThanOrEqual(10); // Within 10 km
        expect(elements.eccentricity).toBeCloseTo(0.0001, 1);
        expect(elements.inclinationDegrees).toBeCloseTo(51.6, 2);
      }
    });
  });

  /**
   * Test error handling with poor geometry
   */
  describe('Error handling', () => {
    it('should return null for observations that are too close in time', () => {
      const propagator = new KeplerPropagator(
        new ClassicalElements({
          epoch: EpochUTC.fromDateTimeString('2023-06-09T17:00:00.000Z'),
          semimajorAxis: 42_164 as Kilometers,
          eccentricity: 0.001,
          inclination: 0.1 * DEG2RAD as Radians,
          argPerigee: 180.0 * DEG2RAD as Radians,
          rightAscension: 90.0 * DEG2RAD as Radians,
          trueAnomaly: 0.0 * DEG2RAD as Radians,
        }),
      );

      const sensor = new GroundStation({
        lat: 43.05722 as Degrees,
        lon: 76.971667 as Degrees,
        alt: 2.735 as Kilometers,
      });

      // Observations too close together (1 second apart)
      const t1 = EpochUTC.fromDateTimeString('2023-06-09T17:00:00.000Z');
      const t2 = EpochUTC.fromDateTimeString('2023-06-09T17:00:01.000Z');
      const t3 = EpochUTC.fromDateTimeString('2023-06-09T17:00:02.000Z');

      const raDec1 = RadecTopocentric.fromStateVector(propagator.propagate(t1), sensor.toJ2000(t1.toDateTime()));
      const raDec2 = RadecTopocentric.fromStateVector(propagator.propagate(t2), sensor.toJ2000(t2.toDateTime()));
      const raDec3 = RadecTopocentric.fromStateVector(propagator.propagate(t3), sensor.toJ2000(t3.toDateTime()));

      const obs1 = new ObservationOptical(sensor.toJ2000(t1.toDateTime()), raDec1);
      const obs2 = new ObservationOptical(sensor.toJ2000(t2.toDateTime()), raDec2);
      const obs3 = new ObservationOptical(sensor.toJ2000(t3.toDateTime()), raDec3);

      const iod = new GaussIOD(mu);
      const orbit = iod.estimate(obs1, obs2, obs3);

      // Should return null for poor geometry
      expect(orbit).toBeNull();
    });
  });

  /**
   * Test with eccentric orbit
   */
  describe('Eccentric orbit observations', () => {
    it('should handle moderately eccentric orbits', () => {
      const propagator = new KeplerPropagator(
        new ClassicalElements({
          epoch: EpochUTC.fromDateTimeString('2023-01-01T00:00:00.000Z'),
          semimajorAxis: 24_000 as Kilometers,
          eccentricity: 0.3, // Molniya-like
          inclination: 63.4 * DEG2RAD as Radians,
          argPerigee: 270.0 * DEG2RAD as Radians,
          rightAscension: 0.0 * DEG2RAD as Radians,
          trueAnomaly: 0.0 * DEG2RAD as Radians,
        }),
      );

      const sensor = new GroundStation({
        lat: 60.0 as Degrees,
        lon: 30.0 as Degrees,
        alt: 0.1 as Kilometers,
      });

      const t1 = EpochUTC.fromDateTimeString('2023-01-01T00:00:00.000Z');
      const t2 = EpochUTC.fromDateTimeString('2023-01-01T00:05:00.000Z');
      const t3 = EpochUTC.fromDateTimeString('2023-01-01T00:10:00.000Z');

      const raDec1 = RadecTopocentric.fromStateVector(propagator.propagate(t1), sensor.toJ2000(t1.toDateTime()));
      const raDec2 = RadecTopocentric.fromStateVector(propagator.propagate(t2), sensor.toJ2000(t2.toDateTime()));
      const raDec3 = RadecTopocentric.fromStateVector(propagator.propagate(t3), sensor.toJ2000(t3.toDateTime()));

      const obs1 = new ObservationOptical(sensor.toJ2000(t1.toDateTime()), raDec1);
      const obs2 = new ObservationOptical(sensor.toJ2000(t2.toDateTime()), raDec2);
      const obs3 = new ObservationOptical(sensor.toJ2000(t3.toDateTime()), raDec3);

      const iod = new GaussIOD(mu);
      const orbit = iod.estimate(obs1, obs2, obs3);

      expect(orbit).not.toBeNull();

      if (orbit) {
        const elements = orbit.toClassicalElements();

        // Eccentric orbits are more challenging
        expect(Math.abs(elements.semimajorAxis - 24_000)).toBeLessThanOrEqual(40);
        expect(elements.eccentricity).toBeCloseTo(0.3, 1);
        expect(elements.inclinationDegrees).toBeCloseTo(63.4, 2);
      }
    });
  });
});
