import { Earth, EpochUTC, J2000, Kilometers, KilometersPerSecond, Vector3D } from '../../main';
import { Gravity } from '../Gravity';

describe('Gravity', () => {
  describe('constructor', () => {
    it('should use Earth.mu as default gravitational parameter', () => {
      const gravity = new Gravity();

      expect(gravity.mu).toBe(Earth.mu);
    });

    it('should accept custom gravitational parameter', () => {
      const customMu = 300000;
      const gravity = new Gravity(customMu);

      expect(gravity.mu).toBe(customMu);
    });
  });

  describe('acceleration', () => {
    it('should calculate acceleration towards the center', () => {
      const gravity = new Gravity();
      const position = new Vector3D(7000, 0, 0) as Vector3D<Kilometers>;
      const velocity = new Vector3D(0, 7.5, 0) as Vector3D<KilometersPerSecond>;
      const state = new J2000(new EpochUTC(), position, velocity);

      const acceleration = gravity.acceleration(state);

      expect(acceleration.x).toBeLessThan(0);
      expect(acceleration.y).toBeCloseTo(0, 10);
      expect(acceleration.z).toBeCloseTo(0, 10);
    });

    it('should calculate correct acceleration magnitude', () => {
      const gravity = new Gravity();
      const r = 7000; // km
      const position = new Vector3D(r, 0, 0) as Vector3D<Kilometers>;
      const velocity = new Vector3D(0, 0, 0) as Vector3D<KilometersPerSecond>;
      const state = new J2000(new EpochUTC(), position, velocity);

      const acceleration = gravity.acceleration(state);
      const expectedMag = gravity.mu / (r * r);

      expect(acceleration.magnitude()).toBeCloseTo(expectedMag, 10);
    });

    it('should handle non-axial positions', () => {
      const gravity = new Gravity();
      const position = new Vector3D(4000, 3000, 2000) as Vector3D<Kilometers>;
      const velocity = new Vector3D(0, 0, 0) as Vector3D<KilometersPerSecond>;
      const state = new J2000(new EpochUTC(), position, velocity);

      const acceleration = gravity.acceleration(state);
      const rMag = position.magnitude();
      const expectedMag = gravity.mu / (rMag * rMag);

      expect(acceleration.magnitude()).toBeCloseTo(expectedMag, 10);

      // Acceleration should be antiparallel to position
      const positionUnit = position.normalize();
      const accelerationUnit = acceleration.normalize();
      const dotProduct = positionUnit.dot(accelerationUnit);

      expect(dotProduct).toBeCloseTo(-1, 10);
    });

    it('should work with custom mu value', () => {
      const customMu = 400000;
      const gravity = new Gravity(customMu);
      const position = new Vector3D(10000, 0, 0) as Vector3D<Kilometers>;
      const velocity = new Vector3D(0, 0, 0) as Vector3D<KilometersPerSecond>;
      const state = new J2000(new EpochUTC(), position, velocity);

      const acceleration = gravity.acceleration(state);
      const expectedMag = customMu / (10000 * 10000);

      expect(acceleration.magnitude()).toBeCloseTo(expectedMag, 10);
    });
  });
});
