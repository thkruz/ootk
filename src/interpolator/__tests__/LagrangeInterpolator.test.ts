import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Seconds, Vector3D } from '../../main';
import { LagrangeInterpolator } from '../LagrangeInterpolator';

describe('LagrangeInterpolator', () => {
  let testEphemeris: J2000[];
  let interpolator: LagrangeInterpolator;

  beforeEach(() => {
    // Create sample ephemeris data for testing
    testEphemeris = [
      new J2000(new EpochUTC(0 as Seconds), new Vector3D(1000, 2000, 3000) as Vector3D<Kilometers>, new Vector3D(1, 2, 3) as Vector3D<KilometersPerSecond>),
      new J2000(new EpochUTC(10 as Seconds), new Vector3D(1100, 2100, 3100) as Vector3D<Kilometers>, new Vector3D(1.1, 2.1, 3.1) as Vector3D<KilometersPerSecond>),
      new J2000(new EpochUTC(20 as Seconds), new Vector3D(1200, 2200, 3200) as Vector3D<Kilometers>, new Vector3D(1.2, 2.2, 3.2) as Vector3D<KilometersPerSecond>),
      new J2000(new EpochUTC(30 as Seconds), new Vector3D(1300, 2300, 3300) as Vector3D<Kilometers>, new Vector3D(1.3, 2.3, 3.3) as Vector3D<KilometersPerSecond>),
      new J2000(new EpochUTC(40 as Seconds), new Vector3D(1400, 2400, 3400) as Vector3D<Kilometers>, new Vector3D(1.4, 2.4, 3.4) as Vector3D<KilometersPerSecond>),
      new J2000(new EpochUTC(50 as Seconds), new Vector3D(1500, 2500, 3500) as Vector3D<Kilometers>, new Vector3D(1.5, 2.5, 3.5) as Vector3D<KilometersPerSecond>),
    ];

    interpolator = LagrangeInterpolator.fromEphemeris(testEphemeris, 6);
  });

  describe('constructor', () => {
    it('should create instance with provided arrays', () => {
      const t = new Float64Array([0, 10, 20]);
      const x = new Float64Array([1000, 1100, 1200]);
      const y = new Float64Array([2000, 2100, 2200]);
      const z = new Float64Array([3000, 3100, 3200]);

      const interp = new LagrangeInterpolator(t, x, y, z, 3);

      expect(interp).toBeInstanceOf(LagrangeInterpolator);
    });
  });

  describe('fromEphemeris', () => {
    it('should create interpolator from ephemeris array', () => {
      expect(interpolator).toBeInstanceOf(LagrangeInterpolator);
    });

    it('should use default order of 10', () => {
      const interp = LagrangeInterpolator.fromEphemeris(testEphemeris);

      expect(interp).toBeInstanceOf(LagrangeInterpolator);
    });
  });

  describe('sizeBytes', () => {
    it('should calculate correct size in bytes', () => {
      const expectedSize = (64 * 4 * testEphemeris.length) / 8;

      expect(interpolator.sizeBytes).toBe(expectedSize);
    });
  });

  describe('interpolate', () => {
    it('should interpolate position at given epoch', () => {
      const epoch = new EpochUTC(15 as Seconds);
      const result = interpolator.interpolate(epoch);

      expect(result).not.toBeNull();
      expect(result?.epoch).toBe(epoch);
      expect(result?.position.x).toBeCloseTo(1150, 0);
      expect(result?.position.y).toBeCloseTo(2150, 0);
      expect(result?.position.z).toBeCloseTo(3150, 0);
    });

    it('should return null for epoch outside window', () => {
      const epoch = new EpochUTC(100 as Seconds);
      const result = interpolator.interpolate(epoch);

      expect(result).toBeNull();
    });

    it('should interpolate at exact ephemeris point', () => {
      const epoch = new EpochUTC(20 as Seconds);
      const result = interpolator.interpolate(epoch);

      expect(result).not.toBeNull();
      expect(result?.position.x).toBeCloseTo(1200, 0);
    });
  });

  describe('window', () => {
    it('should return correct epoch window', () => {
      const window = interpolator.window();

      expect(window.start.posix).toBe(0);
      expect(window.end.posix).toBe(50);
    });
  });

  describe('edge cases', () => {
    it('should handle interpolation at start of window', () => {
      const epoch = new EpochUTC(0 as Seconds);
      const result = interpolator.interpolate(epoch);

      expect(result).not.toBeNull();
      expect(result?.position.x).toBeCloseTo(1000, 0);
    });

    it('should handle interpolation at end of window', () => {
      const epoch = new EpochUTC(50 as Seconds);
      const result = interpolator.interpolate(epoch);

      expect(result).not.toBeNull();
      expect(result?.position.x).toBeCloseTo(1500, 0);
    });

    it('should handle small ephemeris arrays', () => {
      const smallEphemeris = [
        new J2000(new EpochUTC(0 as Seconds), new Vector3D(1000, 2000, 3000) as Vector3D<Kilometers>, new Vector3D(1, 2, 3) as Vector3D<KilometersPerSecond>),
        new J2000(new EpochUTC(10 as Seconds), new Vector3D(1100, 2100, 3100) as Vector3D<Kilometers>, new Vector3D(1.1, 2.1, 3.1) as Vector3D<KilometersPerSecond>),
      ];

      const smallInterpolator = LagrangeInterpolator.fromEphemeris(smallEphemeris, 2);
      const result = smallInterpolator.interpolate(new EpochUTC(5 as Seconds));

      expect(result).not.toBeNull();
    });
  });
});
