import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Vector3D } from '../../main';
import { EarthGravity } from '../EarthGravity';

describe('EarthGravity', () => {
  describe('constructor', () => {
    it('should create instance with valid degree and order', () => {
      const gravity = new EarthGravity(4, 4);

      expect(gravity.degree).toBe(4);
      expect(gravity.order).toBe(4);
      expect(gravity._asphericalFlag).toBe(true);
    });

    it('should clamp degree to maximum of 36', () => {
      const gravity = new EarthGravity(50, 4);

      expect(gravity.degree).toBe(36);
    });

    it('should clamp order to maximum of 36', () => {
      const gravity = new EarthGravity(4, 50);

      expect(gravity.order).toBe(36);
    });

    it('should clamp degree to minimum of 0', () => {
      const gravity = new EarthGravity(-5, 4);

      expect(gravity.degree).toBe(0);
    });

    it('should clamp order to minimum of 0', () => {
      const gravity = new EarthGravity(4, -5);

      expect(gravity.order).toBe(0);
    });

    it('should set asphericalFlag to false when degree < 2', () => {
      const gravity = new EarthGravity(1, 1);

      expect(gravity._asphericalFlag).toBe(false);
    });

    it('should set asphericalFlag to true when degree >= 2', () => {
      const gravity = new EarthGravity(2, 2);

      expect(gravity._asphericalFlag).toBe(true);
    });
  });

  describe('acceleration', () => {
    const epoch = EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z');
    const position = new Vector3D<Kilometers>(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers);
    const velocity = new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond);
    const state = new J2000(epoch, position, velocity);

    it('should calculate spherical acceleration for degree 0', () => {
      const gravity = new EarthGravity(0, 0);
      const acc = gravity.acceleration(state);

      expect(acc).toBeInstanceOf(Vector3D);
      expect(acc.x).toBeLessThan(0);
      expect(acc.magnitude()).toBeGreaterThan(0);
    });

    it('should calculate spherical acceleration for degree 1', () => {
      const gravity = new EarthGravity(1, 1);
      const acc = gravity.acceleration(state);

      expect(acc).toBeInstanceOf(Vector3D);
      expect(acc.magnitude()).toBeGreaterThan(0);
    });

    it('should calculate aspherical acceleration for degree >= 2', () => {
      const gravity = new EarthGravity(4, 4);
      const acc = gravity.acceleration(state);

      expect(acc).toBeInstanceOf(Vector3D);
      expect(acc.magnitude()).toBeGreaterThan(0);
    });

    it('should produce different results for different degrees', () => {
      const gravity2 = new EarthGravity(2, 2);
      const gravity4 = new EarthGravity(4, 4);

      const acc2 = gravity2.acceleration(state);
      const acc4 = gravity4.acceleration(state);

      expect(acc2.x).not.toBe(acc4.x);
    });

    it('should handle different orbital positions', () => {
      const gravity = new EarthGravity(4, 4);
      const position2 = new Vector3D<Kilometers>(0 as Kilometers, 7000 as Kilometers, 0 as Kilometers);
      const state2 = new J2000(epoch, position2, velocity);

      const acc = gravity.acceleration(state2);

      expect(acc).toBeInstanceOf(Vector3D);
      expect(acc.magnitude()).toBeGreaterThan(0);
    });

    it('should handle polar positions', () => {
      const gravity = new EarthGravity(4, 4);
      const position3 = new Vector3D<Kilometers>(0 as Kilometers, 0 as Kilometers, 7000 as Kilometers);
      const velocity3 = new Vector3D<KilometersPerSecond>(7.5 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond);
      const state3 = new J2000(epoch, position3, velocity3);

      const acc = gravity.acceleration(state3);

      expect(acc).toBeInstanceOf(Vector3D);
      expect(acc.magnitude()).toBeGreaterThan(0);
    });
  });
});
