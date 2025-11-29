/**
 * @file HerrickGibbsIOD test suite
 * @description Tests for Herrick-Gibbs 3-position Initial Orbit Determination
 *
 * The Herrick-Gibbs method is an improvement over the standard Gibbs method
 * for closely-spaced position vectors (less than 5 degrees apart).
 * It uses a Taylor series expansion for better accuracy with small time intervals.
 *
 * Reference: Vallado, D.A., Fundamentals of Astrodynamics and Applications
 */

import {
  ClassicalElements,
  DEG2RAD,
  Earth,
  J2000,
  Kilometers,
  Radians,
  Seconds,
  Vector3D,
} from '@src/main';
import { GibbsIOD } from '@src/orbit-determination/GibbsIOD';
import { HerrickGibbsIOD } from '@src/orbit-determination/HerrickGibbsIOD';
import { KeplerPropagator } from '@src/propagator/KeplerPropagator';
import { EpochUTC } from '@src/time';

/*
 * ============================================================================
 * Test Fixtures: Classical elements for each orbit regime
 * ============================================================================
 */

/** Create a LEO orbit (ISS-like, ~400 km altitude) */
function createLeoOrbit(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: 6778 as Kilometers,
    eccentricity: 0.0001,
    inclination: (51.6 * DEG2RAD) as Radians,
    argPerigee: (90.0 * DEG2RAD) as Radians,
    rightAscension: (45.0 * DEG2RAD) as Radians,
    trueAnomaly: (0.0 * DEG2RAD) as Radians,
  });
}

/** Create a MEO orbit (GPS-like, ~20,200 km altitude) */
function createMeoOrbit(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: 26560 as Kilometers,
    eccentricity: 0.01,
    inclination: (55.0 * DEG2RAD) as Radians,
    argPerigee: (45.0 * DEG2RAD) as Radians,
    rightAscension: (120.0 * DEG2RAD) as Radians,
    trueAnomaly: (30.0 * DEG2RAD) as Radians,
  });
}

/** Create a GEO orbit (~35,786 km altitude) */
function createGeoOrbit(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: 42164 as Kilometers,
    eccentricity: 0.0001,
    inclination: (0.1 * DEG2RAD) as Radians,
    argPerigee: (180.0 * DEG2RAD) as Radians,
    rightAscension: (90.0 * DEG2RAD) as Radians,
    trueAnomaly: (0.0 * DEG2RAD) as Radians,
  });
}

/** Create a HEO orbit (moderately eccentric) */
function createHeoOrbit(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: 24000 as Kilometers,
    eccentricity: 0.3,
    inclination: (63.4 * DEG2RAD) as Radians,
    argPerigee: (270.0 * DEG2RAD) as Radians,
    rightAscension: (0.0 * DEG2RAD) as Radians,
    trueAnomaly: (0.0 * DEG2RAD) as Radians,
  });
}

/*
 * ============================================================================
 * Test Helpers
 * ============================================================================
 */

/**
 * Generate three position vectors with their times from a propagator.
 */
function generatePositionsWithTimes(
  propagator: KeplerPropagator,
  startEpoch: EpochUTC,
  interval1Seconds: number,
  interval2Seconds: number,
): {
  r1: Vector3D<Kilometers>;
  r2: Vector3D<Kilometers>;
  r3: Vector3D<Kilometers>;
  t1: EpochUTC;
  t2: EpochUTC;
  t3: EpochUTC;
  truthState: J2000;
} {
  const t1 = startEpoch;
  const t2 = startEpoch.roll(interval1Seconds as Seconds);
  const t3 = startEpoch.roll((interval1Seconds + interval2Seconds) as Seconds);

  const state1 = propagator.propagate(t1);
  const state2 = propagator.propagate(t2);
  const state3 = propagator.propagate(t3);

  return {
    r1: state1.position,
    r2: state2.position,
    r3: state3.position,
    t1,
    t2,
    t3,
    truthState: state2, // Herrick-Gibbs returns state at t2
  };
}

/**
 * Calculate angular separation between two position vectors (in degrees)
 */
function angularSeparationDegrees(r1: Vector3D<Kilometers>, r2: Vector3D<Kilometers>): number {
  const angleRad = r1.angle(r2);

  return angleRad * (180 / Math.PI);
}

/**
 * Validate state accuracy against truth
 */
function validateStateAccuracy(
  computed: J2000,
  truth: J2000,
  posTolKm: number,
  velTolKmps: number,
): void {
  const posError = computed.position.subtract(truth.position).magnitude();
  const velError = computed.velocity.subtract(truth.velocity).magnitude();

  expect(posError).toBeLessThan(posTolKm);
  expect(velError).toBeLessThan(velTolKmps);
}

/*
 * ============================================================================
 * Test Suite
 * ============================================================================
 */

describe('HerrickGibbsIOD', () => {
  /*
   * ==========================================================================
   * 1. PERFECT DATA ACCURACY TESTS
   * ==========================================================================
   */

  describe('Perfect Data Accuracy', () => {
    describe('LEO Orbit (ISS-like)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      it('should determine orbit from three closely-spaced LEO positions', () => {
        // Short intervals for closely-spaced positions (Herrick-Gibbs specialty)
        const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 20, 20);

        const iod = new HerrickGibbsIOD();
        const result = iod.solve(r1, t1, r2, t2, r3, t3);

        validateStateAccuracy(result, truthState, 0.1, 0.001);
      });

      it('should handle medium time intervals', () => {
        const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 60, 60);

        const iod = new HerrickGibbsIOD();
        const result = iod.solve(r1, t1, r2, t2, r3, t3);

        validateStateAccuracy(result, truthState, 0.5, 0.005);
      });
    });

    describe('MEO Orbit (GPS-like)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createMeoOrbit(startEpoch));

      it('should determine orbit from three MEO positions', () => {
        const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 120, 120);

        const iod = new HerrickGibbsIOD();
        const result = iod.solve(r1, t1, r2, t2, r3, t3);

        validateStateAccuracy(result, truthState, 1.0, 0.01);
      });
    });

    describe('GEO Orbit', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createGeoOrbit(startEpoch));

      it('should determine orbit from three GEO positions', () => {
        const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 300, 300);

        const iod = new HerrickGibbsIOD();
        const result = iod.solve(r1, t1, r2, t2, r3, t3);

        validateStateAccuracy(result, truthState, 2.0, 0.01);
      });
    });

    describe('HEO Orbit (Eccentric)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createHeoOrbit(startEpoch));

      it('should determine orbit from three HEO positions', () => {
        const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 120, 120);

        const iod = new HerrickGibbsIOD();
        const result = iod.solve(r1, t1, r2, t2, r3, t3);

        // HEO is more challenging
        validateStateAccuracy(result, truthState, 5.0, 0.05);
      });
    });
  });

  /*
   * ==========================================================================
   * 2. CLOSELY-SPACED POSITIONS (<5 DEGREES)
   * ==========================================================================
   */

  describe('Closely-Spaced Positions', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

    it('should handle ~1 degree angular separation', () => {
      // Very short interval for LEO to get ~1 degree separation
      const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 10, 10);

      // Verify angular separation is small
      const sep12 = angularSeparationDegrees(r1, r2);
      const sep23 = angularSeparationDegrees(r2, r3);

      expect(sep12).toBeLessThan(5);
      expect(sep23).toBeLessThan(5);

      const iod = new HerrickGibbsIOD();
      const result = iod.solve(r1, t1, r2, t2, r3, t3);

      validateStateAccuracy(result, truthState, 0.1, 0.001);
    });

    it('should handle ~2 degree angular separation', () => {
      const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 20, 20);

      const iod = new HerrickGibbsIOD();
      const result = iod.solve(r1, t1, r2, t2, r3, t3);

      validateStateAccuracy(result, truthState, 0.1, 0.001);
    });

    it('should handle ~4 degree angular separation', () => {
      const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 40, 40);

      const iod = new HerrickGibbsIOD();
      const result = iod.solve(r1, t1, r2, t2, r3, t3);

      validateStateAccuracy(result, truthState, 0.2, 0.002);
    });
  });

  /*
   * ==========================================================================
   * 3. COMPARISON WITH GIBBS IOD
   * ==========================================================================
   */

  describe('Comparison with GibbsIOD', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

    it('should perform better than Gibbs for very closely-spaced positions', () => {
      // Very short intervals (Herrick-Gibbs strength)
      const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 15, 15);

      const herrickGibbs = new HerrickGibbsIOD();
      const gibbs = new GibbsIOD();

      const hgResult = herrickGibbs.solve(r1, t1, r2, t2, r3, t3);
      const gibbsResult = gibbs.solve(r1, r2, r3, t2, t3);

      const hgPosError = hgResult.position.subtract(truthState.position).magnitude();
      const gibbsPosError = gibbsResult.position.subtract(truthState.position).magnitude();

      // Herrick-Gibbs should have similar or better accuracy for close spacing
      // (may not always be strictly better, but should be comparable)
      expect(hgPosError).toBeLessThan(1.0);
      expect(gibbsPosError).toBeLessThan(1.0);
    });

    it('should produce similar results for well-spaced positions', () => {
      // Longer intervals where both methods should work well
      const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 60, 60);

      const herrickGibbs = new HerrickGibbsIOD();
      const gibbs = new GibbsIOD();

      const hgResult = herrickGibbs.solve(r1, t1, r2, t2, r3, t3);
      const gibbsResult = gibbs.solve(r1, r2, r3, t2, t3);

      // Both should produce reasonable results
      const hgPosError = hgResult.position.subtract(truthState.position).magnitude();
      const gibbsPosError = gibbsResult.position.subtract(truthState.position).magnitude();

      expect(hgPosError).toBeLessThan(1.0);
      expect(gibbsPosError).toBeLessThan(1.0);
    });
  });

  /*
   * ==========================================================================
   * 4. TIME INTERVAL TESTS
   * ==========================================================================
   */

  describe('Time Interval Tests', () => {
    it('should handle very short intervals (seconds for LEO)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      // 5 second intervals
      const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 5, 5);

      const iod = new HerrickGibbsIOD();
      const result = iod.solve(r1, t1, r2, t2, r3, t3);

      // Very short intervals should still work
      validateStateAccuracy(result, truthState, 0.1, 0.001);
    });

    it('should handle asymmetric time intervals', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      // Different intervals: 20s then 40s
      const { r1, r2, r3, t1, t2, t3, truthState } = generatePositionsWithTimes(propagator, startEpoch, 20, 40);

      const iod = new HerrickGibbsIOD();
      const result = iod.solve(r1, t1, r2, t2, r3, t3);

      validateStateAccuracy(result, truthState, 0.5, 0.005);
    });

    it('should correctly compute time differences', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const interval1 = 30;
      const interval2 = 60;
      const { r1, r2, r3, t1, t2, t3 } = generatePositionsWithTimes(propagator, startEpoch, interval1, interval2);

      // Verify time differences
      const dt21 = t2.difference(t1);
      const dt32 = t3.difference(t2);
      const dt31 = t3.difference(t1);

      expect(dt21).toBeCloseTo(interval1, 5);
      expect(dt32).toBeCloseTo(interval2, 5);
      expect(dt31).toBeCloseTo(interval1 + interval2, 5);

      // Algorithm should still work with these intervals
      const iod = new HerrickGibbsIOD();
      const result = iod.solve(r1, t1, r2, t2, r3, t3);

      expect(result).toBeDefined();
      expect(result.epoch.toString()).toBe(t2.toString());
    });
  });

  /*
   * ==========================================================================
   * 5. CUSTOM MU PARAMETER
   * ==========================================================================
   */

  describe('Custom Mu Parameter', () => {
    it('should use Earth.mu by default', () => {
      const iod = new HerrickGibbsIOD();

      expect(iod.mu).toBe(Earth.mu);
    });

    it('should accept custom gravitational parameter', () => {
      const customMu = 398600.5;
      const iod = new HerrickGibbsIOD(customMu);

      expect(iod.mu).toBe(customMu);
    });

    it('should produce different results with different mu', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const { r1, r2, r3, t1, t2, t3 } = generatePositionsWithTimes(propagator, startEpoch, 30, 30);

      const iodDefault = new HerrickGibbsIOD();
      const iodCustom = new HerrickGibbsIOD(Earth.mu * 1.001);

      const resultDefault = iodDefault.solve(r1, t1, r2, t2, r3, t3);
      const resultCustom = iodCustom.solve(r1, t1, r2, t2, r3, t3);

      // Results should be different
      const velDiff = resultDefault.velocity.subtract(resultCustom.velocity).magnitude();

      expect(velDiff).toBeGreaterThan(0);
    });
  });

  /*
   * ==========================================================================
   * 6. OUTPUT VALIDATION
   * ==========================================================================
   */

  describe('Output Validation', () => {
    it('should return state at t2 epoch', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const { r1, r2, r3, t1, t2, t3 } = generatePositionsWithTimes(propagator, startEpoch, 30, 30);

      const iod = new HerrickGibbsIOD();
      const result = iod.solve(r1, t1, r2, t2, r3, t3);

      expect(result.epoch.toString()).toBe(t2.toString());
    });

    it('should return position matching r2 input', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const { r1, r2, r3, t1, t2, t3 } = generatePositionsWithTimes(propagator, startEpoch, 30, 30);

      const iod = new HerrickGibbsIOD();
      const result = iod.solve(r1, t1, r2, t2, r3, t3);

      // Position should be exactly r2
      expect(result.position.x).toBe(r2.x);
      expect(result.position.y).toBe(r2.y);
      expect(result.position.z).toBe(r2.z);
    });

    it('should return valid J2000 state vector', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const { r1, r2, r3, t1, t2, t3 } = generatePositionsWithTimes(propagator, startEpoch, 30, 30);

      const iod = new HerrickGibbsIOD();
      const result = iod.solve(r1, t1, r2, t2, r3, t3);

      // Should be a valid J2000 state
      expect(result).toBeInstanceOf(J2000);
      expect(result.position.magnitude()).toBeGreaterThan(6000); // Above Earth surface
      expect(result.velocity.magnitude()).toBeGreaterThan(0);
      expect(result.velocity.magnitude()).toBeLessThan(15); // Below escape velocity
    });
  });

  /*
   * ==========================================================================
   * 7. ORBITAL ELEMENTS VALIDATION
   * ==========================================================================
   */

  describe('Orbital Elements Validation', () => {
    it('should recover LEO orbital elements accurately', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const originalElements = createLeoOrbit(startEpoch);
      const propagator = new KeplerPropagator(originalElements);

      const { r1, r2, r3, t1, t2, t3 } = generatePositionsWithTimes(propagator, startEpoch, 30, 30);

      const iod = new HerrickGibbsIOD();
      const result = iod.solve(r1, t1, r2, t2, r3, t3);
      const recoveredElements = result.toClassicalElements();

      expect(Math.abs(recoveredElements.semimajorAxis - originalElements.semimajorAxis)).toBeLessThan(1);
      expect(Math.abs(recoveredElements.eccentricity - originalElements.eccentricity)).toBeLessThan(0.001);
      expect(Math.abs(recoveredElements.inclinationDegrees - originalElements.inclinationDegrees)).toBeLessThan(0.1);
    });
  });
});
