/**
 * Integration test: Numerical integrators and propagators
 * Migrated from examples/integrator.ts
 */
import {
  EpochUTC,
  ForceModel,
  RungeKutta4Propagator,
  RungeKutta89Propagator,
  Satellite,
  TleLine1,
  TleLine2,
} from '../../dist/main.js';
import { ISS_TLE } from './lib/testData';

describe('Numerical Integrators', () => {
  const start = new Date(2024, 0, 28, 0, 0, 0, 0);
  const stop = new Date(2024, 0, 29, 0, 0, 0, 0);
  const stopEpoch = EpochUTC.fromDateTime(stop);

  const sat = new Satellite({
    tle1: ISS_TLE.line1 as TleLine1,
    tle2: ISS_TLE.line2 as TleLine2,
  });

  describe('ForceModel Configuration', () => {
    it('should create a force model with Earth gravity', () => {
      const forceModel = new ForceModel();

      forceModel.setEarthGravity(8, 8);

      expect(forceModel).toBeDefined();
    });

    it('should configure third body gravity', () => {
      const forceModel = new ForceModel();

      forceModel.setThirdBodyGravity({
        moon: true,
        sun: true,
      });

      expect(forceModel).toBeDefined();
    });

    it('should configure solar radiation pressure', () => {
      const forceModel = new ForceModel();

      forceModel.setSolarRadiationPressure(1000, 400);

      expect(forceModel).toBeDefined();
    });

    it('should configure atmospheric drag', () => {
      const forceModel = new ForceModel();

      forceModel.setAtmosphericDrag(1000, 400);

      expect(forceModel).toBeDefined();
    });
  });

  describe('SGP4 Propagation Baseline', () => {
    it('should propagate using SGP4', () => {
      const state = sat.eci(stop);

      expect(state).not.toBeNull();
      expect(state!.position).toBeDefined();
      expect(state!.velocity).toBeDefined();

      // Verify position is reasonable for LEO
      const r = Math.sqrt(
        state!.position.x ** 2 +
        state!.position.y ** 2 +
        state!.position.z ** 2,
      );

      expect(r).toBeGreaterThan(6400);
      expect(r).toBeLessThan(7000);
    });
  });

  describe('RungeKutta4 Propagator', () => {
    it('should propagate state with RK4', () => {
      const forceModel = new ForceModel();

      forceModel.setEarthGravity(8, 8);
      forceModel.setThirdBodyGravity({ moon: true, sun: true });
      forceModel.setSolarRadiationPressure(1000, 400);
      forceModel.setAtmosphericDrag(1000, 400);

      const initialState = sat.toJ2000(start);
      const rk4 = new RungeKutta4Propagator(initialState, forceModel);

      const propagatedState = rk4.propagate(stopEpoch);

      expect(propagatedState).toBeDefined();
      expect(propagatedState.position).toBeDefined();
      expect(propagatedState.velocity).toBeDefined();

      // Verify position is reasonable for LEO
      const r = Math.sqrt(
        propagatedState.position.x ** 2 +
        propagatedState.position.y ** 2 +
        propagatedState.position.z ** 2,
      );

      expect(r).toBeGreaterThan(6400);
      expect(r).toBeLessThan(7000);
    });
  });

  describe('RungeKutta89 Propagator', () => {
    it('should propagate state with RK89', () => {
      const forceModel = new ForceModel();

      forceModel.setEarthGravity(8, 8);
      forceModel.setThirdBodyGravity({ moon: true, sun: true });
      forceModel.setSolarRadiationPressure(1000, 400);
      forceModel.setAtmosphericDrag(1000, 400);

      const initialState = sat.toJ2000(start);
      const rk89 = new RungeKutta89Propagator(initialState, forceModel);

      const propagatedState = rk89.propagate(stopEpoch);

      expect(propagatedState).toBeDefined();
      expect(propagatedState.position).toBeDefined();
      expect(propagatedState.velocity).toBeDefined();

      // Verify position is reasonable for LEO
      const r = Math.sqrt(
        propagatedState.position.x ** 2 +
        propagatedState.position.y ** 2 +
        propagatedState.position.z ** 2,
      );

      expect(r).toBeGreaterThan(6400);
      expect(r).toBeLessThan(7000);
    });

    it('should produce state vectors with velocity', () => {
      const forceModel = new ForceModel();

      forceModel.setEarthGravity(4, 4);

      const initialState = sat.toJ2000(start);
      const rk89 = new RungeKutta89Propagator(initialState, forceModel);

      const propagatedState = rk89.propagate(stopEpoch);

      // Velocity should be reasonable for LEO (~7.5 km/s)
      const v = Math.sqrt(
        propagatedState.velocity.x ** 2 +
        propagatedState.velocity.y ** 2 +
        propagatedState.velocity.z ** 2,
      );

      expect(v).toBeGreaterThan(7);
      expect(v).toBeLessThan(8);
    });
  });

  describe('Propagator Comparison', () => {
    it('should produce similar results between RK4 and RK89 for short propagation', () => {
      const forceModel = new ForceModel();

      forceModel.setEarthGravity(4, 4);

      const initialState = sat.toJ2000(start);
      const shortEpoch = EpochUTC.fromDateTime(new Date(start.getTime() + 3600000)); // 1 hour

      const rk4 = new RungeKutta4Propagator(initialState, forceModel);
      const rk89 = new RungeKutta89Propagator(initialState, forceModel);

      const state4 = rk4.propagate(shortEpoch);
      const state89 = rk89.propagate(shortEpoch);

      // Positions should be reasonably close (within a few km for 1 hour)
      const dx = state4.position.x - state89.position.x;
      const dy = state4.position.y - state89.position.y;
      const dz = state4.position.z - state89.position.z;
      const posDiff = Math.sqrt(dx * dx + dy * dy + dz * dz);

      expect(posDiff).toBeLessThan(50); // Within 50 km
    });
  });
});
