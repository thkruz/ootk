/**
 * Integration test: Propagator functionality
 */
import {
  ClassicalElements,
  EpochUTC,
  KeplerPropagator,
  Kilometers,
  Radians,
  Seconds,
  Sgp4Propagator,
  Tle,
  TleLine1,
  TleLine2,
} from '../../dist/main.js';
import { ISS_TLE } from './lib/testData';

describe('Propagator Integration', () => {
  describe('SGP4 Propagator', () => {
    let tle: Tle;
    let propagator: Sgp4Propagator;

    beforeEach(() => {
      tle = new Tle(ISS_TLE.line1 as TleLine1, ISS_TLE.line2 as TleLine2);
      propagator = new Sgp4Propagator(tle);
    });

    it('should create propagator from TLE', () => {
      expect(propagator).toBeDefined();
      expect(propagator.state).toBeDefined();
    });

    it('should have initial state with position and velocity', () => {
      const state = propagator.state;

      expect(state.position).toBeDefined();
      expect(state.velocity).toBeDefined();
      expect(state.epoch).toBeDefined();
    });

    it('should propagate to future epoch', () => {
      const now = EpochUTC.now();
      const future = now.roll(3600 as Seconds); // 1 hour ahead

      const state = propagator.propagate(future);

      expect(state).toBeDefined();
      expect(state.position).toBeDefined();
      expect(state.velocity).toBeDefined();
    });

    it('should produce different positions at different times', () => {
      const now = EpochUTC.now();
      const state1 = propagator.propagate(now);

      const future = now.roll(600 as Seconds); // 10 minutes ahead
      const state2 = propagator.propagate(future);

      // Positions should differ
      expect(state1.position.x).not.toBeCloseTo(state2.position.x, 0);
    });

    it('should maintain consistent altitude for circular orbit', () => {
      const now = EpochUTC.now();
      const state1 = propagator.propagate(now);
      const r1 = state1.position.magnitude();

      const halfOrbit = now.roll((92 * 60 / 2) as Seconds); // Half orbital period
      const state2 = propagator.propagate(halfOrbit);
      const r2 = state2.position.magnitude();

      // Altitude should be similar (ISS has low eccentricity)
      expect(Math.abs(r1 - r2)).toBeLessThan(50); // Within 50 km
    });

    it('should support checkpoint and restore', () => {
      const now = EpochUTC.now();
      const initialState = propagator.state;
      const checkpoint = propagator.checkpoint();

      // Propagate forward
      propagator.propagate(now.roll(3600 as Seconds));

      // Restore
      propagator.restore(checkpoint);

      // State should match initial
      expect(propagator.state.position.x).toBeCloseTo(initialState.position.x, 5);
    });

    it('should reset to initial state', () => {
      const initialState = propagator.state;
      const now = EpochUTC.now();

      propagator.propagate(now.roll(3600 as Seconds));
      propagator.reset();

      expect(propagator.state.position.x).toBeCloseTo(initialState.position.x, 5);
    });
  });

  describe('Kepler Propagator', () => {
    let elements: ClassicalElements;
    let propagator: KeplerPropagator;
    let epoch: EpochUTC;

    beforeEach(() => {
      epoch = EpochUTC.fromDateTimeString('2024-06-15T12:00:00Z');
      elements = new ClassicalElements({
        epoch,
        semimajorAxis: 6943.5 as Kilometers,
        eccentricity: 0.001,
        inclination: (51.6 * Math.PI / 180) as Radians,
        rightAscension: 0.5 as Radians,
        argPerigee: 0.5 as Radians,
        trueAnomaly: 0.5 as Radians,
      });

      propagator = new KeplerPropagator(elements);
    });

    it('should create propagator from state vector', () => {
      expect(propagator).toBeDefined();
      expect(propagator.state).toBeDefined();
    });

    it('should propagate forward in time', () => {
      const future = epoch.roll(3600 as Seconds);
      const state = propagator.propagate(future);

      expect(state).toBeDefined();
      expect(state.position.magnitude()).toBeGreaterThan(6000);
    });

    it('should conserve orbital energy (two-body)', () => {
      const state1 = propagator.state;
      const r1 = state1.position.magnitude();
      const v1 = state1.velocity.magnitude();
      const energy1 = (v1 ** 2) / 2 - 398600.4418 / r1;

      const future = epoch.roll(3600 as Seconds);
      const state2 = propagator.propagate(future);
      const r2 = state2.position.magnitude();
      const v2 = state2.velocity.magnitude();
      const energy2 = (v2 ** 2) / 2 - 398600.4418 / r2;

      // Energy should be conserved
      expect(energy1).toBeCloseTo(energy2, 3);
    });
  });
});
