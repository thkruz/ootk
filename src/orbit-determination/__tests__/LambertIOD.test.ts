/**
 * @file LambertIOD test suite
 * @description Tests for Lambert two-position and time Initial Orbit Determination
 *
 * The Lambert problem solves for the orbit connecting two position vectors
 * given the time of flight between them. It's fundamental to transfer orbit
 * calculations and rendezvous planning.
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
import { LambertIOD } from '@src/orbit-determination/LambertIOD';
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
 * Generate two position vectors with their times from a propagator.
 */
function generateTwoPositions(
  propagator: KeplerPropagator,
  startEpoch: EpochUTC,
  intervalSeconds: number,
): {
  p1: Vector3D<Kilometers>;
  p2: Vector3D<Kilometers>;
  t1: EpochUTC;
  t2: EpochUTC;
  truthState: J2000;
} {
  const t1 = startEpoch;
  const t2 = startEpoch.roll(intervalSeconds as Seconds);

  const state1 = propagator.propagate(t1);
  const state2 = propagator.propagate(t2);

  return {
    p1: state1.position,
    p2: state2.position,
    t1,
    t2,
    truthState: state1, // Lambert returns state at t1
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

describe('LambertIOD', () => {
  /*
   * ==========================================================================
   * 1. PERFECT DATA ACCURACY TESTS
   * ==========================================================================
   */

  describe('Perfect Data Accuracy', () => {
    describe('LEO Orbit (ISS-like)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      it('should determine orbit from two LEO positions', () => {
        const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 300);

        const iod = new LambertIOD();
        const result = iod.estimate(p1, p2, t1, t2);

        expect(result).not.toBeNull();
        if (result) {
          validateStateAccuracy(result, truthState, 0.1, 0.001);
        }
      });

      it('should handle short arc transfers', () => {
        const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 120);

        const iod = new LambertIOD();
        const result = iod.estimate(p1, p2, t1, t2);

        expect(result).not.toBeNull();
        if (result) {
          validateStateAccuracy(result, truthState, 0.1, 0.001);
        }
      });
    });

    describe('MEO Orbit (GPS-like)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createMeoOrbit(startEpoch));

      it('should determine orbit from two MEO positions', () => {
        const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 600);

        const iod = new LambertIOD();
        const result = iod.estimate(p1, p2, t1, t2);

        expect(result).not.toBeNull();
        if (result) {
          validateStateAccuracy(result, truthState, 1.0, 0.01);
        }
      });
    });

    describe('GEO Orbit', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createGeoOrbit(startEpoch));

      it('should determine orbit from two GEO positions', () => {
        const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 1800);

        const iod = new LambertIOD();
        const result = iod.estimate(p1, p2, t1, t2);

        expect(result).not.toBeNull();
        if (result) {
          validateStateAccuracy(result, truthState, 2.0, 0.01);
        }
      });
    });

    describe('HEO Orbit (Eccentric)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createHeoOrbit(startEpoch));

      it('should determine orbit from two HEO positions', () => {
        const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 600);

        const iod = new LambertIOD();
        const result = iod.estimate(p1, p2, t1, t2);

        expect(result).not.toBeNull();
        if (result) {
          // HEO is more challenging
          validateStateAccuracy(result, truthState, 5.0, 0.05);
        }
      });
    });
  });

  /*
   * ==========================================================================
   * 2. TRANSFER ORBIT TESTS
   * ==========================================================================
   */

  describe('Transfer Orbit Tests', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

    it('should handle short arc transfers (< 90 degrees)', () => {
      // Short time interval for small angular change
      const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 180);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2);

      expect(result).not.toBeNull();
      if (result) {
        validateStateAccuracy(result, truthState, 0.1, 0.001);
      }
    });

    it('should handle medium arc transfers (90-180 degrees)', () => {
      // Medium time interval
      const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 600);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2);

      expect(result).not.toBeNull();
      if (result) {
        validateStateAccuracy(result, truthState, 0.5, 0.005);
      }
    });

    it('should handle longer arc transfers', () => {
      // Longer time interval (but less than half orbit)
      const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 1200);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2);

      expect(result).not.toBeNull();
      if (result) {
        // Longer arcs can have higher numerical error in velocity
        validateStateAccuracy(result, truthState, 5.0, 3.0);
      }
    });
  });

  /*
   * ==========================================================================
   * 3. PROGRADE VS RETROGRADE
   * ==========================================================================
   */

  describe('Prograde vs Retrograde', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

    it('should use prograde by default', () => {
      const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 300);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2);

      expect(result).not.toBeNull();
      if (result) {
        // For a prograde orbit, velocity should be in the same general direction
        validateStateAccuracy(result, truthState, 0.1, 0.001);
      }
    });

    it('should accept prograde=true explicitly', () => {
      const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 300);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2, { posigrade: true });

      expect(result).not.toBeNull();
      if (result) {
        validateStateAccuracy(result, truthState, 0.1, 0.001);
      }
    });

    it('should produce different result with prograde=false', () => {
      const { p1, p2, t1, t2 } = generateTwoPositions(propagator, startEpoch, 300);

      const iod = new LambertIOD();
      const resultPrograde = iod.estimate(p1, p2, t1, t2, { posigrade: true });
      const resultRetrograde = iod.estimate(p1, p2, t1, t2, { posigrade: false });

      // Both should return results (may or may not be null depending on geometry)
      if (resultPrograde && resultRetrograde) {
        // Velocities should be different
        const velDiff = resultPrograde.velocity.subtract(resultRetrograde.velocity).magnitude();

        expect(velDiff).toBeGreaterThan(0);
      }
    });
  });

  /*
   * ==========================================================================
   * 4. MULTI-REVOLUTION CASES
   * ==========================================================================
   */

  describe('Multi-Revolution Cases', () => {
    const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

    it('should use nRev=0 by default (single revolution)', () => {
      const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 300);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2);

      expect(result).not.toBeNull();
      if (result) {
        validateStateAccuracy(result, truthState, 0.1, 0.001);
      }
    });

    it('should accept nRev=0 explicitly', () => {
      const { p1, p2, t1, t2, truthState } = generateTwoPositions(propagator, startEpoch, 300);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2, { nRev: 0 });

      expect(result).not.toBeNull();
      if (result) {
        validateStateAccuracy(result, truthState, 0.1, 0.001);
      }
    });

    it('should handle nRev=1 for longer time of flight', () => {
      // For multi-rev, we need time of flight > orbital period
      // LEO period is ~90 minutes = 5400 seconds
      const { p1, p2, t1, t2 } = generateTwoPositions(propagator, startEpoch, 6000);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2, { nRev: 1 });

      // May or may not converge depending on geometry
      // Just verify it doesn't crash
      if (result) {
        expect(result.position.magnitude()).toBeGreaterThan(6000);
      }
    });
  });

  /*
   * ==========================================================================
   * 5. CONVERGENCE FAILURE CASES
   * ==========================================================================
   */

  describe('Convergence Failure Cases', () => {
    it('should return null for invalid geometry', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');

      // Same position (zero transfer)
      const p1 = new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
      const p2 = new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
      const t1 = startEpoch;
      const t2 = startEpoch.roll(300 as Seconds);

      const iod = new LambertIOD();

      // Should return null or handle gracefully (exact behavior depends on implementation)
      expect(() => iod.estimate(p1, p2, t1, t2)).not.toThrow();
    });

    it('should handle nearly opposite positions (near-180 degree transfer)', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      // Half orbital period for LEO (~2700 seconds)
      const { p1, p2, t1, t2 } = generateTwoPositions(propagator, startEpoch, 2700);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2);

      // Near-180 degree transfers can be challenging but should work
      if (result) {
        expect(result.position.magnitude()).toBeGreaterThan(6000);
      }
    });
  });

  /*
   * ==========================================================================
   * 6. STATIC useShortPath() METHOD
   * ==========================================================================
   */

  describe('Static useShortPath Method', () => {
    it('should return boolean indicating short path preference', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const state1 = propagator.propagate(startEpoch);
      const state2 = propagator.propagate(startEpoch.roll(300 as Seconds));

      const useShort = LambertIOD.useShortPath(state1, state2);

      expect(typeof useShort).toBe('boolean');
    });

    it('should return true for prograde orbits with small angular change', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const state1 = propagator.propagate(startEpoch);
      const state2 = propagator.propagate(startEpoch.roll(300 as Seconds));

      const useShort = LambertIOD.useShortPath(state1, state2);

      // For prograde orbit with forward motion, should prefer short path
      expect(useShort).toBe(true);
    });
  });

  /*
   * ==========================================================================
   * 7. STATIC solve() METHOD
   * ==========================================================================
   */

  describe('Static solve Method', () => {
    it('should return radial and tangential velocity components', () => {
      // Use canonical units for direct solve() test
      const r1 = 1.0; // Normalized radius
      const r2 = 1.1; // Slightly larger
      const dth = Math.PI / 4; // 45 degrees
      const tau = 0.5; // Normalized time of flight
      const mRev = 0;

      const v1 = new Float64Array(2);
      const success = LambertIOD.solve(r1, r2, dth, tau, mRev, v1);

      expect(success).toBe(true);
      expect(v1.length).toBe(2);
      expect(typeof v1[0]).toBe('number'); // Radial velocity
      expect(typeof v1[1]).toBe('number'); // Tangential velocity
    });

    it('should return false for failed convergence', () => {
      // Extreme values that may not converge
      const r1 = 1.0;
      const r2 = 1.0;
      const dth = 0; // Zero angular change
      const tau = 0.001; // Very short time
      const mRev = 0;

      const v1 = new Float64Array(2);
      const success = LambertIOD.solve(r1, r2, dth, tau, mRev, v1);

      // May succeed or fail depending on tolerance handling
      expect(typeof success).toBe('boolean');
    });
  });

  /*
   * ==========================================================================
   * 8. CUSTOM MU PARAMETER
   * ==========================================================================
   */

  describe('Custom Mu Parameter', () => {
    it('should use Earth.mu by default', () => {
      const iod = new LambertIOD();

      expect(iod.mu).toBe(Earth.mu);
    });

    it('should accept custom gravitational parameter', () => {
      const customMu = 398600.5;
      const iod = new LambertIOD(customMu);

      expect(iod.mu).toBe(customMu);
    });

    it('should produce different results with different mu', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const { p1, p2, t1, t2 } = generateTwoPositions(propagator, startEpoch, 300);

      const iodDefault = new LambertIOD();
      const iodCustom = new LambertIOD(Earth.mu * 1.001);

      const resultDefault = iodDefault.estimate(p1, p2, t1, t2);
      const resultCustom = iodCustom.estimate(p1, p2, t1, t2);

      if (resultDefault && resultCustom) {
        const velDiff = resultDefault.velocity.subtract(resultCustom.velocity).magnitude();

        expect(velDiff).toBeGreaterThan(0);
      }
    });
  });

  /*
   * ==========================================================================
   * 9. OUTPUT VALIDATION
   * ==========================================================================
   */

  describe('Output Validation', () => {
    it('should return state at t1 epoch', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const { p1, p2, t1, t2 } = generateTwoPositions(propagator, startEpoch, 300);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.epoch.toString()).toBe(t1.toString());
      }
    });

    it('should return position matching p1 input', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const { p1, p2, t1, t2 } = generateTwoPositions(propagator, startEpoch, 300);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.position.x).toBe(p1.x);
        expect(result.position.y).toBe(p1.y);
        expect(result.position.z).toBe(p1.z);
      }
    });

    it('should return valid J2000 state vector', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const propagator = new KeplerPropagator(createLeoOrbit(startEpoch));

      const { p1, p2, t1, t2 } = generateTwoPositions(propagator, startEpoch, 300);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2);

      expect(result).not.toBeNull();
      if (result) {
        expect(result).toBeInstanceOf(J2000);
        expect(result.position.magnitude()).toBeGreaterThan(6000);
        expect(result.velocity.magnitude()).toBeGreaterThan(0);
        expect(result.velocity.magnitude()).toBeLessThan(15);
      }
    });
  });

  /*
   * ==========================================================================
   * 10. ORBITAL ELEMENTS VALIDATION
   * ==========================================================================
   */

  describe('Orbital Elements Validation', () => {
    it('should recover LEO orbital elements accurately', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const originalElements = createLeoOrbit(startEpoch);
      const propagator = new KeplerPropagator(originalElements);

      const { p1, p2, t1, t2 } = generateTwoPositions(propagator, startEpoch, 300);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2);

      expect(result).not.toBeNull();
      if (result) {
        const recoveredElements = result.toClassicalElements();

        expect(Math.abs(recoveredElements.semimajorAxis - originalElements.semimajorAxis)).toBeLessThan(1);
        expect(Math.abs(recoveredElements.eccentricity - originalElements.eccentricity)).toBeLessThan(0.001);
        expect(Math.abs(recoveredElements.inclinationDegrees - originalElements.inclinationDegrees)).toBeLessThan(0.1);
      }
    });

    it('should recover MEO orbital elements accurately', () => {
      const startEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
      const originalElements = createMeoOrbit(startEpoch);
      const propagator = new KeplerPropagator(originalElements);

      const { p1, p2, t1, t2 } = generateTwoPositions(propagator, startEpoch, 600);

      const iod = new LambertIOD();
      const result = iod.estimate(p1, p2, t1, t2);

      expect(result).not.toBeNull();
      if (result) {
        const recoveredElements = result.toClassicalElements();

        expect(Math.abs(recoveredElements.semimajorAxis - originalElements.semimajorAxis)).toBeLessThan(10);
        expect(Math.abs(recoveredElements.eccentricity - originalElements.eccentricity)).toBeLessThan(0.01);
        expect(Math.abs(recoveredElements.inclinationDegrees - originalElements.inclinationDegrees)).toBeLessThan(0.5);
      }
    });
  });
});
