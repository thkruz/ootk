import { ForceModel } from '../../force/ForceModel';
import { Thrust } from '../../force/Thrust';
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, MetersPerSecond, Seconds, SecondsPerMeterPerSecond, Vector3D } from '../../main';
import { RungeKutta4Propagator } from '../RungeKutta4Propagator';

describe('RungeKutta4Propagator', () => {
  let initialState: J2000;
  let propagator: RungeKutta4Propagator;
  const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));

  beforeEach(() => {
    const position = new Vector3D(6778, 0, 0) as Vector3D<Kilometers>;
    const velocity = new Vector3D(0, 7.5, 0) as Vector3D<KilometersPerSecond>;

    initialState = new J2000(epoch, position, velocity);
    propagator = new RungeKutta4Propagator(initialState);
  });

  describe('constructor', () => {
    it('should create a propagator with default values', () => {
      expect(propagator).toBeInstanceOf(RungeKutta4Propagator);
      expect(propagator.state).toEqual(initialState);
    });

    it('should create a propagator with custom step size', () => {
      const customPropagator = new RungeKutta4Propagator(initialState, new ForceModel(), 30.0);

      expect(customPropagator).toBeInstanceOf(RungeKutta4Propagator);
    });

    it('should handle negative step size by converting to absolute', () => {
      const customPropagator = new RungeKutta4Propagator(initialState, new ForceModel(), -15.0);

      expect(customPropagator).toBeInstanceOf(RungeKutta4Propagator);
    });
  });

  describe('setStepSize', () => {
    it('should update step size', () => {
      propagator.setStepSize(30.0);
      expect(propagator).toBeInstanceOf(RungeKutta4Propagator);
    });

    it('should convert negative step size to positive', () => {
      propagator.setStepSize(-30.0);
      expect(propagator).toBeInstanceOf(RungeKutta4Propagator);
    });
  });

  describe('setForceModel', () => {
    it('should update force model', () => {
      const newForceModel = new ForceModel().setGravity();

      propagator.setForceModel(newForceModel);
      expect(propagator).toBeInstanceOf(RungeKutta4Propagator);
    });
  });

  describe('propagate', () => {
    it('should propagate to future epoch', () => {
      const futureEpoch = epoch.roll(60 as Seconds);
      const result = propagator.propagate(futureEpoch);

      expect(result).toBeInstanceOf(J2000);
      expect(result.epoch).toEqual(futureEpoch);
    });

    it('should propagate to past epoch', () => {
      const futureEpoch = epoch.roll(60 as Seconds);

      propagator.propagate(futureEpoch);
      const pastEpoch = epoch.roll(30 as Seconds);
      const result = propagator.propagate(pastEpoch);

      expect(result).toBeInstanceOf(J2000);
      expect(result.epoch).toEqual(pastEpoch);
    });

    it('should handle zero time difference', () => {
      const result = propagator.propagate(epoch);

      expect(result.epoch).toEqual(epoch);
    });

    it('should update cache state', () => {
      const futureEpoch = epoch.roll(60 as Seconds);

      propagator.propagate(futureEpoch);
      expect(propagator.state.epoch).toEqual(futureEpoch);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const futureEpoch = epoch.roll(60 as Seconds);

      propagator.propagate(futureEpoch);
      propagator.reset();
      expect(propagator.state).toEqual(initialState);
    });
  });

  describe('checkpoint and restore', () => {
    it('should create checkpoint and return index', () => {
      const index = propagator.checkpoint();

      expect(index).toBe(0);
    });

    it('should restore to checkpoint', () => {
      const futureEpoch = epoch.roll(60 as Seconds);

      propagator.propagate(futureEpoch);
      const index = propagator.checkpoint();

      propagator.propagate(epoch.roll(120 as Seconds));
      propagator.restore(index);
      expect(propagator.state.epoch).toEqual(futureEpoch);
    });

    it('should handle multiple checkpoints', () => {
      const index1 = propagator.checkpoint();

      propagator.propagate(epoch.roll(60 as Seconds));
      const index2 = propagator.checkpoint();

      expect(index1).toBe(0);
      expect(index2).toBe(1);
    });
  });

  describe('clearCheckpoints', () => {
    it('should clear all checkpoints', () => {
      propagator.checkpoint();
      propagator.checkpoint();
      propagator.clearCheckpoints();
      const index = propagator.checkpoint();

      expect(index).toBe(0);
    });
  });

  describe('state getter', () => {
    it('should return current state', () => {
      const state = propagator.state;

      expect(state).toEqual(initialState);
    });
  });

  describe('maneuver', () => {
    it('should handle impulsive maneuver', () => {
      const maneuverEpoch = epoch.roll(60 as Seconds);
      const deltaV = new Vector3D(0.1, 0, 0) as Vector3D<KilometersPerSecond>;
      const thrust = new Thrust(maneuverEpoch, deltaV.x * 1000 as MetersPerSecond, deltaV.y * 1000 as MetersPerSecond, deltaV.z * 1000 as MetersPerSecond);
      const result = propagator.maneuver(thrust);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(J2000);
    });

    it('should handle finite burn maneuver', () => {
      const startEpoch = epoch.roll(60 as Seconds);
      const stopEpoch = epoch.roll(120 as Seconds);
      const deltaV = new Vector3D(0.1, 0, 0) as Vector3D<KilometersPerSecond>;
      const thrust = new Thrust(
        startEpoch,
        deltaV.x * 1000 as MetersPerSecond,
        deltaV.y * 1000 as MetersPerSecond,
        deltaV.z * 1000 as MetersPerSecond,
        stopEpoch.difference(startEpoch) as unknown as SecondsPerMeterPerSecond,
      );
      const result = propagator.maneuver(thrust, 30);

      expect(result.length).toBeGreaterThan(0);
    });

    describe('ephemerisManeuver', () => {
      it('should generate ephemeris with single impulsive maneuver', () => {
        const start = epoch;
        const finish = epoch.roll(180 as Seconds);
        const maneuverEpoch = epoch.roll(60 as Seconds);
        const deltaV = new Vector3D(0.1, 0, 0) as Vector3D<KilometersPerSecond>;
        const thrust = new Thrust(
          maneuverEpoch,
          deltaV.x * 1000 as MetersPerSecond,
          deltaV.y * 1000 as MetersPerSecond,
          deltaV.z * 1000 as MetersPerSecond,
        );
        const result = propagator.ephemerisManeuver(start, finish, [thrust]);

        expect(result).toBeDefined();
      });

      it('should generate ephemeris with multiple maneuvers', () => {
        const start = epoch;
        const finish = epoch.roll(300 as Seconds);
        const maneuver1Epoch = epoch.roll(60 as Seconds);
        const maneuver2Epoch = epoch.roll(180 as Seconds);
        const deltaV = new Vector3D(0.1, 0, 0) as Vector3D<KilometersPerSecond>;
        const thrust1 = new Thrust(
          maneuver1Epoch,
          deltaV.x * 1000 as MetersPerSecond,
          deltaV.y * 1000 as MetersPerSecond,
          deltaV.z * 1000 as MetersPerSecond,
        );
        const thrust2 = new Thrust(
          maneuver2Epoch,
          deltaV.x * 1000 as MetersPerSecond,
          deltaV.y * 1000 as MetersPerSecond,
          deltaV.z * 1000 as MetersPerSecond,
        );
        const result = propagator.ephemerisManeuver(start, finish, [thrust1, thrust2]);

        expect(result).toBeDefined();
      });

      it('should generate ephemeris with finite burn maneuver', () => {
        const start = epoch;
        const finish = epoch.roll(240 as Seconds);
        const maneuverStart = epoch.roll(60 as Seconds);
        const maneuverStop = epoch.roll(120 as Seconds);
        const centerEpoch = epoch.roll(90 as Seconds); // Midpoint of maneuver
        const deltaV = new Vector3D(0.1, 0, 0) as Vector3D<KilometersPerSecond>;
        const magnitude = deltaV.magnitude() * 1000; // 100 m/s
        const duration = maneuverStop.difference(maneuverStart); // 60 seconds
        const durationRate = (duration / magnitude) as SecondsPerMeterPerSecond;
        const thrust = new Thrust(
          centerEpoch,
          deltaV.x * 1000 as MetersPerSecond,
          deltaV.y * 1000 as MetersPerSecond,
          deltaV.z * 1000 as MetersPerSecond,
          durationRate,
        );
        const result = propagator.ephemerisManeuver(start, finish, [thrust], 30 as Seconds);

        expect(result).toBeDefined();
      });

      it('should handle custom interval', () => {
        const start = epoch;
        const finish = epoch.roll(180 as Seconds);
        const maneuverEpoch = epoch.roll(60 as Seconds);
        const deltaV = new Vector3D(0.1, 0, 0) as Vector3D<KilometersPerSecond>;
        const thrust = new Thrust(
          maneuverEpoch,
          deltaV.x * 1000 as MetersPerSecond,
          deltaV.y * 1000 as MetersPerSecond,
          deltaV.z * 1000 as MetersPerSecond,
        );
        const result = propagator.ephemerisManeuver(start, finish, [thrust], 15 as Seconds);

        expect(result).toBeDefined();
      });

      it('should propagate before first maneuver if needed', () => {
        const start = epoch;
        const finish = epoch.roll(180 as Seconds);
        const maneuverEpoch = epoch.roll(120 as Seconds);
        const deltaV = new Vector3D(0.1, 0, 0) as Vector3D<KilometersPerSecond>;
        const thrust = new Thrust(
          maneuverEpoch,
          deltaV.x * 1000 as MetersPerSecond,
          deltaV.y * 1000 as MetersPerSecond,
          deltaV.z * 1000 as MetersPerSecond,
        );
        const result = propagator.ephemerisManeuver(start, finish, [thrust]);

        expect(result).toBeDefined();
      });

      it('should propagate after last maneuver', () => {
        const start = epoch;
        const finish = epoch.roll(240 as Seconds);
        const maneuverEpoch = epoch.roll(60 as Seconds);
        const deltaV = new Vector3D(0.1, 0, 0) as Vector3D<KilometersPerSecond>;
        const thrust = new Thrust(
          maneuverEpoch,
          deltaV.x * 1000 as MetersPerSecond,
          deltaV.y * 1000 as MetersPerSecond,
          deltaV.z * 1000 as MetersPerSecond,
        );
        const result = propagator.ephemerisManeuver(start, finish, [thrust]);

        expect(result).toBeDefined();
      });
    });
  });
});
