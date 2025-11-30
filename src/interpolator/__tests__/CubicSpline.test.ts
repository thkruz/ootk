import { Seconds, Vector3D } from '../../main';
import { CubicSpline } from '../CubicSpline';

describe('CubicSpline', () => {
  let spline: CubicSpline;
  const t0 = 0 as Seconds;
  const t1 = 10 as Seconds;
  const p0 = new Vector3D(0, 0, 0);
  const p1 = new Vector3D(10, 10, 10);
  const m0 = new Vector3D(1, 1, 1);
  const m1 = new Vector3D(1, 1, 1);

  beforeEach(() => {
    spline = new CubicSpline(t0, p0, m0, t1, p1, m1);
  });

  describe('constructor', () => {
    it('should create a CubicSpline instance with correct properties', () => {
      expect(spline.t0).toBe(t0);
      expect(spline.t1).toBe(t1);
      expect(spline.p0).toBe(p0);
      expect(spline.p1).toBe(p1);
      expect(spline.m0).toBe(m0);
      expect(spline.m1).toBe(m1);
    });
  });

  describe('interpolate', () => {
    it('should return position and velocity at t0', () => {
      const [position, velocity] = spline.interpolate(t0);

      expect(position.x).toBeCloseTo(p0.x, 5);
      expect(position.y).toBeCloseTo(p0.y, 5);
      expect(position.z).toBeCloseTo(p0.z, 5);
      expect(velocity).toBeDefined();
    });

    it('should return position and velocity at t1', () => {
      const [position, velocity] = spline.interpolate(t1);

      expect(position.x).toBeCloseTo(p1.x, 5);
      expect(position.y).toBeCloseTo(p1.y, 5);
      expect(position.z).toBeCloseTo(p1.z, 5);
      expect(velocity).toBeDefined();
    });

    it('should return position and velocity at midpoint', () => {
      const tMid = ((t0 + t1) / 2) as Seconds;
      const [position, velocity] = spline.interpolate(tMid);

      expect(position).toBeDefined();
      expect(velocity).toBeDefined();
      expect(position.x).toBeGreaterThan(p0.x);
      expect(position.x).toBeLessThan(p1.x);
    });

    it('should return an array with two Vector3D elements', () => {
      const result = spline.interpolate(5 as Seconds);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Vector3D);
      expect(result[1]).toBeInstanceOf(Vector3D);
    });

    it('should handle interpolation beyond t1', () => {
      const [position, velocity] = spline.interpolate(15 as Seconds);

      expect(position).toBeDefined();
      expect(velocity).toBeDefined();
    });

    it('should handle interpolation before t0', () => {
      const [position, velocity] = spline.interpolate(-5 as Seconds);

      expect(position).toBeDefined();
      expect(velocity).toBeDefined();
    });
  });
});
