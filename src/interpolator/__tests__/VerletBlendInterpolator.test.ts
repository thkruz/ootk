import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Vector3D } from '../../main';
import { VerletBlendInterpolator } from '../VerletBlendInterpolator';

describe('VerletBlendInterpolator', () => {
  let sampleEphemeris: J2000[];
  let interpolator: VerletBlendInterpolator;

  beforeEach(() => {
    const epoch1 = EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z');
    const epoch2 = EpochUTC.fromDateTimeString('2024-01-01T00:01:00.000Z');
    const epoch3 = EpochUTC.fromDateTimeString('2024-01-01T00:02:00.000Z');

    sampleEphemeris = [
      new J2000(epoch1, new Vector3D(7000, 0, 0) as Vector3D<Kilometers>, new Vector3D(0, 7.5, 0) as Vector3D<KilometersPerSecond>),
      new J2000(epoch2, new Vector3D(7100, 450, 0) as Vector3D<Kilometers>, new Vector3D(-0.5, 7.4, 0) as Vector3D<KilometersPerSecond>),
      new J2000(epoch3, new Vector3D(7150, 890, 0) as Vector3D<Kilometers>, new Vector3D(-1.0, 7.3, 0) as Vector3D<KilometersPerSecond>),
    ];

    interpolator = new VerletBlendInterpolator(sampleEphemeris);
  });

  describe('constructor', () => {
    it('should create an interpolator with ephemeris', () => {
      expect(interpolator).toBeDefined();
      expect(interpolator.ephemeris).toEqual(sampleEphemeris);
    });
  });

  describe('sizeBytes', () => {
    it('should calculate memory size correctly', () => {
      const expectedSize = (64 * 7 * sampleEphemeris.length) / 8;

      expect(interpolator.sizeBytes).toBe(expectedSize);
    });
  });

  describe('window', () => {
    it('should return the correct epoch window', () => {
      const window = interpolator.window();

      expect(window.start).toEqual(sampleEphemeris[0].epoch);
      expect(window.end).toEqual(sampleEphemeris[2].epoch);
    });
  });

  describe('getCachedState', () => {
    it('should return exact match for cached epoch', () => {
      const result = interpolator.getCachedState(sampleEphemeris[1].epoch);

      expect(result).toEqual(sampleEphemeris[1]);
    });

    it('should return closest state for non-exact epoch', () => {
      const testEpoch = EpochUTC.fromDateTimeString('2024-01-01T00:00:30.000Z');
      const result = interpolator.getCachedState(testEpoch);

      expect(result).toBeDefined();
      expect([sampleEphemeris[0], sampleEphemeris[1]]).toContain(result);
    });

    it('should return null for epoch outside window', () => {
      const beforeWindow = EpochUTC.fromDateTimeString('2023-12-31T23:59:00.000Z');
      const afterWindow = EpochUTC.fromDateTimeString('2024-01-01T00:03:00.000Z');

      expect(interpolator.getCachedState(beforeWindow)).toBeNull();
      expect(interpolator.getCachedState(afterWindow)).toBeNull();
    });
  });

  describe('interpolate', () => {
    it('should return exact state for cached epoch', () => {
      const result = interpolator.interpolate(sampleEphemeris[0].epoch);

      expect(result).toBeDefined();
      expect(result?.epoch).toEqual(sampleEphemeris[0].epoch);
    });

    it('should interpolate state for epoch within window', () => {
      const testEpoch = EpochUTC.fromDateTimeString('2024-01-01T00:00:30.000Z');
      const result = interpolator.interpolate(testEpoch);

      expect(result).toBeDefined();
      expect(result?.epoch.posix).toBeCloseTo(testEpoch.posix, 6);
    });

    it('should return null for epoch outside window', () => {
      const beforeWindow = EpochUTC.fromDateTimeString('2023-12-31T23:59:00.000Z');
      const afterWindow = EpochUTC.fromDateTimeString('2024-01-01T00:03:00.000Z');

      expect(interpolator.interpolate(beforeWindow)).toBeNull();
      expect(interpolator.interpolate(afterWindow)).toBeNull();
    });
  });

  describe('toCubicSpline', () => {
    it('should create a CubicSplineInterpolator', () => {
      const spline = interpolator.toCubicSpline();

      expect(spline).toBeDefined();
    });
  });

  describe('toLagrange', () => {
    it('should create a LagrangeInterpolator with default order', () => {
      const lagrange = interpolator.toLagrange();

      expect(lagrange).toBeDefined();
    });

    it('should create a LagrangeInterpolator with custom order', () => {
      const lagrange = interpolator.toLagrange(5);

      expect(lagrange).toBeDefined();
    });
  });
});
