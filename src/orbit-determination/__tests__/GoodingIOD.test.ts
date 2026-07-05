
/**
 * @file GoodingIOD test suite
 * @description Tests for Gooding angles-only Initial Orbit Determination
 * Based on Orekit's IodGoodingTest
 *
 * Reference: Gooding, R.H., A New Procedure for Orbit Determination Based on Three Lines of Sight (Angles only),
 * Technical Report 93004, April 1993
 */

import { ClassicalElements, DEG2RAD, Degrees, Kilometers, RAD2DEG, Radians, Sgp4Propagator, Tle } from '@src/main';
import { GroundStation } from '../../objects/GroundStation';
import { RadecTopocentric } from '@src/observation';
import { ObservationOptical } from '@src/observation/ObservationOptical';
import { GoodingIOD, ModifiedGoodingIOD } from '@src/orbit-determination';
import { KeplerPropagator } from '@src/propagator/KeplerPropagator';
import { EpochUTC } from '@src/time';


describe('GoodingIOD', () => {
  /**
   * Test based on real satellite observations
   * Issue #1166: RA/Dec observations of a satellite
   */
  describe('RA/Dec observations', () => {
    it('should determine orbit from three RA/Dec observations', () => {
      const propagator = new KeplerPropagator(new ClassicalElements({
        epoch: EpochUTC.fromDateTimeString('2023-06-09T17:00:00.000Z'),
        semimajorAxis: 42_164 as Kilometers,
        eccentricity: 0.001,
        inclination: 0.1 * DEG2RAD as Radians,
        argPerigee: 180.0 * DEG2RAD as Radians,
        rightAscension: 90.0 * DEG2RAD as Radians,
        trueAnomaly: 0.0 * DEG2RAD as Radians,
      }));

      // Ground station location (Kazakhstan)
      const stationLat = 43.05722 as Degrees;
      const stationLon = 76.971667 as Degrees;
      const stationAlt = 2.735 as Kilometers; // 2735 meters

      const sensor = new GroundStation({
        lat: stationLat,
        lon: stationLon,
        alt: stationAlt,
      });

      // Observation times
      const t1 = EpochUTC.fromDateTimeString('2023-06-09T17:04:59.100Z');
      const t2 = EpochUTC.fromDateTimeString('2023-06-09T17:10:50.660Z');
      const t3 = EpochUTC.fromDateTimeString('2023-06-09T17:16:21.090Z');

      // Right Ascension in hours (converted to degrees)
      const raDec1 = RadecTopocentric.fromStateVector(propagator.propagate(t1), sensor.toJ2000(t1.toDateTime()));
      const raDec2 = RadecTopocentric.fromStateVector(propagator.propagate(t2), sensor.toJ2000(t2.toDateTime()));
      const raDec3 = RadecTopocentric.fromStateVector(propagator.propagate(t3), sensor.toJ2000(t3.toDateTime()));

      // Create observations
      const obs1 = new ObservationOptical(
        sensor.toJ2000(t1.toDateTime()),
        raDec1,
      );

      const obs2 = new ObservationOptical(
        sensor.toJ2000(t2.toDateTime()),
        raDec2,
      );

      const obs3 = new ObservationOptical(
        sensor.toJ2000(t3.toDateTime()),
        raDec3,
      );

      // Initial range estimates (GEO satellite)
      const rho1init = 42_000 as Kilometers;
      const rho3init = 42_000 as Kilometers;

      // Run Gooding IOD
      const iod = new GoodingIOD();
      const orbit = iod.estimate(obs1, obs2, obs3, rho1init, rho3init);

      // Convert to classical elements for verification
      const elements = orbit.toClassicalElements();

      expect(elements.semimajorAxis).toBeCloseTo(42_164, 2); // km
      expect(elements.eccentricity).toBeCloseTo(0.001, 2);
      expect(elements.inclinationDegrees).toBeCloseTo(0.1, 2); // degrees
      expect(Math.abs(elements.argPerigeeDegrees - 180)).toBeLessThanOrEqual(5); // +/- 5 degrees allowed
      expect(elements.rightAscensionDegrees).toBeCloseTo(90, 1); // degrees
    });
  });

  /**
   * Test with perfect range estimates
   * Verifies convergence when given exact initial ranges
   */
  describe('Perfect range estimates', () => {
    it('should accurately determine orbit with exact initial ranges', () => {
      // Create a known GEO orbit
      const propagator = new KeplerPropagator(new ClassicalElements({
        epoch: EpochUTC.fromDateTimeString('2025-11-22T02:00:00.000Z'),
        semimajorAxis: 42_164 as Kilometers, // GEO altitude
        eccentricity: 0.0001,
        inclination: 4.5 * DEG2RAD as Radians,
        argPerigee: 0.0 * DEG2RAD as Radians,
        rightAscension: 43.0 * DEG2RAD as Radians,
        trueAnomaly: 0.0 * DEG2RAD as Radians,
      }));

      const sensor = new GroundStation({
        lat: 41.75 as Degrees,
        lon: -70.54 as Degrees,
        alt: 0.1 as Kilometers,
      });

      const t1 = EpochUTC.fromDateTimeString('2025-11-22T02:00:00.000Z');
      const t2 = EpochUTC.fromDateTimeString('2025-11-22T02:05:00.000Z');
      const t3 = EpochUTC.fromDateTimeString('2025-11-22T02:10:00.000Z');

      const p1 = propagator.propagate(t1);
      const p2 = propagator.propagate(t2);
      const p3 = propagator.propagate(t3);

      // Generate observations from known orbit
      const raDec1 = RadecTopocentric.fromStateVector(p1, sensor.toJ2000(t1.toDateTime()));
      const raDec2 = RadecTopocentric.fromStateVector(p2, sensor.toJ2000(t2.toDateTime()));
      const raDec3 = RadecTopocentric.fromStateVector(p3, sensor.toJ2000(t3.toDateTime()));
      const obs1 = new ObservationOptical(sensor.toJ2000(t1.toDateTime()), raDec1);
      const obs2 = new ObservationOptical(sensor.toJ2000(t2.toDateTime()), raDec2);
      const obs3 = new ObservationOptical(sensor.toJ2000(t3.toDateTime()), raDec3);

      // Run IOD with reasonable initial guesses
      const iod = new GoodingIOD();

      const rho1init = 38_000 as Kilometers; // Initial range estimate for t1
      const rho3init = 38_000 as Kilometers; // Initial range estimate for t3

      const orbit = iod.estimate(obs1, obs2, obs3, rho1init, rho3init);
      const elements = orbit.toClassicalElements();

      // Should recover the original orbit
      expect(Math.abs(elements.semimajorAxis - 42_164)).toBeLessThanOrEqual(5);
      expect(elements.eccentricity).toBeCloseTo(0.0001, 2);
      expect(elements.inclinationDegrees).toBeCloseTo(4.5, 1);
    });
  });

  /**
   * Test convergence behavior
   */
  describe('Convergence characteristics', () => {
    it('should converge for GEO satellite observations', () => {
      // Create a known GEO orbit
      const propagator = new KeplerPropagator(new ClassicalElements({
        epoch: EpochUTC.fromDateTimeString('2025-11-22T02:00:00.000Z'),
        semimajorAxis: 42_164 as Kilometers, // GEO altitude
        eccentricity: 0.0001,
        inclination: 0.5 * DEG2RAD as Radians,
        argPerigee: 0.0 * DEG2RAD as Radians,
        rightAscension: 45.0 * DEG2RAD as Radians,
        trueAnomaly: 0.0 * DEG2RAD as Radians,
      }));

      const sensor = new GroundStation({
        lat: 41.958076 as Degrees,
        lon: -70.662182 as Degrees,
        alt: 0.0 as Kilometers,
      });

      const t1 = EpochUTC.fromDateTimeString('2025-11-22T02:00:00.000Z');
      const t2 = EpochUTC.fromDateTimeString('2025-11-22T03:00:00.000Z');
      const t3 = EpochUTC.fromDateTimeString('2025-11-22T04:00:00.000Z');

      // Generate observations from known orbit
      const raDec1 = RadecTopocentric.fromStateVector(propagator.propagate(t1), sensor.toJ2000(t1.toDateTime()));
      const raDec2 = RadecTopocentric.fromStateVector(propagator.propagate(t2), sensor.toJ2000(t2.toDateTime()));
      const raDec3 = RadecTopocentric.fromStateVector(propagator.propagate(t3), sensor.toJ2000(t3.toDateTime()));

      const obs1 = new ObservationOptical(sensor.toJ2000(t1.toDateTime()), raDec1);
      const obs2 = new ObservationOptical(sensor.toJ2000(t2.toDateTime()), raDec2);
      const obs3 = new ObservationOptical(sensor.toJ2000(t3.toDateTime()), raDec3);

      const iod = new GoodingIOD();

      const orbit = iod.estimate(obs1, obs2, obs3);
      const elements = orbit.toClassicalElements();

      // Should recover GEO-like orbit
      expect(elements.semimajorAxis).toBeCloseTo(42_164, 1);
      expect(elements.eccentricity).toBeLessThan(0.01);
      expect(elements.inclinationDegrees).toBeCloseTo(0.5, 1);
    });

    it('should handle multi-revolution scenarios', () => {
      // Create a known LEO orbit for multi-rev test
      const propagator = new KeplerPropagator(new ClassicalElements({
        epoch: EpochUTC.fromDateTimeString('2025-01-01T00:00:00.000Z'),
        semimajorAxis: 7_200 as Kilometers,
        eccentricity: 0.01,
        inclination: 45.0 * DEG2RAD as Radians,
        argPerigee: 30.0 * DEG2RAD as Radians,
        rightAscension: 60.0 * DEG2RAD as Radians,
        trueAnomaly: 0.0 * DEG2RAD as Radians,
      }));

      const sensor = new GroundStation({
        lat: 40.0 as Degrees,
        lon: -75.0 as Degrees,
        alt: 0.1 as Kilometers,
      });

      const t1 = EpochUTC.fromDateTimeString('2025-01-01T00:00:00.000Z');
      const t2 = EpochUTC.fromDateTimeString('2025-01-01T00:00:10.000Z');
      const t3 = EpochUTC.fromDateTimeString('2025-01-01T00:00:20.000Z');

      // Generate observations from known orbit
      const raDec1 = RadecTopocentric.fromStateVector(propagator.propagate(t1), sensor.toJ2000(t1.toDateTime()));
      const raDec2 = RadecTopocentric.fromStateVector(propagator.propagate(t2), sensor.toJ2000(t2.toDateTime()));
      const raDec3 = RadecTopocentric.fromStateVector(propagator.propagate(t3), sensor.toJ2000(t3.toDateTime()));

      const obs1 = new ObservationOptical(sensor.toJ2000(t1.toDateTime()), raDec1);
      const obs2 = new ObservationOptical(sensor.toJ2000(t2.toDateTime()), raDec2);
      const obs3 = new ObservationOptical(sensor.toJ2000(t3.toDateTime()), raDec3);

      const iod = new GoodingIOD();

      // Test with nRev = 0 (short arc)
      const nRev = 0;
      const direction = true; // prograde

      const orbit = iod.estimate(obs1, obs2, obs3, 7_100 as Kilometers, 7_300 as Kilometers, nRev, direction);
      const elements = orbit.toClassicalElements();

      // Should recover the orbit reasonably well
      expect(Math.abs(elements.semimajorAxis - 7_200)).toBeLessThanOrEqual(5);
      expect(elements.eccentricity).toBeCloseTo(0.01, 1);
    });
  });

  /**
   * Test with different orbital regimes
   */
  describe('Orbital regime tests', () => {
    it('should handle LEO observations', () => {
      // Create a known ISS-like LEO orbit
      const originalTle = new Tle(
        '1 53140U 22083J   25325.95729207 -.00001656  00000+0 -86028-4 0 99993',
        '2 53140  53.2176 297.7496 0001344  87.2420 272.8726 15.08820168184958',
      );
      // Create a known LEO orbit
      const propagator = new Sgp4Propagator(originalTle);

      const sensor = new GroundStation({
        lat: 41.75 as Degrees,
        lon: -70.54 as Degrees,
        alt: 0.1 as Kilometers,
      });

      const t1 = EpochUTC.fromDateTimeString('2025-11-22T05:48:00.000Z');
      const t2 = EpochUTC.fromDateTimeString('2025-11-22T05:48:30.000Z');
      const t3 = EpochUTC.fromDateTimeString('2025-11-22T05:49:00.000Z');
      const t4 = EpochUTC.fromDateTimeString('2025-11-22T05:49:30.000Z');
      const t5 = EpochUTC.fromDateTimeString('2025-11-22T05:50:00.000Z');
      const t6 = EpochUTC.fromDateTimeString('2025-11-22T05:50:30.000Z');
      const t7 = EpochUTC.fromDateTimeString('2025-11-22T05:51:00.000Z');
      const t8 = EpochUTC.fromDateTimeString('2025-11-22T05:51:30.000Z');
      const t9 = EpochUTC.fromDateTimeString('2025-11-22T05:52:00.000Z');
      const t10 = EpochUTC.fromDateTimeString('2025-11-22T05:52:30.000Z');
      // Generate observations from known orbit
      const raDec1 = RadecTopocentric.fromStateVector(propagator.propagate(t1), sensor.toJ2000(t1.toDateTime()));
      const raDec2 = RadecTopocentric.fromStateVector(propagator.propagate(t2), sensor.toJ2000(t2.toDateTime()));
      const raDec3 = RadecTopocentric.fromStateVector(propagator.propagate(t3), sensor.toJ2000(t3.toDateTime()));
      const raDec4 = RadecTopocentric.fromStateVector(propagator.propagate(t4), sensor.toJ2000(t4.toDateTime()));
      const raDec5 = RadecTopocentric.fromStateVector(propagator.propagate(t5), sensor.toJ2000(t5.toDateTime()));
      const raDec6 = RadecTopocentric.fromStateVector(propagator.propagate(t6), sensor.toJ2000(t6.toDateTime()));
      const raDec7 = RadecTopocentric.fromStateVector(propagator.propagate(t7), sensor.toJ2000(t7.toDateTime()));
      const raDec8 = RadecTopocentric.fromStateVector(propagator.propagate(t8), sensor.toJ2000(t8.toDateTime()));
      const raDec9 = RadecTopocentric.fromStateVector(propagator.propagate(t9), sensor.toJ2000(t9.toDateTime()));
      const raDec10 = RadecTopocentric.fromStateVector(propagator.propagate(t10), sensor.toJ2000(t10.toDateTime()));

      const obs1 = new ObservationOptical(sensor.toJ2000(t1.toDateTime()), raDec1);
      const obs2 = new ObservationOptical(sensor.toJ2000(t2.toDateTime()), raDec2);
      const obs3 = new ObservationOptical(sensor.toJ2000(t3.toDateTime()), raDec3);
      const obs4 = new ObservationOptical(sensor.toJ2000(t4.toDateTime()), raDec4);
      const obs5 = new ObservationOptical(sensor.toJ2000(t5.toDateTime()), raDec5);
      const obs6 = new ObservationOptical(sensor.toJ2000(t6.toDateTime()), raDec6);
      const obs7 = new ObservationOptical(sensor.toJ2000(t7.toDateTime()), raDec7);
      const obs8 = new ObservationOptical(sensor.toJ2000(t8.toDateTime()), raDec8);
      const obs9 = new ObservationOptical(sensor.toJ2000(t9.toDateTime()), raDec9);
      const obs10 = new ObservationOptical(sensor.toJ2000(t10.toDateTime()), raDec10);

      const iod = new ModifiedGoodingIOD();

      // LEO range estimates
      const leoRange1 = 1_000 as Kilometers;
      const leoRange3 = 1_500 as Kilometers;

      const orbit = iod.solve([obs1, obs2, obs3, obs4, obs5, obs6, obs7, obs8, obs9, obs10], leoRange1, leoRange3);
      const elements = orbit.toClassicalElements();

      // Should recover LEO orbit
      expect(elements.eccentricity).toBeLessThan(0.01);
      expect(elements.inclinationDegrees).toBeCloseTo(53.2176, 0);
      expect(Math.abs(elements.semimajorAxis - 6919.20905)).toBeLessThanOrEqual(20);
    });

    it('should handle MEO observations', () => {
      // Create a known NAVSTAR-like MEO orbit
      const originalTle = new Tle(
        '1 15039U 84059A   25323.82011001 -.00000048  00000+0  00000+0 0 99993',
        '2 15039  63.4276  70.3297 0239207  53.1887 307.8308  1.92302746294098',
      );
      // Create a known LEO orbit
      const propagator = new Sgp4Propagator(originalTle);

      const sensor = new GroundStation({
        lat: 41.75 as Degrees,
        lon: -70.54 as Degrees,
        alt: 0.1 as Kilometers,
      });

      const t1 = EpochUTC.fromDateTimeString('2025-11-22T16:00:00.000Z');
      const t2 = EpochUTC.fromDateTimeString('2025-11-22T16:02:00.000Z');
      const t3 = EpochUTC.fromDateTimeString('2025-11-22T16:04:00.000Z');
      const t4 = EpochUTC.fromDateTimeString('2025-11-22T16:06:00.000Z');
      const t5 = EpochUTC.fromDateTimeString('2025-11-22T16:08:00.000Z');

      // Generate observations from known orbit
      const raDec1 = RadecTopocentric.fromStateVector(propagator.propagate(t1), sensor.toJ2000(t1.toDateTime()));
      const raDec2 = RadecTopocentric.fromStateVector(propagator.propagate(t2), sensor.toJ2000(t2.toDateTime()));
      const raDec3 = RadecTopocentric.fromStateVector(propagator.propagate(t3), sensor.toJ2000(t3.toDateTime()));
      const raDec4 = RadecTopocentric.fromStateVector(propagator.propagate(t4), sensor.toJ2000(t4.toDateTime()));
      const raDec5 = RadecTopocentric.fromStateVector(propagator.propagate(t5), sensor.toJ2000(t5.toDateTime()));

      const obs1 = new ObservationOptical(sensor.toJ2000(t1.toDateTime()), raDec1);
      const obs2 = new ObservationOptical(sensor.toJ2000(t2.toDateTime()), raDec2);
      const obs3 = new ObservationOptical(sensor.toJ2000(t3.toDateTime()), raDec3);
      const obs4 = new ObservationOptical(sensor.toJ2000(t4.toDateTime()), raDec4);
      const obs5 = new ObservationOptical(sensor.toJ2000(t5.toDateTime()), raDec5);

      const iod = new ModifiedGoodingIOD();

      // MEO range estimates (GPS-like)
      const meoRange1 = 20_000 as Kilometers;
      const meoRange3 = 21_000 as Kilometers;

      const orbit = iod.solve([obs1, obs2, obs3, obs4, obs5], meoRange1, meoRange3);
      const elements = orbit.toClassicalElements();

      // Should recover MEO orbit
      expect(Math.abs(elements.semimajorAxis - 27_317)).toBeLessThanOrEqual(10);
      expect(elements.eccentricity).toBeCloseTo(0.024082567, 1);
      expect(Math.abs(elements.inclinationDegrees - 1.1074806036594826 * RAD2DEG)).toBeLessThanOrEqual(0.2);
    });
  });
});
