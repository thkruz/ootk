import { Seconds } from '@src/main';
import { ChebyshevCoefficients } from '../ChebyshevCoefficients';

describe('ChebyshevCoefficients', () => {
  let coeffs: ChebyshevCoefficients;
  const a = 0 as Seconds;
  const b = 100 as Seconds;
  const cx = new Float64Array([1.0, 2.0, 3.0, 4.0]);
  const cy = new Float64Array([5.0, 6.0, 7.0, 8.0]);
  const cz = new Float64Array([9.0, 10.0, 11.0, 12.0]);

  beforeEach(() => {
    coeffs = new ChebyshevCoefficients(a, b, cx, cy, cz);
  });

  describe('constructor', () => {
    it('should initialize with correct bounds', () => {
      expect(coeffs.a).toBe(a);
      expect(coeffs.b).toBe(b);
    });

    it('should compute derivative coefficients', () => {
      expect(coeffs.cxd_).toBeDefined();
      expect(coeffs.cyd_).toBeDefined();
      expect(coeffs.czd_).toBeDefined();
      expect(coeffs.cxd_.length).toBe(cx.length);
    });
  });

  describe('sizeBytes', () => {
    it('should return the correct size in bytes', () => {
      const expectedSize = (64 * 2 + 64 * 3 * cx.length) / 8;

      expect(coeffs.sizeBytes).toBe(expectedSize);
    });
  });

  describe('evaluate', () => {
    it('should evaluate polynomial at midpoint', () => {
      const t = (a + b) / 2;
      const result = coeffs.evaluate(cx, t);

      expect(typeof result).toBe('number');
      expect(isFinite(result)).toBe(true);
    });

    it('should evaluate polynomial at lower bound', () => {
      const result = coeffs.evaluate(cx, a);

      expect(typeof result).toBe('number');
      expect(isFinite(result)).toBe(true);
    });

    it('should evaluate polynomial at upper bound', () => {
      const result = coeffs.evaluate(cx, b);

      expect(typeof result).toBe('number');
      expect(isFinite(result)).toBe(true);
    });

    it('should handle single coefficient', () => {
      const singleCoeff = new Float64Array([5.0]);
      const result = coeffs.evaluate(singleCoeff, 50);

      expect(result).toBe(2.5);
    });
  });

  describe('interpolate', () => {
    it('should return position and velocity', () => {
      const t = 50;
      const result = coeffs.interpolate(t);

      expect(result.position).toBeDefined();
      expect(result.velocity).toBeDefined();
      expect(result.position.x).toBeDefined();
      expect(result.position.y).toBeDefined();
      expect(result.position.z).toBeDefined();
      expect(result.velocity.x).toBeDefined();
      expect(result.velocity.y).toBeDefined();
      expect(result.velocity.z).toBeDefined();
    });

    it('should interpolate at different time values', () => {
      const t1 = 25;
      const t2 = 75;
      const result1 = coeffs.interpolate(t1);
      const result2 = coeffs.interpolate(t2);

      expect(result1.position.x).not.toBe(result2.position.x);
      expect(result1.velocity.x).not.toBe(result2.velocity.x);
    });

    it('should return finite values', () => {
      const result = coeffs.interpolate(50);

      expect(isFinite(result.position.x)).toBe(true);
      expect(isFinite(result.position.y)).toBe(true);
      expect(isFinite(result.position.z)).toBe(true);
      expect(isFinite(result.velocity.x)).toBe(true);
      expect(isFinite(result.velocity.y)).toBe(true);
      expect(isFinite(result.velocity.z)).toBe(true);
    });
  });
});
