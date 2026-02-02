import {
  J2000,
  Kilometers, KilometersPerSecond,
  MetersPerSecond, SecondsPerMeterPerSecond,
  Thrust,
  Vector3D,
} from '@src/main';
import { EpochUTC } from '@src/time';

describe('Thrust', () => {
  const epoch = EpochUTC.fromDateTimeString('2025-01-15T12:00:00.000Z');
  const radial = 10 as MetersPerSecond;
  const intrack = 20 as MetersPerSecond;
  const crosstrack = 30 as MetersPerSecond;

  describe('constructor', () => {
    it('should create a Thrust instance with given parameters', () => {
      const thrust = new Thrust(epoch, radial, intrack, crosstrack);

      expect(thrust.center).toBe(epoch);
      expect(thrust.radial).toBe(radial);
      expect(thrust.intrack).toBe(intrack);
      expect(thrust.crosstrack).toBe(crosstrack);
      expect(thrust.durationRate).toBe(0.0);
    });

    it('should convert deltaV from m/s to km/s', () => {
      const thrust = new Thrust(epoch, radial, intrack, crosstrack);

      expect(thrust.deltaV.x).toBeCloseTo(0.01);
      expect(thrust.deltaV.y).toBeCloseTo(0.02);
      expect(thrust.deltaV.z).toBeCloseTo(0.03);
    });

    it('should accept custom durationRate', () => {
      const durationRate = 5.0 as SecondsPerMeterPerSecond;
      const thrust = new Thrust(epoch, radial, intrack, crosstrack, durationRate);

      expect(thrust.durationRate).toBe(durationRate);
    });
  });

  describe('magnitude', () => {
    it('should calculate magnitude correctly', () => {
      const thrust = new Thrust(epoch, radial, intrack, crosstrack);
      const expected = Math.sqrt(10 ** 2 + 20 ** 2 + 30 ** 2);

      expect(thrust.magnitude).toBeCloseTo(expected, 6);
    });
  });

  describe('duration', () => {
    it('should return 0 when durationRate is 0', () => {
      const thrust = new Thrust(epoch, radial, intrack, crosstrack, 0 as SecondsPerMeterPerSecond);

      expect(thrust.duration).toBe(0);
    });

    it('should calculate duration correctly', () => {
      const durationRate = 5.0 as SecondsPerMeterPerSecond;
      const thrust = new Thrust(epoch, radial, intrack, crosstrack, durationRate);
      const expectedMagnitude = Math.sqrt(10 ** 2 + 20 ** 2 + 30 ** 2);

      expect(thrust.duration).toBeCloseTo(expectedMagnitude * durationRate, 6);
    });
  });

  describe('start and stop', () => {
    it('should calculate start and stop times correctly', () => {
      const durationRate = 2.0 as SecondsPerMeterPerSecond;
      const thrust = new Thrust(epoch, radial, intrack, crosstrack, durationRate);
      const halfDuration = thrust.duration / 2;

      const start = thrust.start;
      const stop = thrust.stop;

      expect(start.posix).toBeCloseTo(epoch.posix - halfDuration, 6);
      expect(stop.posix).toBeCloseTo(epoch.posix + halfDuration, 6);
    });
  });

  describe('isImpulsive', () => {
    it('should return true when duration is 0', () => {
      const thrust = new Thrust(epoch, radial, intrack, crosstrack, 0 as SecondsPerMeterPerSecond);

      expect(thrust.isImpulsive).toBe(true);
    });

    it('should return false when duration is greater than 0', () => {
      const thrust = new Thrust(epoch, radial, intrack, crosstrack, 5.0 as SecondsPerMeterPerSecond);

      expect(thrust.isImpulsive).toBe(false);
    });
  });

  describe('acceleration', () => {
    it('should calculate acceleration for a given state', () => {
      const durationRate = 10.0 as SecondsPerMeterPerSecond;
      const thrust = new Thrust(epoch, radial, intrack, crosstrack, durationRate);
      const state = new J2000(
        epoch,
        new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );

      const accel = thrust.acceleration(state);

      expect(accel).toBeInstanceOf(Vector3D);
      expect(accel.x).toBeDefined();
      expect(accel.y).toBeDefined();
      expect(accel.z).toBeDefined();
    });
  });

  describe('apply', () => {
    it('should apply thrust to a state', () => {
      const thrust = new Thrust(epoch, radial, intrack, crosstrack);
      const state = new J2000(
        epoch,
        new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );

      const newState = thrust.apply(state);

      expect(newState).toBeInstanceOf(J2000);
      expect(newState.position).toBeDefined();
      expect(newState.velocity).toBeDefined();
    });
  });
});
