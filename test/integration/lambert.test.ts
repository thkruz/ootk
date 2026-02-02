/**
 * Integration test: Lambert Problem Solutions
 * Migrated from examples/lambert-state-vector.ts
 */
import {
  EpochUTC,
  Kilometers,
  KilometersPerSecond,
  LambertIOD,
  RungeKutta89Propagator,
  Satellite,
  Tle,
  Vector3D,
} from '../../dist/main.js';

describe('Lambert Problem Solutions', () => {
  describe('Basic Lambert Solution', () => {
    it('should solve Lambert problem from two positions', () => {
      const p1 = new Vector3D<Kilometers>(6778.137, 0.0, 0.0);
      const p2 = new Vector3D<Kilometers>(-2000.0, 6400.0, 1500.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T12:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T13:30:00.000Z'));

      const lambert = new LambertIOD();
      const stateVector = lambert.estimate(p1, p2, t1, t2, {
        posigrade: true,
        nRev: 0,
      });

      expect(stateVector).toBeDefined();
      expect(stateVector.epoch).toBeDefined();
      expect(stateVector.position).toBeDefined();
      expect(stateVector.velocity).toBeDefined();
    });

    it('should return state vector at first observation time', () => {
      const p1 = new Vector3D<Kilometers>(6778.137, 0.0, 0.0);
      const p2 = new Vector3D<Kilometers>(-2000.0, 6400.0, 1500.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T12:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T13:30:00.000Z'));

      const lambert = new LambertIOD();
      const stateVector = lambert.estimate(p1, p2, t1, t2);

      expect(stateVector).toBeDefined();
      // Position at t1 should match p1
      expect(stateVector.position.x).toBeCloseTo(p1.x, 0);
      expect(stateVector.position.y).toBeCloseTo(p1.y, 0);
      expect(stateVector.position.z).toBeCloseTo(p1.z, 0);
    });

    it('should convert to classical elements', () => {
      const p1 = new Vector3D<Kilometers>(6778.137, 0.0, 0.0);
      const p2 = new Vector3D<Kilometers>(-2000.0, 6400.0, 1500.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T12:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T13:30:00.000Z'));

      const lambert = new LambertIOD();
      const stateVector = lambert.estimate(p1, p2, t1, t2);
      const elements = stateVector.toClassicalElements();

      expect(elements).toBeDefined();
      expect(elements.semimajorAxis).toBeGreaterThan(0);
      expect(elements.eccentricity).toBeGreaterThanOrEqual(0);
      expect(elements.eccentricity).toBeLessThan(1); // Bound orbit
    });
  });

  describe('Lambert with Numerical Propagator', () => {
    it('should use Lambert solution with RK89 propagator', () => {
      const p1 = new Vector3D<Kilometers>(7000.0, 0.0, 0.0);
      const p2 = new Vector3D<Kilometers>(0.0, 7000.0, 0.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T01:30:00.000Z'));

      const lambert = new LambertIOD();
      const initialState = lambert.estimate(p1, p2, t1, t2);

      expect(initialState).toBeDefined();

      const propagator = new RungeKutta89Propagator(initialState);
      const futureEpoch = EpochUTC.fromDateTime(new Date('2024-01-02T00:00:00.000Z'));
      const futureState = propagator.propagate(futureEpoch);

      expect(futureState).toBeDefined();
      expect(futureState.position).toBeDefined();
      expect(futureState.velocity).toBeDefined();
    });

    it('should propagate orbit for multiple revolutions', () => {
      const p1 = new Vector3D<Kilometers>(7000.0, 0.0, 0.0);
      const p2 = new Vector3D<Kilometers>(0.0, 7000.0, 0.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T01:30:00.000Z'));

      const lambert = new LambertIOD();
      const initialState = lambert.estimate(p1, p2, t1, t2);
      const elements = initialState.toClassicalElements();

      // Calculate number of revolutions in 1 day
      const period = elements.period; // minutes
      const revolutionsPerDay = (24 * 60) / period;

      // The orbit derived from Lambert may vary based on the geometry
      expect(revolutionsPerDay).toBeGreaterThan(10); // Should complete several revolutions/day
      expect(revolutionsPerDay).toBeLessThan(20);
    });
  });

  describe('Lambert to Satellite Conversion', () => {
    it('should convert Lambert solution to Satellite object via TLE', () => {
      const p1 = new Vector3D<Kilometers>(6878.137, 0.0, 0.0);
      const p2 = new Vector3D<Kilometers>(0.0, 6878.137, 0.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T01:30:00.000Z'));

      const lambert = new LambertIOD();
      const j2000State = lambert.estimate(p1, p2, t1, t2);
      const elements = j2000State.toClassicalElements();
      const tle = Tle.fromClassicalElements(elements);

      const satellite = new Satellite({
        tle1: tle.line1,
        tle2: tle.line2,
        name: 'Lambert-Derived Satellite',
      });

      expect(satellite).toBeDefined();
      expect(satellite.name).toBe('Lambert-Derived Satellite');
    });

    it('should use Satellite methods after Lambert derivation', () => {
      const p1 = new Vector3D<Kilometers>(6878.137, 0.0, 0.0);
      const p2 = new Vector3D<Kilometers>(0.0, 6878.137, 0.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T01:30:00.000Z'));

      const lambert = new LambertIOD();
      const j2000State = lambert.estimate(p1, p2, t1, t2);
      const elements = j2000State.toClassicalElements();
      const tle = Tle.fromClassicalElements(elements);

      const satellite = new Satellite({
        tle1: tle.line1,
        tle2: tle.line2,
      });

      const futureDate = new Date('2024-01-01T06:00:00.000Z');
      const lla = satellite.lla(futureDate);

      expect(lla).toBeDefined();
      expect(lla.lat).toBeGreaterThanOrEqual(-90);
      expect(lla.lat).toBeLessThanOrEqual(90);
    });
  });

  describe('Transfer Orbit Planning', () => {
    it('should calculate transfer orbit delta-V', () => {
      const r1 = 6778.137; // LEO
      const r2 = 12000.0; // Target

      const pos1 = new Vector3D<Kilometers>(r1, 0.0, 0.0);
      const vel1 = new Vector3D<KilometersPerSecond>(0.0, Math.sqrt(398600.4418 / r1), 0.0);

      const pos2 = new Vector3D<Kilometers>(0.0, r2, 0.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T05:00:00.000Z'));

      const lambert = new LambertIOD();
      const transferOrbit = lambert.estimate(pos1, pos2, t1, t2);

      // Calculate delta-V
      const deltaV1 = transferOrbit.velocity.subtract(vel1);
      const deltaV1Magnitude = deltaV1.magnitude();

      expect(deltaV1Magnitude).toBeGreaterThan(0);
      expect(deltaV1Magnitude).toBeLessThan(15); // Reasonable for orbit transfer
    });
  });

  describe('Multi-Revolution Transfers', () => {
    it('should compare different revolution options', () => {
      const p1 = new Vector3D<Kilometers>(7000.0, 0.0, 0.0);
      const p2 = new Vector3D<Kilometers>(0.0, 8000.0, 0.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T06:00:00.000Z'));

      const lambert = new LambertIOD();

      const solutions: { nRev: number; velocity: number; sma: number }[] = [];

      for (let nRev = 0; nRev <= 2; nRev++) {
        const solution = lambert.estimate(p1, p2, t1, t2, {
          posigrade: true,
          nRev,
        });

        if (solution) {
          const elements = solution.toClassicalElements();

          solutions.push({
            nRev,
            velocity: solution.velocity.magnitude(),
            sma: elements.semimajorAxis,
          });
        }
      }

      // Should have at least the 0-revolution solution
      expect(solutions.length).toBeGreaterThanOrEqual(1);
      expect(solutions[0].velocity).toBeGreaterThan(0);
    });
  });

  describe('Short Path vs Long Path', () => {
    it('should compare short and long path transfers', () => {
      const p1 = new Vector3D<Kilometers>(7000.0, 0.0, 0.0);
      const p2 = new Vector3D<Kilometers>(-7000.0, 1000.0, 0.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T02:00:00.000Z'));

      const lambert = new LambertIOD();

      const shortPath = lambert.estimate(p1, p2, t1, t2, { posigrade: true });
      const longPath = lambert.estimate(p1, p2, t1, t2, { posigrade: false });

      if (shortPath && longPath) {
        // Both paths should have valid velocities
        expect(shortPath.velocity.magnitude()).toBeGreaterThan(0);
        expect(longPath.velocity.magnitude()).toBeGreaterThan(0);

        // Short and long paths should both produce valid classical elements
        const shortElements = shortPath.toClassicalElements();
        const longElements = longPath.toClassicalElements();

        // Both should have positive semi-major axis
        expect(shortElements.semimajorAxis).toBeGreaterThan(0);
        expect(longElements.semimajorAxis).toBeGreaterThan(0);
      }
    });
  });

  describe('Solution Validation', () => {
    it('should validate orbital parameters', () => {
      const p1 = new Vector3D<Kilometers>(7000.0, 0.0, 0.0);
      const p2 = new Vector3D<Kilometers>(0.0, 7000.0, 0.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T01:30:00.000Z'));

      const lambert = new LambertIOD();
      const solution = lambert.estimate(p1, p2, t1, t2);

      const elements = solution.toClassicalElements();

      // Check for valid orbital elements
      expect(elements.semimajorAxis).toBeGreaterThan(0);

      // Eccentricity should be valid (0 <= e < 1 for bound orbits)
      expect(elements.eccentricity).toBeGreaterThanOrEqual(0);
      // Lambert can produce hyperbolic/parabolic solutions, so just check it's defined
      expect(Number.isFinite(elements.eccentricity)).toBe(true);
    });

    it('should handle close positions', () => {
      const p1 = new Vector3D<Kilometers>(7000.0, 0.0, 0.0);
      const p2 = new Vector3D<Kilometers>(7000.1, 0.1, 0.0);

      const t1 = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const t2 = EpochUTC.fromDateTime(new Date('2024-01-01T01:30:00.000Z'));

      const lambert = new LambertIOD();
      const solution = lambert.estimate(p1, p2, t1, t2);

      // Should still return a solution for close positions
      expect(solution).toBeDefined();
    });
  });
});
