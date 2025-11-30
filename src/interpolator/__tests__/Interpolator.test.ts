import { EpochUTC, EpochWindow, Seconds } from '../../main';
import { Interpolator } from '../Interpolator';

class MockInterpolator extends Interpolator {
  constructor(private start: EpochUTC, private end: EpochUTC) {
    super();
  }

  window(): EpochWindow {
    return new EpochWindow(this.start, this.end);
  }
}

describe('Interpolator', () => {
  let interpolator: MockInterpolator;
  let startEpoch: EpochUTC;
  let endEpoch: EpochUTC;

  beforeEach(() => {
    startEpoch = new EpochUTC(1000 as Seconds);
    endEpoch = new EpochUTC(2000 as Seconds);
    interpolator = new MockInterpolator(startEpoch, endEpoch);
  });

  describe('inWindow', () => {
    it('should return true when epoch is at the start of the window', () => {
      expect(interpolator.inWindow(startEpoch)).toBe(true);
    });

    it('should return true when epoch is at the end of the window', () => {
      expect(interpolator.inWindow(endEpoch)).toBe(true);
    });

    it('should return true when epoch is within the window', () => {
      const midEpoch = new EpochUTC(1500 as Seconds);

      expect(interpolator.inWindow(midEpoch)).toBe(true);
    });

    it('should return false when epoch is before the window', () => {
      const beforeEpoch = new EpochUTC(500 as Seconds);

      expect(interpolator.inWindow(beforeEpoch)).toBe(false);
    });

    it('should return false when epoch is after the window', () => {
      const afterEpoch = new EpochUTC(2500 as Seconds);

      expect(interpolator.inWindow(afterEpoch)).toBe(false);
    });
  });

  describe('overlap', () => {
    it('should return overlap window when interpolators fully overlap', () => {
      const other = new MockInterpolator(startEpoch, endEpoch);
      const result = interpolator.overlap(other);

      expect(result).not.toBeNull();
      expect(result?.start.posix).toBe(startEpoch.posix);
      expect(result?.end.posix).toBe(endEpoch.posix);
    });

    it('should return overlap window when interpolators partially overlap', () => {
      const other = new MockInterpolator(
        new EpochUTC(1500 as Seconds),
        new EpochUTC(2500 as Seconds),
      );
      const result = interpolator.overlap(other);

      expect(result).not.toBeNull();
      expect(result?.start.posix).toBe(1500);
      expect(result?.end.posix).toBe(2000);
    });

    it('should return overlap when other interpolator is fully contained', () => {
      const other = new MockInterpolator(
        new EpochUTC(1200 as Seconds),
        new EpochUTC(1800 as Seconds),
      );
      const result = interpolator.overlap(other);

      expect(result).not.toBeNull();
      expect(result?.start.posix).toBe(1200);
      expect(result?.end.posix).toBe(1800);
    });

    it('should return overlap when this interpolator is fully contained', () => {
      const other = new MockInterpolator(
        new EpochUTC(500 as Seconds),
        new EpochUTC(2500 as Seconds),
      );
      const result = interpolator.overlap(other);

      expect(result).not.toBeNull();
      expect(result?.start.posix).toBe(1000);
      expect(result?.end.posix).toBe(2000);
    });

    it('should return null when interpolators do not overlap', () => {
      const other = new MockInterpolator(
        new EpochUTC(2500 as Seconds),
        new EpochUTC(3000 as Seconds),
      );
      const result = interpolator.overlap(other);

      expect(result).toBeNull();
    });

    it('should return null when other interpolator is before this one', () => {
      const other = new MockInterpolator(
        new EpochUTC(500 as Seconds),
        new EpochUTC(900 as Seconds),
      );
      const result = interpolator.overlap(other);

      expect(result).toBeNull();
    });

    it('should handle adjacent windows touching at endpoints', () => {
      const other = new MockInterpolator(
        new EpochUTC(2000 as Seconds),
        new EpochUTC(3000 as Seconds),
      );
      const result = interpolator.overlap(other);

      expect(result).not.toBeNull();
      expect(result?.start.posix).toBe(2000);
      expect(result?.end.posix).toBe(2000);
    });
  });
});
