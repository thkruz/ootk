import { EpochUTC, Seconds } from '../../main';
import { smooth, smoothDouble, smoothTime } from '../ExponentialSmoothing';

describe('ExponentialSmoothing', () => {
  describe('smooth', () => {
    it('should return array with same length as input', () => {
      const xs = [1, 2, 3, 4, 5];
      const result = smooth(xs, 0.5);

      expect(result).toHaveLength(xs.length);
    });

    it('should return first element unchanged', () => {
      const xs = [10, 20, 30];
      const result = smooth(xs, 0.5);

      expect(result[0]).toBe(xs[0]);
    });

    it('should smooth data with alpha=0.5', () => {
      const xs = [1, 2, 3, 4];
      const result = smooth(xs, 0.5);

      expect(result[0]).toBe(1);
      expect(result[1]).toBeCloseTo(1.5);
      expect(result[2]).toBeCloseTo(2.25);
      expect(result[3]).toBeCloseTo(3.125);
    });

    it('should return original data when alpha=1', () => {
      const xs = [1, 2, 3, 4];
      const result = smooth(xs, 1);

      expect(result).toEqual(xs);
    });

    it('should return constant when alpha=0', () => {
      const xs = [5, 10, 15, 20];
      const result = smooth(xs, 0);

      expect(result).toEqual([5, 5, 5, 5]);
    });
  });

  describe('smoothDouble', () => {
    it('should return array with same length as input', () => {
      const xs = [1, 2, 3, 4, 5];
      const result = smoothDouble(xs, 0.5, 0.5);

      expect(result).toHaveLength(xs.length);
    });

    it('should initialize with first element', () => {
      const xs = [10, 20, 30];
      const result = smoothDouble(xs, 0.5, 0.5);

      expect(result[0]).toBe(xs[0]);
    });

    it('should smooth with trend adjustment', () => {
      const xs = [1, 2, 3, 4, 5];
      const result = smoothDouble(xs, 0.5, 0.5);

      expect(result[0]).toBe(1);
      expect(result[1]).toBeCloseTo(2);
    });
  });

  describe('smoothTime', () => {
    it('should return array with same length as input', () => {
      const epochs = [
        new EpochUTC(0 as Seconds),
        new EpochUTC(1000 as Seconds),
        new EpochUTC(2000 as Seconds),
      ];
      const xs = [1, 2, 3];
      const result = smoothTime(epochs, xs, 1.0);

      expect(result).toHaveLength(xs.length);
    });

    it('should return first element unchanged', () => {
      const epochs = [
        new EpochUTC(0 as Seconds),
        new EpochUTC(1000 as Seconds),
      ];
      const xs = [10, 20];
      const result = smoothTime(epochs, xs, 1.0);

      expect(result[0]).toBe(xs[0]);
    });

    it('should smooth based on time constant', () => {
      const epochs = [
        new EpochUTC(0 as Seconds),
        new EpochUTC(1 as Seconds),
        new EpochUTC(2 as Seconds),
      ];
      const xs = [0, 10, 10];
      const result = smoothTime(epochs, xs, 1.0);

      expect(result[0]).toBe(0);
      expect(result[1]).toBeGreaterThan(0);
      expect(result[1]).toBeLessThan(10);
      expect(result[2]).toBeGreaterThan(result[1]);
    });
  });
});
