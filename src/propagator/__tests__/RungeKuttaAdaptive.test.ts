import { ForceModel } from '../../force/ForceModel';
import { Thrust } from '../../force/Thrust';
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, MetersPerSecond, Seconds, SecondsPerMeterPerSecond, Vector3D } from '../../main';
import { RungeKuttaAdaptive } from '../RungeKuttaAdaptive';

// Concrete implementation for testing
class TestRungeKuttaAdaptive extends RungeKuttaAdaptive {
  protected get a(): Float64Array {
    return new Float64Array([0, 0.5, 0.5, 1]);
  }

  protected get b(): Float64Array[] {
    return [
      new Float64Array([0, 0, 0, 0]),
      new Float64Array([0.5, 0, 0, 0]),
      new Float64Array([0, 0.5, 0, 0]),
      new Float64Array([0, 0, 1, 0]),
    ];
  }

  protected get ch(): Float64Array {
    return new Float64Array([1 / 6, 1 / 3, 1 / 3, 1 / 6]);
  }

  protected get c(): Float64Array {
    return new Float64Array([1 / 6, 1 / 3, 1 / 3, 1 / 6]);
  }

  protected get order(): number {
    return 4;
  }
}

describe('RungeKuttaAdaptive', () => {
  let propagator: TestRungeKuttaAdaptive;
  let initialState: J2000;
  let epoch: EpochUTC;

  beforeEach(() => {
    epoch = EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z');
    const position = new Vector3D<Kilometers>(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
    const velocity = new Vector3D<KilometersPerSecond>(
      0 as KilometersPerSecond,
      7.5 as KilometersPerSecond,
      0 as KilometersPerSecond,
    );

    initialState = new J2000(epoch, position, velocity);
    propagator = new TestRungeKuttaAdaptive(initialState);
  });

  describe('constructor', () => {
    it('should create a propagator with default force model and tolerance', () => {
      expect(propagator).toBeDefined();
      expect(propagator.state).toEqual(initialState);
    });

    it('should create a propagator with custom force model', () => {
      const forceModel = new ForceModel().setGravity();
      const customPropagator = new TestRungeKuttaAdaptive(initialState, forceModel);

      expect(customPropagator).toBeDefined();
    });

    it('should enforce minimum tolerance', () => {
      const tinyTolerance = 1e-20;
      const customPropagator = new TestRungeKuttaAdaptive(initialState, new ForceModel(), tinyTolerance);

      expect(customPropagator).toBeDefined();
    });
  });

  describe('state', () => {
    it('should return the current cached state', () => {
      expect(propagator.state).toEqual(initialState);
    });
  });

  describe('reset', () => {
    it('should reset the propagator to initial state', () => {
      const futureEpoch = epoch.roll(3600 as Seconds);

      propagator.propagate(futureEpoch);
      expect(propagator.state).not.toEqual(initialState);

      propagator.reset();
      expect(propagator.state).toEqual(initialState);
    });
  });

  describe('setForceModel', () => {
    it('should update the force model', () => {
      const newForceModel = new ForceModel();

      propagator.setForceModel(newForceModel);
      expect(() => propagator.propagate(epoch.roll(60 as Seconds))).not.toThrow();
    });
  });

  describe('propagate', () => {
    it('should propagate to a future epoch', () => {
      const futureEpoch = epoch.roll(3600 as Seconds);
      const result = propagator.propagate(futureEpoch);

      expect(result).toBeDefined();
      expect(result.epoch.posix).toBeCloseTo(futureEpoch.posix, 0);
    });

    it('should propagate to a past epoch', () => {
      const pastEpoch = epoch.roll(-3600 as Seconds);
      const result = propagator.propagate(pastEpoch);

      expect(result).toBeDefined();
      expect(result.epoch.posix).toBeCloseTo(pastEpoch.posix, 0);
    });

    it('should return current state when epoch matches', () => {
      const result = propagator.propagate(epoch);

      expect(result).toEqual(initialState);
    });

    it('should handle consecutive failures gracefully', () => {
      const veryHighTolerance = 1e-20;
      const strictPropagator = new TestRungeKuttaAdaptive(initialState, new ForceModel(), veryHighTolerance);
      const futureEpoch = epoch.roll(3600 as Seconds);

      expect(() => strictPropagator.propagate(futureEpoch)).not.toThrow();
    });
  });

  describe('checkpoint and restore', () => {
    it('should create a checkpoint and restore to it', () => {
      const checkpointIndex = propagator.checkpoint();

      propagator.propagate(epoch.roll(3600 as Seconds));
      const propagatedState = propagator.state;

      propagator.restore(checkpointIndex);
      expect(propagator.state).toEqual(initialState);
      expect(propagator.state).not.toEqual(propagatedState);
    });

    it('should handle multiple checkpoints', () => {
      const checkpoint1 = propagator.checkpoint();

      propagator.propagate(epoch.roll(1800 as Seconds));
      const checkpoint2 = propagator.checkpoint();
      const state2 = propagator.state;

      propagator.propagate(epoch.roll(3600 as Seconds));

      propagator.restore(checkpoint2);
      expect(propagator.state).toEqual(state2);

      propagator.restore(checkpoint1);
      expect(propagator.state).toEqual(initialState);
    });
  });

  describe('clearCheckpoints', () => {
    it('should clear all checkpoints', () => {
      propagator.checkpoint();
      propagator.checkpoint();

      propagator.clearCheckpoints();
      expect(() => propagator.restore(0)).toThrow();
    });
  });

  describe('maneuver', () => {
    it('should apply an impulsive maneuver', () => {
      // 100 m/s radial = 0.1 km/s
      const maneuver = new Thrust(epoch, 100 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);
      const result = propagator.maneuver(maneuver);

      expect(result).toHaveLength(1);
      expect(result[0].velocity.x).toBeCloseTo(0.1, 5);
    });
  });

  describe('ephemerisManeuver', () => {
    it('should generate ephemeris with maneuvers', () => {
      const start = epoch;
      const finish = epoch.roll(7200 as Seconds);
      const maneuverEpoch = epoch.roll(3600 as Seconds);
      // 100 m/s radial = 0.1 km/s
      const maneuver = new Thrust(maneuverEpoch, 100 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);
      const interpolator = propagator.ephemerisManeuver(start, finish, [maneuver]);

      expect(interpolator).toBeDefined();
    });

    it('should handle non-impulsive maneuvers over time', () => {
      const maneuverEpoch = epoch.roll(1800 as Seconds);
      const duration = 300 as SecondsPerMeterPerSecond;
      const maneuver = new Thrust(
        maneuverEpoch,
        10 as MetersPerSecond,
        0 as MetersPerSecond,
        0 as MetersPerSecond,
        duration,
      );
      const result = propagator.maneuver(maneuver);

      expect(result.length).toBeGreaterThan(1);
      expect(result[0].epoch.posix).toBeCloseTo(maneuver.start.posix, 0);
      expect(result[result.length - 1].epoch.posix).toBeGreaterThanOrEqual(maneuver.stop.posix);
    });

    it('should respect custom interval for non-impulsive maneuvers', () => {
      const maneuverEpoch = epoch.roll(1800 as Seconds);
      const duration = 600 as SecondsPerMeterPerSecond;
      const maneuver = new Thrust(
        maneuverEpoch,
        10 as MetersPerSecond,
        0 as MetersPerSecond,
        0 as MetersPerSecond,
        duration,
      );
      const customInterval = 30 as Seconds;
      const result = propagator.maneuver(maneuver, customInterval);

      expect(result.length).toBeGreaterThan(1);
      expect(result[result.length - 1].epoch.posix).toBeGreaterThanOrEqual(maneuver.stop.posix);
    });

    it('should propagate to maneuver start before applying', () => {
      const futureManeuverEpoch = epoch.roll(3600 as Seconds);
      const maneuver = new Thrust(
        futureManeuverEpoch,
        50 as MetersPerSecond,
        0 as MetersPerSecond,
        0 as MetersPerSecond,
      );
      const initialEpochPosix = propagator.state.epoch.posix;

      propagator.maneuver(maneuver);

      expect(propagator.state.epoch.posix).toBeGreaterThan(initialEpochPosix);
    });
  });
});
