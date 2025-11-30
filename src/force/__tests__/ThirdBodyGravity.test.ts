import { J2000 } from '@src/coordinate';
import { EpochUTC, Seconds, Vector3D } from '@src/main';
import { ThirdBodyGravity } from '../ThirdBodyGravity';

describe('ThirdBodyGravity', () => {
  describe('constructor', () => {
    it('should create instance with default values (moon and sun disabled)', () => {
      const gravity = new ThirdBodyGravity();

      expect(gravity.moon).toBe(false);
      expect(gravity.sun).toBe(false);
    });

    it('should create instance with moon enabled only', () => {
      const gravity = new ThirdBodyGravity(true);

      expect(gravity.moon).toBe(true);
      expect(gravity.sun).toBe(false);
    });

    it('should create instance with sun enabled only', () => {
      const gravity = new ThirdBodyGravity(false, true);

      expect(gravity.moon).toBe(false);
      expect(gravity.sun).toBe(true);
    });

    it('should create instance with both moon and sun enabled', () => {
      const gravity = new ThirdBodyGravity(true, true);

      expect(gravity.moon).toBe(true);
      expect(gravity.sun).toBe(true);
    });

    it('should create instance with both moon and sun disabled', () => {
      const gravity = new ThirdBodyGravity(false, false);

      expect(gravity.moon).toBe(false);
      expect(gravity.sun).toBe(false);
    });

    describe('acceleration', () => {
      it('should return origin vector when both moon and sun are disabled', () => {
        const gravity = new ThirdBodyGravity(false, false);
        const state = {
          epoch: new EpochUTC(new Date('2024-01-01T00:00:00.000Z').getTime() / 1000 as Seconds),
          position: new Vector3D(7000, 0, 0),
          velocity: new Vector3D(0, 7.5, 0),
        } as J2000;

        const result = gravity.acceleration(state);

        expect(result.x).toBe(0);
        expect(result.y).toBe(0);
        expect(result.z).toBe(0);
      });

      it('should return non-zero acceleration when moon is enabled', () => {
        const gravity = new ThirdBodyGravity(true, false);
        const state = {
          epoch: new EpochUTC(new Date('2024-01-01T00:00:00.000Z').getTime() / 1000 as Seconds),
          position: new Vector3D(7000, 0, 0),
          velocity: new Vector3D(0, 7.5, 0),
        } as J2000;

        const result = gravity.acceleration(state);

        expect(result.magnitude()).toBeGreaterThan(0);
      });

      it('should return non-zero acceleration when sun is enabled', () => {
        const gravity = new ThirdBodyGravity(false, true);
        const state = {
          epoch: new EpochUTC(new Date('2024-01-01T00:00:00.000Z').getTime() / 1000 as Seconds),
          position: new Vector3D(7000, 0, 0),
          velocity: new Vector3D(0, 7.5, 0),
        } as J2000;

        const result = gravity.acceleration(state);

        expect(result.magnitude()).toBeGreaterThan(0);
      });

      it('should return combined acceleration when both moon and sun are enabled', () => {
        const gravity = new ThirdBodyGravity(true, true);
        const state = {
          epoch: new EpochUTC(new Date('2024-01-01T00:00:00.000Z').getTime() / 1000 as Seconds),
          position: new Vector3D(7000, 0, 0),
          velocity: new Vector3D(0, 7.5, 0),
        } as J2000;

        const result = gravity.acceleration(state);

        expect(result.magnitude()).toBeGreaterThan(0);
      });

      it('should return different accelerations for different states', () => {
        const gravity = new ThirdBodyGravity(true, true);
        const state1 = {
          epoch: new EpochUTC(new Date('2024-01-01T00:00:00.000Z').getTime() / 1000 as Seconds),
          position: new Vector3D(7000, 0, 0),
          velocity: new Vector3D(0, 7.5, 0),
        } as J2000;
        const state2 = {
          epoch: new EpochUTC(new Date('2024-06-01T00:00:00.000Z').getTime() / 1000 as Seconds),
          position: new Vector3D(0, 7000, 0),
          velocity: new Vector3D(-7.5, 0, 0),
        } as J2000;

        const result1 = gravity.acceleration(state1);
        const result2 = gravity.acceleration(state2);

        expect(result1.x).not.toBe(result2.x);
        expect(result1.y).not.toBe(result2.y);
        expect(result1.z).not.toBe(result2.z);
      });
    });
  });
});
