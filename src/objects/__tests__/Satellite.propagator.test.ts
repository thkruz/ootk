import { PropagatorType } from '../../enums/PropagatorType';
import { ForceModel } from '../../force/ForceModel';
import { DormandPrince54Propagator } from '../../propagator/DormandPrince54Propagator';
import { KeplerPropagator } from '../../propagator/KeplerPropagator';
import { RungeKutta4Propagator } from '../../propagator/RungeKutta4Propagator';
import { RungeKutta89Propagator } from '../../propagator/RungeKutta89Propagator';
import { Sgp4Propagator } from '../../propagator/Sgp4Propagator';
import { EpochUTC } from '../../time/EpochUTC';
import { Seconds, TleLine1, TleLine2 } from '../../types/types';
import { Satellite } from '../Satellite';

describe('Satellite Propagator Factory Methods', () => {
  // ISS TLE (epoch: 2024-001 12:00:00 UTC)
  const tle1 = '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002' as TleLine1;
  const tle2 = '2 25544  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550100010' as TleLine2;

  const tleEpochDate = new Date(Date.UTC(2024, 0, 1, 12, 0, 0));
  const oneHourLater = new Date(tleEpochDate.getTime() + 3600_000);
  const oneHourEpoch = EpochUTC.fromDateTime(oneHourLater);

  let sat: Satellite;

  beforeEach(() => {
    sat = new Satellite({ tle1, tle2, name: 'ISS' });
  });

  /** Helper: compute position magnitude from J2000 state. */
  const posMag = (state: { position: { x: number; y: number; z: number } }) =>
    Math.sqrt(state.position.x ** 2 + state.position.y ** 2 + state.position.z ** 2);

  /** Helper: compute velocity magnitude from J2000 state. */
  const velMag = (state: { velocity: { x: number; y: number; z: number } }) =>
    Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2);

  // ==================== createPropagator() ====================

  describe('createPropagator', () => {
    it('should default to RK89 with point-mass gravity', () => {
      const prop = sat.createPropagator(tleEpochDate);

      expect(prop).toBeInstanceOf(RungeKutta89Propagator);

      const state = prop.propagate(oneHourEpoch);

      expect(state).toBeDefined();
      expect(posMag(state)).toBeGreaterThan(6400);
      expect(posMag(state)).toBeLessThan(7000);
      expect(velMag(state)).toBeGreaterThan(7);
      expect(velMag(state)).toBeLessThan(8);
    });

    it('should create SGP4 propagator', () => {
      const prop = sat.createPropagator(tleEpochDate, { type: PropagatorType.SGP4 });

      expect(prop).toBeInstanceOf(Sgp4Propagator);

      const state = prop.propagate(oneHourEpoch);

      expect(state).toBeDefined();
      expect(posMag(state)).toBeGreaterThan(6400);
      expect(posMag(state)).toBeLessThan(7000);
    });

    it('should create Kepler propagator', () => {
      const prop = sat.createPropagator(tleEpochDate, { type: PropagatorType.KEPLER });

      expect(prop).toBeInstanceOf(KeplerPropagator);

      const state = prop.propagate(oneHourEpoch);

      expect(state).toBeDefined();
      expect(posMag(state)).toBeGreaterThan(6400);
      expect(posMag(state)).toBeLessThan(7000);
    });

    it('should create RK4 propagator with custom step size', () => {
      const prop = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.RK4,
        stepSize: 10.0,
      });

      expect(prop).toBeInstanceOf(RungeKutta4Propagator);

      const state = prop.propagate(oneHourEpoch);

      expect(state).toBeDefined();
      expect(posMag(state)).toBeGreaterThan(6400);
      expect(posMag(state)).toBeLessThan(7000);
    });

    it('should create DP54 propagator', () => {
      const prop = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.DP54,
        tolerance: 1e-10,
      });

      expect(prop).toBeInstanceOf(DormandPrince54Propagator);

      const state = prop.propagate(oneHourEpoch);

      expect(state).toBeDefined();
      expect(posMag(state)).toBeGreaterThan(6400);
      expect(posMag(state)).toBeLessThan(7000);
    });

    it('should create RK89 propagator with custom force model', () => {
      const forceModel = new ForceModel();

      forceModel.setEarthGravity(4, 4);
      forceModel.setThirdBodyGravity({ moon: true, sun: true });

      const prop = sat.createPropagator(tleEpochDate, {
        type: PropagatorType.RK89,
        forceModel,
        tolerance: 1e-12,
      });

      expect(prop).toBeInstanceOf(RungeKutta89Propagator);

      const state = prop.propagate(oneHourEpoch);

      expect(state).toBeDefined();
      expect(posMag(state)).toBeGreaterThan(6400);
      expect(posMag(state)).toBeLessThan(7000);
    });

    it('should throw for unknown propagator type', () => {
      expect(() => {
        sat.createPropagator(tleEpochDate, { type: 'INVALID' as PropagatorType });
      }).toThrow('Unknown propagator type');
    });
  });

  // ==================== createSgp4Propagator() ====================

  describe('createSgp4Propagator', () => {
    it('should return an Sgp4Propagator', () => {
      const prop = sat.createSgp4Propagator();

      expect(prop).toBeInstanceOf(Sgp4Propagator);
    });

    it('should propagate to a future epoch', () => {
      const prop = sat.createSgp4Propagator();
      const state = prop.propagate(oneHourEpoch);

      expect(state).toBeDefined();
      expect(posMag(state)).toBeGreaterThan(6400);
      expect(posMag(state)).toBeLessThan(7000);
    });

    it('should support checkpoint and restore', () => {
      const prop = sat.createSgp4Propagator();

      const idx = prop.checkpoint();
      const state1 = prop.propagate(oneHourEpoch);

      prop.restore(idx);
      const stateAfterRestore = prop.state;

      // After restore, state should differ from propagated state
      expect(stateAfterRestore.position.x).not.toBeCloseTo(state1.position.x, 1);
    });
  });

  // ==================== createNumericalPropagator() ====================

  describe('createNumericalPropagator', () => {
    it('should return a RungeKutta89Propagator', () => {
      const prop = sat.createNumericalPropagator(tleEpochDate);

      expect(prop).toBeInstanceOf(RungeKutta89Propagator);
    });

    it('should propagate with default force model', () => {
      const prop = sat.createNumericalPropagator(tleEpochDate);
      const state = prop.propagate(oneHourEpoch);

      expect(state).toBeDefined();
      expect(posMag(state)).toBeGreaterThan(6400);
      expect(posMag(state)).toBeLessThan(7000);
      expect(velMag(state)).toBeGreaterThan(7);
      expect(velMag(state)).toBeLessThan(8);
    });

    it('should accept a custom force model', () => {
      const fm = new ForceModel();

      fm.setEarthGravity(8, 8);
      fm.setThirdBodyGravity({ moon: true, sun: true });

      const prop = sat.createNumericalPropagator(tleEpochDate, fm);
      const state = prop.propagate(oneHourEpoch);

      expect(state).toBeDefined();
      expect(posMag(state)).toBeGreaterThan(6400);
      expect(posMag(state)).toBeLessThan(7000);
    });

    it('should accept custom tolerance', () => {
      const prop = sat.createNumericalPropagator(tleEpochDate, undefined, 1e-12);
      const state = prop.propagate(oneHourEpoch);

      expect(state).toBeDefined();
      expect(posMag(state)).toBeGreaterThan(6400);
      expect(posMag(state)).toBeLessThan(7000);
    });
  });

  // ==================== Propagator API Integration ====================

  describe('Propagator API integration', () => {
    it('should support ephemeris generation', () => {
      const prop = sat.createNumericalPropagator(tleEpochDate);
      const startEpoch = EpochUTC.fromDateTime(tleEpochDate);
      const stopEpoch = EpochUTC.fromDateTime(oneHourLater);

      const ephemeris = prop.ephemeris(startEpoch, stopEpoch, 600 as Seconds);

      expect(ephemeris).toBeDefined();

      // Interpolate at a midpoint
      const midEpoch = EpochUTC.fromDateTime(new Date(tleEpochDate.getTime() + 1800_000));
      const midState = ephemeris.interpolate(midEpoch);

      expect(midState).toBeDefined();
      expect(posMag(midState!)).toBeGreaterThan(6400);
      expect(posMag(midState!)).toBeLessThan(7000);
    });

    it('should support reset', () => {
      const prop = sat.createNumericalPropagator(tleEpochDate);
      const initialState = prop.state;

      prop.propagate(oneHourEpoch);
      prop.reset();

      const resetState = prop.state;

      expect(resetState.position.x).toBeCloseTo(initialState.position.x, 6);
      expect(resetState.position.y).toBeCloseTo(initialState.position.y, 6);
      expect(resetState.position.z).toBeCloseTo(initialState.position.z, 6);
    });

    it('should produce similar results between propagator types for short propagation', () => {
      const fm = new ForceModel().setGravity();
      const tenMinEpoch = EpochUTC.fromDateTime(new Date(tleEpochDate.getTime() + 600_000));

      const rk89 = sat.createPropagator(tleEpochDate, { type: PropagatorType.RK89, forceModel: fm });
      const dp54 = sat.createPropagator(tleEpochDate, { type: PropagatorType.DP54, forceModel: fm });

      const state89 = rk89.propagate(tenMinEpoch);
      const state54 = dp54.propagate(tenMinEpoch);

      const dx = state89.position.x - state54.position.x;
      const dy = state89.position.y - state54.position.y;
      const dz = state89.position.z - state54.position.z;
      const posDiff = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // For 10 minutes with point-mass gravity, should be very close
      expect(posDiff).toBeLessThan(1); // Within 1 km
    });
  });
});
