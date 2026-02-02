import { vi } from 'vitest';
import { EpochUTC, Seconds } from '../../main';
import { ChebyshevCoefficients } from '../ChebyshevCoefficients';
import { ChebyshevInterpolator } from '../ChebyshevInterpolator';

describe('ChebyshevInterpolator', () => {
  let mockCoefficients: ChebyshevCoefficients[];
  let interpolator: ChebyshevInterpolator;

  beforeEach(() => {
    mockCoefficients = [
      {
        a: 1000,
        b: 2000,
        sizeBytes: 100,
        interpolate: vi.fn().mockReturnValue({
          position: { x: 1, y: 2, z: 3 },
          velocity: { x: 0.1, y: 0.2, z: 0.3 },
        }),
      } as unknown as ChebyshevCoefficients,
      {
        a: 2000,
        b: 3000,
        sizeBytes: 100,
        interpolate: vi.fn().mockReturnValue({
          position: { x: 4, y: 5, z: 6 },
          velocity: { x: 0.4, y: 0.5, z: 0.6 },
        }),
      } as unknown as ChebyshevCoefficients,
    ];
    interpolator = new ChebyshevInterpolator(mockCoefficients);
  });

  describe('sizeBytes', () => {
    it('should calculate total size from all coefficients', () => {
      expect(interpolator.sizeBytes).toBe(200);
    });
  });

  describe('window', () => {
    it('should return window from first to last coefficient', () => {
      const window = interpolator.window();

      expect(window.start.posix).toBe(1000);
      expect(window.end.posix).toBe(3000);
    });
  });

  describe('interpolate', () => {
    it('should return null when epoch is outside window', () => {
      const epoch = new EpochUTC(500 as Seconds);
      const result = interpolator.interpolate(epoch);

      expect(result).toBeNull();
    });

    it('should interpolate when epoch is in first coefficient range', () => {
      const epoch = new EpochUTC(1500 as Seconds);
      const result = interpolator.interpolate(epoch);

      expect(result).not.toBeNull();
      expect(result?.position.x).toBe(1);
      expect(result?.velocity.x).toBe(0.1);
    });

    it('should interpolate when epoch is in second coefficient range', () => {
      const epoch = new EpochUTC(2500 as Seconds);
      const result = interpolator.interpolate(epoch);

      expect(result).not.toBeNull();
      expect(result?.position.x).toBe(4);
      expect(result?.velocity.x).toBe(0.4);
    });

    it('should use binary search to match coefficients', () => {
      const epoch = new EpochUTC(2001 as Seconds);

      interpolator.interpolate(epoch);
      expect(mockCoefficients[1].interpolate).toHaveBeenCalledWith(2001);
    });
  });
});
