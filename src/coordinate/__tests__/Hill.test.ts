import { Thrust } from '../../force/Thrust';
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, MetersPerSecond, RadiansPerSecond, Seconds, Vector3D } from '../../main';
import { Waypoint } from '../../maneuver/Waypoint';
import { Hill } from '../Hill';

describe('Hill', () => {
  let epoch: EpochUTC;
  let position: Vector3D<Kilometers>;
  let velocity: Vector3D<KilometersPerSecond>;
  let semimajorAxis: Kilometers;
  let hill: Hill;

  beforeEach(() => {
    epoch = EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z');
    position = new Vector3D(1.0 as Kilometers, 2.0 as Kilometers, 3.0 as Kilometers);
    velocity = new Vector3D(0.001 as KilometersPerSecond, 0.002 as KilometersPerSecond, 0.003 as KilometersPerSecond);
    semimajorAxis = 6800.0 as Kilometers;
    hill = new Hill(epoch, position, velocity, semimajorAxis);
  });

  describe('constructor', () => {
    it('should create a Hill instance', () => {
      expect(hill).toBeInstanceOf(Hill);
      expect(hill.epoch).toBe(epoch);
      expect(hill.position).toBe(position);
      expect(hill.velocity).toBe(velocity);
      expect(hill.semimajorAxis).toBe(semimajorAxis);
    });
  });

  describe('fromState', () => {
    it('should create Hill from state parameters', () => {
      const origin = new J2000(
        epoch,
        new Vector3D(6800.0 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers),
        new Vector3D(0.0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0.0 as KilometersPerSecond),
      );
      const result = Hill.fromState(origin, 1.0 as Kilometers, 2.0 as Kilometers, 0.01 as KilometersPerSecond, 100.0 as Seconds);

      expect(result).toBeInstanceOf(Hill);
      expect(result.position.x).toBe(1.0);
      expect(result.position.y).toBe(2.0);
    });
  });

  describe('fromNmc', () => {
    it('should create Hill from NMC parameters', () => {
      const origin = new J2000(
        epoch,
        new Vector3D(6800.0 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers),
        new Vector3D(0.0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0.0 as KilometersPerSecond),
      );
      const result = Hill.fromNmc(origin, 5.0 as Kilometers, 0.01 as KilometersPerSecond, 100.0 as Seconds);

      expect(result).toBeInstanceOf(Hill);
      expect(result.position.x).toBe(0.0);
      expect(result.position.y).toBeCloseTo(5.0, 5);
    });
  });

  describe('fromPerch', () => {
    it('should create Hill from perch parameters', () => {
      const origin = new J2000(
        epoch,
        new Vector3D(6800.0 as Kilometers, 0.0 as Kilometers, 0.0 as Kilometers),
        new Vector3D(0.0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0.0 as KilometersPerSecond),
      );
      const result = Hill.fromPerch(origin, 10.0 as Kilometers, 0.01 as KilometersPerSecond, 100.0 as Seconds);

      expect(result).toBeInstanceOf(Hill);
      expect(result.position.x).toBe(0.0);
      expect(result.position.y).toBe(10.0);
      expect(result.velocity.x).toBe(0.0);
      expect(result.velocity.y).toBe(0.0);
    });
  });

  describe('semimajorAxis getter/setter', () => {
    it('should get and set semimajor axis', () => {
      const newSma = 7000.0 as Kilometers;

      hill.semimajorAxis = newSma;
      expect(hill.semimajorAxis).toBe(newSma);
    });
  });

  describe('meanMotion', () => {
    it('should calculate mean motion from semimajor axis', () => {
      expect(hill.meanMotion).toBeGreaterThan(0 as RadiansPerSecond);
    });
  });

  describe('transitionMatrix', () => {
    it('should create a 6x6 state transition matrix', () => {
      const matrix = Hill.transitionMatrix(60.0, 0.001);

      expect(matrix.elements.length).toBe(6);
      expect(matrix.elements[0].length).toBe(6);
    });
  });

  describe('transition', () => {
    it('should propagate Hill state forward in time', () => {
      const result = hill.transition(60.0 as Seconds);

      expect(result).toBeInstanceOf(Hill);
      expect(result.epoch.difference(hill.epoch)).toBeCloseTo(60.0, 5);
    });
  });

  describe('propagate', () => {
    it('should propagate to a new epoch', () => {
      const newEpoch = epoch.roll(120.0 as Seconds);
      const result = hill.propagate(newEpoch);

      expect(result.epoch).toStrictEqual(newEpoch);
    });
  });

  describe('maneuver', () => {
    it('should apply a thrust maneuver', () => {
      const thrust = new Thrust(epoch, 1.0 as MetersPerSecond, 0.0 as MetersPerSecond, 0.0 as MetersPerSecond);
      const result = hill.maneuver(thrust);

      expect(result).toBeInstanceOf(Hill);
    });
  });

  describe('ephemeris', () => {
    it('should generate ephemeris data', () => {
      const start = epoch;
      const stop = epoch.roll(300.0 as Seconds);
      const result = hill.ephemeris(start, stop, 60.0 as Seconds);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBeInstanceOf(Hill);
    });
  });

  describe('period', () => {
    it('should calculate orbital period', () => {
      expect(hill.period).toBeGreaterThan(0 as Seconds);
    });
  });

  describe('solveManeuver', () => {
    it('should solve for maneuver to reach waypoint', () => {
      const waypoint = new Waypoint(
        epoch.roll(120.0 as Seconds),
        new Vector3D(5.0 as Kilometers, 10.0 as Kilometers, 2.0 as Kilometers),
      );
      const result = hill.solveManeuver(waypoint);

      expect(result).toBeInstanceOf(Thrust);
    });

    it('should ignore crosstrack when specified', () => {
      const waypoint = new Waypoint(
        epoch.roll(120.0 as Seconds),
        new Vector3D(5.0 as Kilometers, 10.0 as Kilometers, 2.0 as Kilometers),
      );
      const result = hill.solveManeuver(waypoint, true);

      expect(result.crosstrack).toBe(0);
    });
  });

  describe('maneuverSequence', () => {
    it('should create sequence of maneuvers', () => {
      const pivot = epoch;
      const waypoints = [new Waypoint(epoch.roll(120.0 as Seconds), new Vector3D(5.0 as Kilometers, 10.0 as Kilometers, 2.0 as Kilometers))];
      const result = hill.maneuverSequence(pivot, waypoints);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('toString', () => {
    it('should return string representation', () => {
      const str = hill.toString();

      expect(str).toContain('[Hill]');
      expect(str).toContain('Epoch:');
      expect(str).toContain('Position:');
      expect(str).toContain('Velocity:');
    });
  });

  describe('name', () => {
    it('should return "Hill"', () => {
      expect(hill.name).toBe('Hill');
    });
  });
});
