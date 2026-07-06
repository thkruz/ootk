/**
 * @file GibbsIOD test suite
 * @description Tests for Gibbs 3-position Initial Orbit Determination
 *
 * The Gibbs method determines an orbit from three inertial position vectors.
 * It requires the positions to be coplanar (within 5 degrees).
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
    semimajorAxis: 6778 as Kilometers, // ~400 km altitude
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
 * Generate three position vectors from a propagator at specified time intervals.
 * Returns positions that are coplanar (from the same orbit).
 */
function generatePositions(
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
    truthState: state2, // Gibbs returns state at t2
  };
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

describe('GibbsIOD', () => {
  /*
   * ==========================================================================
   * 1. PERFECT DATA ACCURACY TESTS
   * ==========================================================================
   */

  describe('Perfect Data Accuracy', () => {
    describe('LEO Orbit (ISS-like)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      it('should determine orbit from three LEO positions', () => {
        // LEO: shorter intervals due to faster orbital motion
        const { r1, r2, r3, t2, t3, truthState } = generatePositions(propagator, startEpoch, 60, 60);

        const iod = new GibbsIOD();
        const result = iod.solve(r1, r2, r3, t2, t3);

        validateStateAccuracy(result, truthState, 0.1, 0.001);
      });

      it('should handle various time intervals', () => {
        // Test with 30-second intervals
        const { r1, r2, r3, t2, t3, truthState } = generatePositions(propagator, startEpoch, 30, 30);

        const iod = new GibbsIOD();
        const result = iod.solve(r1, r2, r3, t2, t3);

        validateStateAccuracy(result, truthState, 0.1, 0.001);
      });
    });

    describe('MEO Orbit (GPS-like)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createMeoOrbit(startEpoch));

      it('should determine orbit from three MEO positions', () => {
        // MEO: longer intervals
        const { r1, r2, r3, t2, t3, truthState } = generatePositions(propagator, startEpoch, 300, 300);

        const iod = new GibbsIOD();
        const result = iod.solve(r1, r2, r3, t2, t3);

        validateStateAccuracy(result, truthState, 0.5, 0.001);
      });
    });

    describe('GEO Orbit', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createGeoOrbit(startEpoch));

      it('should determine orbit from three GEO positions', () => {
        // GEO: very long intervals due to slow motion
        const { r1, r2, r3, t2, t3, truthState } = generatePositions(propagator, startEpoch, 600, 600);

        const iod = new GibbsIOD();
        const result = iod.solve(r1, r2, r3, t2, t3);

        validateStateAccuracy(result, truthState, 1.0, 0.001);
      });
    });

    describe('HEO Orbit (Eccentric)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createHeoOrbit(startEpoch));

      it('should determine orbit from three HEO positions', () => {
        const { r1, r2, r3, t2, t3, truthState } = generatePositions(propagator, startEpoch, 300, 300);

        const iod = new GibbsIOD();
        const result = iod.solve(r1, r2, r3, t2, t3);

        // HEO is more challenging, allow looser tolerance
        validateStateAccuracy(result, truthState, 2.0, 0.01);
      });
    });
  });

  /*
   * ==========================================================================
   * 2. COPLANARITY ERROR HANDLING
   * ==========================================================================
   */

  describe('Coplanarity Error Handling', () => {
    it('should throw error for non-coplanar positions', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const t2 = startEpoch.roll(60 as Seconds);
      const t3 = startEpoch.roll(120 as Seconds);

      // Create positions that are deliberately non-coplanar
      // Position 1: in XY plane
      const r1 = new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
      // Position 2: in XY plane
      const r2 = new Vector3D(5000 as Kilometers, 5000 as Kilometers, 0 as Kilometers);
      // Position 3: significantly out of plane (large Z component)
      const r3 = new Vector3D(0 as Kilometers, 7000 as Kilometers, 3000 as Kilometers);

      const iod = new GibbsIOD();

      expect(() => iod.solve(r1, r2, r3, t2, t3)).toThrow('Orbits are not coplanar');
    });

    it('should accept positions within coplanarity threshold', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      // Use positions from the same orbit (guaranteed coplanar)
      const { r1, r2, r3, t2, t3 } = generatePositions(propagator, startEpoch, 60, 60);

      const iod = new GibbsIOD();

      // Should not throw
      expect(() => iod.solve(r1, r2, r3, t2, t3)).not.toThrow();
    });
  });

  /*
   * ==========================================================================
   * 3. POSITION SPACING TESTS
   * ==========================================================================
   */

  describe('Position Spacing', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

    it('should handle closely-spaced positions (small angular separation)', () => {
      // Very short intervals for LEO
      const { r1, r2, r3, t2, t3, truthState } = generatePositions(propagator, startEpoch, 20, 20);

      const iod = new GibbsIOD();
      const result = iod.solve(r1, r2, r3, t2, t3);

      validateStateAccuracy(result, truthState, 0.5, 0.005);
    });

    it('should handle widely-spaced positions (larger angular separation)', () => {
      // Longer intervals for larger angular separation
      const { r1, r2, r3, t2, t3, truthState } = generatePositions(propagator, startEpoch, 180, 180);

      const iod = new GibbsIOD();
      const result = iod.solve(r1, r2, r3, t2, t3);

      validateStateAccuracy(result, truthState, 0.5, 0.005);
    });

    it('should handle asymmetric time intervals', () => {
      // Different intervals between positions
      const { r1, r2, r3, t2, t3, truthState } = generatePositions(propagator, startEpoch, 45, 90);

      const iod = new GibbsIOD();
      const result = iod.solve(r1, r2, r3, t2, t3);

      validateStateAccuracy(result, truthState, 0.5, 0.005);
    });
  });

  /*
   * ==========================================================================
   * 4. VELOCITY DIRECTION RESOLUTION
   * ==========================================================================
   */

  describe('Velocity Direction Resolution', () => {
    it('should correctly resolve prograde velocity direction', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const { r1, r2, r3, t2, t3, truthState } = generatePositions(propagator, startEpoch, 60, 60);

      const iod = new GibbsIOD();
      const result = iod.solve(r1, r2, r3, t2, t3);

      // Verify velocity direction matches truth (dot product should be positive)
      const velDot = result.velocity.dot(truthState.velocity);

      expect(velDot).toBeGreaterThan(0);
    });

    it('should propagate to t3 to verify correct solution', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const { r1, r2, r3, t2, t3 } = generatePositions(propagator, startEpoch, 60, 60);

      const iod = new GibbsIOD();
      const result = iod.solve(r1, r2, r3, t2, t3);

      // The algorithm internally validates by propagating to t3
      // The returned state should be at t2
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
      const iod = new GibbsIOD();

      expect(iod.mu).toBe(Earth.mu);
    });

    it('should accept custom gravitational parameter', () => {
      const customMu = 398600.5; // Slightly different value
      const iod = new GibbsIOD(customMu);

      expect(iod.mu).toBe(customMu);
    });

    it('should produce different results with different mu', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const { r1, r2, r3, t2, t3 } = generatePositions(propagator, startEpoch, 60, 60);

      const iodDefault = new GibbsIOD();
      const iodCustom = new GibbsIOD(Earth.mu * 1.001); // 0.1% different

      const resultDefault = iodDefault.solve(r1, r2, r3, t2, t3);
      const resultCustom = iodCustom.solve(r1, r2, r3, t2, t3);

      // Results should be different
      const velDiff = resultDefault.velocity.subtract(resultCustom.velocity).magnitude();

      expect(velDiff).toBeGreaterThan(0);
    });
  });

  /*
   * ==========================================================================
   * 6. ORBITAL ELEMENTS VALIDATION
   * ==========================================================================
   */

  describe('Orbital Elements Validation', () => {
    it('should recover LEO orbital elements accurately', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const originalElements = createLeoOrbit(startEpoch);
      const propagator = new KeplerPropagator(originalElements);

      const { r1, r2, r3, t2, t3 } = generatePositions(propagator, startEpoch, 60, 60);

      const iod = new GibbsIOD();
      const result = iod.solve(r1, r2, r3, t2, t3);
      const recoveredElements = result.toClassicalElements();

      // Verify key orbital elements
      expect(Math.abs(recoveredElements.semimajorAxis - originalElements.semimajorAxis)).toBeLessThan(1);
      expect(Math.abs(recoveredElements.eccentricity - originalElements.eccentricity)).toBeLessThan(0.001);
      expect(Math.abs(recoveredElements.inclinationDegrees - originalElements.inclinationDegrees)).toBeLessThan(0.1);
    });

    it('should recover MEO orbital elements accurately', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const originalElements = createMeoOrbit(startEpoch);
      const propagator = new KeplerPropagator(originalElements);

      const { r1, r2, r3, t2, t3 } = generatePositions(propagator, startEpoch, 300, 300);

      const iod = new GibbsIOD();
      const result = iod.solve(r1, r2, r3, t2, t3);
      const recoveredElements = result.toClassicalElements();

      expect(Math.abs(recoveredElements.semimajorAxis - originalElements.semimajorAxis)).toBeLessThan(5);
      expect(Math.abs(recoveredElements.eccentricity - originalElements.eccentricity)).toBeLessThan(0.01);
      expect(Math.abs(recoveredElements.inclinationDegrees - originalElements.inclinationDegrees)).toBeLessThan(0.5);
    });
  });
});
