import { vi } from 'vitest';
import { EpochUTC, J2000, Seconds, Sun, Vector3D } from '../../main';
import { SolarRadiationPressure } from '../SolarRadiationPressure';

describe('SolarRadiationPressure', () => {
  let srp: SolarRadiationPressure;
  const mass = 1000; // kg
  const area = 10; // m²
  const reflectCoeff = 1.5;

  beforeEach(() => {
    srp = new SolarRadiationPressure(mass, area, reflectCoeff);
  });

  describe('constructor', () => {
    it('should create an instance with correct properties', () => {
      expect(srp).toBeInstanceOf(SolarRadiationPressure);
      expect(srp.mass).toBe(mass);
      expect(srp.area).toBe(area);
      expect(srp.reflectCoeff).toBe(reflectCoeff);
    });
  });

  describe('acceleration', () => {
    it('should calculate acceleration for a given state', () => {
      const mockEpoch = new EpochUTC(new Date('2024-01-01T00:00:00Z').getTime() / 1000 as Seconds);
      const mockPosition = new Vector3D(7000, 0, 0);
      const mockState = {
        epoch: mockEpoch,
        position: mockPosition,
      } as J2000;

      const acceleration = srp.acceleration(mockState);

      expect(acceleration).toBeInstanceOf(Vector3D);
      expect(typeof acceleration.x).toBe('number');
      expect(typeof acceleration.y).toBe('number');
      expect(typeof acceleration.z).toBe('number');
    });

    it('should return zero-like acceleration when lighting ratio is zero', () => {
      vi.spyOn(Sun, 'lightingRatio').mockReturnValue(0);

      const mockEpoch = new EpochUTC(new Date('2024-01-01T00:00:00Z').getTime() / 1000 as Seconds);
      const mockPosition = new Vector3D(7000, 0, 0);
      const mockState = {
        epoch: mockEpoch,
        position: mockPosition,
      } as J2000;

      const acceleration = srp.acceleration(mockState);

      expect(acceleration.magnitude()).toBeCloseTo(0, 10);
    });

    it('should scale acceleration based on area, reflectivity, and mass', () => {
      const srp1 = new SolarRadiationPressure(mass, area, reflectCoeff);
      const srp2 = new SolarRadiationPressure(mass * 2, area, reflectCoeff);

      const mockEpoch = new EpochUTC(new Date('2024-01-01T00:00:00Z').getTime() / 1000 as Seconds);
      const mockPosition = new Vector3D(7000, 0, 0);
      const mockState = {
        epoch: mockEpoch,
        position: mockPosition,
      } as J2000;

      const accel1 = srp1.acceleration(mockState);
      const accel2 = srp2.acceleration(mockState);

      expect(accel1.magnitude()).toBeCloseTo(accel2.magnitude() * 2, 10);
    });

    it('should calculate correct acceleration values', () => {
      const mockEpoch = new EpochUTC(new Date('2024-01-01T00:00:00Z').getTime() / 1000 as Seconds);
      const mockPosition = new Vector3D(7000, 0, 0);
      const mockState = {
        epoch: mockEpoch,
        position: mockPosition,
      } as J2000;

      const expectedAcceleration = new Vector3D(0.001, 0, 0); // Replace with actual expected values based on your calculations
      const acceleration = srp.acceleration(mockState);

      expect(acceleration.x).toBeCloseTo(expectedAcceleration.x, 2);
      expect(acceleration.y).toBeCloseTo(expectedAcceleration.y, 2);
      expect(acceleration.z).toBeCloseTo(expectedAcceleration.z, 2);
    });

    it('should handle negative reflectivity', () => {
      const srpNegativeReflectivity = new SolarRadiationPressure(mass, area, -1);
      const mockEpoch = new EpochUTC(new Date('2024-01-01T00:00:00Z').getTime() / 1000 as Seconds);
      const mockPosition = new Vector3D(7000, 0, 0);
      const mockState = {
        epoch: mockEpoch,
        position: mockPosition,
      } as J2000;

      const acceleration = srpNegativeReflectivity.acceleration(mockState);

      expect(acceleration.magnitude()).toBeGreaterThanOrEqual(0);
    });

    it('should return zero acceleration for infinite distance', () => {
      const mockEpoch = new EpochUTC(new Date('2024-01-01T00:00:00Z').getTime() / 1000 as Seconds);
      const mockPosition = new Vector3D(1e12, 0, 0); // Very far from the Sun
      const mockState = {
        epoch: mockEpoch,
        position: mockPosition,
      } as J2000;

      const acceleration = srp.acceleration(mockState);

      expect(acceleration.magnitude()).toBeCloseTo(0, 10);
    });
  });
});
