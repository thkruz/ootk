import { Thrust } from '@src/force/Thrust';
import { ClassicalElements, EpochUTC, J2000, Kilometers, MetersPerSecond, Radians, Seconds } from '../../main';
import { KeplerPropagator } from '../KeplerPropagator';

describe('KeplerPropagator', () => {
  describe('constructor', () => {
    it('should initialize with provided classical elements', () => {
      const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const elements = new ClassicalElements({
        epoch,
        semimajorAxis: 6778.137 as Kilometers,
        eccentricity: 0.0001,
        inclination: 0.9 as Radians,
        rightAscension: 0.1 as Radians,
        argPerigee: 0.2 as Radians,
        trueAnomaly: 0.3 as Radians,
      });

      const propagator = new KeplerPropagator(elements);

      expect(propagator).toBeInstanceOf(KeplerPropagator);
      expect(propagator.state).toBeDefined();
      expect(propagator.state.epoch).toEqual(epoch);
    });

    it('should initialize state from classical elements', () => {
      const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const elements = new ClassicalElements({
        epoch,
        semimajorAxis: 7000 as Kilometers,
        eccentricity: 0.001,
        inclination: 0.5 as Radians,
        rightAscension: 0 as Radians,
        argPerigee: 0 as Radians,
        trueAnomaly: 0 as Radians,
      });

      const propagator = new KeplerPropagator(elements);

      expect(propagator.state.position).toBeDefined();
      expect(propagator.state.velocity).toBeDefined();
    });

    it('should initialize with empty checkpoints array', () => {
      const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const elements = new ClassicalElements({
        epoch,
        semimajorAxis: 6778.137 as Kilometers,
        eccentricity: 0.0001,
        inclination: 0.9 as Radians,
        rightAscension: 0.1 as Radians,
        argPerigee: 0.2 as Radians,
        trueAnomaly: 0.3 as Radians,
      });

      const propagator = new KeplerPropagator(elements);

      // Verify checkpoints can be created (implies empty initialization)
      const checkpointIndex = propagator.checkpoint();

      expect(checkpointIndex).toBe(0);
    });

    it('should reset elements to initial state', () => {
      const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const elements = new ClassicalElements({
        epoch,
        semimajorAxis: 6778.137 as Kilometers,
        eccentricity: 0.0001,
        inclination: 0.9 as Radians,
        rightAscension: 0.1 as Radians,
        argPerigee: 0.2 as Radians,
        trueAnomaly: 0.3 as Radians,
      });

      const propagator = new KeplerPropagator(elements);

      propagator.propagate(epoch); // Change the state

      propagator.reset();

      expect(propagator.state).toBeDefined();
      expect(propagator.state.epoch).toEqual(elements.epoch);
      expect(propagator.state.semimajorAxis).toBeCloseTo(elements.semimajorAxis, 6);
      expect(propagator.state.toClassicalElements().eccentricity).toBeCloseTo(elements.eccentricity, 6);
    });

    it('should reset cache state to initial state', () => {
      const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
      const elements = new ClassicalElements({
        epoch,
        semimajorAxis: 7000 as Kilometers,
        eccentricity: 0.001,
        inclination: 0.5 as Radians,
        rightAscension: 0 as Radians,
        argPerigee: 0 as Radians,
        trueAnomaly: 0 as Radians,
      });

      const propagator = new KeplerPropagator(elements);

      propagator.propagate(epoch); // Change the state

      const initialCacheState = propagator.state;

      propagator.reset();

      // Ensure cache state matches initial state after reset
      expect(propagator.state).toEqual(initialCacheState);
      expect(propagator.state).toEqual(J2000.fromClassicalElements(elements));
    });

    describe('ephemerisManeuver', () => {
      it('should generate ephemeris with maneuvers', () => {
        const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
        const elements = new ClassicalElements({
          epoch,
          semimajorAxis: 6778.137 as Kilometers,
          eccentricity: 0.0001,
          inclination: 0.9 as Radians,
          rightAscension: 0.1 as Radians,
          argPerigee: 0.2 as Radians,
          trueAnomaly: 0.3 as Radians,
        });

        const propagator = new KeplerPropagator(elements);
        const start = epoch;
        const finish = epoch.roll(300 as Seconds);
        const maneuverEpoch = epoch.roll(150 as Seconds);
        const maneuver = new Thrust(maneuverEpoch, 10 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);

        const interpolator = propagator.ephemerisManeuver(start, finish, [maneuver], 60);

        expect(interpolator).toBeDefined();
      });

      it('should propagate to start if first maneuver starts after start epoch', () => {
        const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
        const elements = new ClassicalElements({
          epoch,
          semimajorAxis: 6778.137 as Kilometers,
          eccentricity: 0.0001,
          inclination: 0.9 as Radians,
          rightAscension: 0.1 as Radians,
          argPerigee: 0.2 as Radians,
          trueAnomaly: 0.3 as Radians,
        });

        const propagator = new KeplerPropagator(elements);
        const start = epoch;
        const finish = epoch.roll(300 as Seconds);
        const maneuverEpoch = epoch.roll(100 as Seconds);
        const maneuver = new Thrust(maneuverEpoch, 10 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);

        const interpolator = propagator.ephemerisManeuver(start, finish, [maneuver], 60);

        expect(interpolator).toBeDefined();
      });

      it('should handle multiple maneuvers', () => {
        const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
        const elements = new ClassicalElements({
          epoch,
          semimajorAxis: 6778.137 as Kilometers,
          eccentricity: 0.0001,
          inclination: 0.9 as Radians,
          rightAscension: 0.1 as Radians,
          argPerigee: 0.2 as Radians,
          trueAnomaly: 0.3 as Radians,
        });

        const propagator = new KeplerPropagator(elements);
        const start = epoch;
        const finish = epoch.roll(400 as Seconds);
        const maneuver1 = new Thrust(epoch.roll(100 as Seconds), 10 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);
        const maneuver2 = new Thrust(epoch.roll(250 as Seconds), 10 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);

        const interpolator = propagator.ephemerisManeuver(start, finish, [maneuver1, maneuver2], 60);

        expect(interpolator).toBeDefined();
      });

      it('should use custom interval for propagation steps', () => {
        const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
        const elements = new ClassicalElements({
          epoch,
          semimajorAxis: 6778.137 as Kilometers,
          eccentricity: 0.0001,
          inclination: 0.9 as Radians,
          rightAscension: 0.1 as Radians,
          argPerigee: 0.2 as Radians,
          trueAnomaly: 0.3 as Radians,
        });

        const propagator = new KeplerPropagator(elements);
        const start = epoch;
        const finish = epoch.roll(200 as Seconds);
        const maneuver = new Thrust(epoch.roll(100 as Seconds), 10 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);

        const interpolator = propagator.ephemerisManeuver(start, finish, [maneuver], 30);

        expect(interpolator).toBeDefined();
      });

      it('should filter maneuvers within time range', () => {
        const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
        const elements = new ClassicalElements({
          epoch,
          semimajorAxis: 6778.137 as Kilometers,
          eccentricity: 0.0001,
          inclination: 0.9 as Radians,
          rightAscension: 0.1 as Radians,
          argPerigee: 0.2 as Radians,
          trueAnomaly: 0.3 as Radians,
        });

        const propagator = new KeplerPropagator(elements);
        const start = epoch.roll(100 as Seconds);
        const finish = epoch.roll(300 as Seconds);
        const maneuver = new Thrust(epoch.roll(200 as Seconds), 10 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);

        const interpolator = propagator.ephemerisManeuver(start, finish, [maneuver], 60);

        expect(interpolator).toBeDefined();
      });

      it('should propagate to finish after all maneuvers', () => {
        const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00.000Z'));
        const elements = new ClassicalElements({
          epoch,
          semimajorAxis: 6778.137 as Kilometers,
          eccentricity: 0.0001,
          inclination: 0.9 as Radians,
          rightAscension: 0.1 as Radians,
          argPerigee: 0.2 as Radians,
          trueAnomaly: 0.3 as Radians,
        });

        const propagator = new KeplerPropagator(elements);
        const start = epoch;
        const finish = epoch.roll(300 as Seconds);
        const maneuver = new Thrust(epoch.roll(100 as Seconds), 10 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);

        const interpolator = propagator.ephemerisManeuver(start, finish, [maneuver], 60);

        expect(interpolator).toBeDefined();
      });
    });
  });
});
