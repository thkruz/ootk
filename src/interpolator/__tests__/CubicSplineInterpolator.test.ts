import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Vector3D } from '../../main';
import { CubicSplineInterpolator } from '../CubicSplineInterpolator';

describe('CubicSplineInterpolator', () => {
  const epoch1 = EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z');
  const epoch2 = EpochUTC.fromDateTimeString('2024-01-01T01:00:00.000Z');
  const epoch3 = EpochUTC.fromDateTimeString('2024-01-01T02:00:00.000Z');

  const pos1 = new Vector3D(7000, 0, 0) as Vector3D<Kilometers>;
  const vel1 = new Vector3D(0, 7.5, 0) as Vector3D<KilometersPerSecond>;
  const pos2 = new Vector3D(7100, 100, 0) as Vector3D<Kilometers>;
  const vel2 = new Vector3D(0, 7.6, 0) as Vector3D<KilometersPerSecond>;
  const pos3 = new Vector3D(7200, 200, 0) as Vector3D<Kilometers>;
  const vel3 = new Vector3D(0, 7.7, 0) as Vector3D<KilometersPerSecond>;

  const ephemeris = [
    new J2000(epoch1, pos1, vel1),
    new J2000(epoch2, pos2, vel2),
    new J2000(epoch3, pos3, vel3),
  ];

  describe('fromEphemeris', () => {
    it('should create interpolator from ephemeris data', () => {
      const interpolator = CubicSplineInterpolator.fromEphemeris(ephemeris);

      expect(interpolator).toBeInstanceOf(CubicSplineInterpolator);
    });

    it('should create n-1 splines for n ephemeris points', () => {
      const interpolator = CubicSplineInterpolator.fromEphemeris(ephemeris);

      expect(interpolator.sizeBytes).toBeGreaterThan(0);
    });
  });

  describe('sizeBytes', () => {
    it('should calculate memory size correctly', () => {
      const interpolator = CubicSplineInterpolator.fromEphemeris(ephemeris);
      const expectedSize = (64 * 14 * 2) / 8; // 2 splines for 3 points

      expect(interpolator.sizeBytes).toBe(expectedSize);
    });
  });

  describe('interpolate', () => {
    it('should interpolate state at given epoch within window', () => {
      const interpolator = CubicSplineInterpolator.fromEphemeris(ephemeris);
      const midEpoch = EpochUTC.fromDateTimeString('2024-01-01T00:30:00.000Z');

      const result = interpolator.interpolate(midEpoch);

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(J2000);
    });

    it('should return null for epoch before window', () => {
      const interpolator = CubicSplineInterpolator.fromEphemeris(ephemeris);
      const beforeEpoch = EpochUTC.fromDateTimeString('2023-12-31T23:00:00.000Z');

      const result = interpolator.interpolate(beforeEpoch);

      expect(result).toBeNull();
    });

    it('should return null for epoch after window', () => {
      const interpolator = CubicSplineInterpolator.fromEphemeris(ephemeris);
      const afterEpoch = EpochUTC.fromDateTimeString('2024-01-01T03:00:00.000Z');

      const result = interpolator.interpolate(afterEpoch);

      expect(result).toBeNull();
    });

    it('should return state at exact ephemeris point', () => {
      const interpolator = CubicSplineInterpolator.fromEphemeris(ephemeris);

      const result = interpolator.interpolate(epoch1);

      expect(result).not.toBeNull();
      expect(result!.epoch.posix).toBe(epoch1.posix);
    });
  });

  describe('window', () => {
    it('should return correct epoch window', () => {
      const interpolator = CubicSplineInterpolator.fromEphemeris(ephemeris);

      const window = interpolator.window();

      expect(window.start.posix).toBe(epoch1.posix);
      expect(window.end.posix).toBe(epoch3.posix);
    });
  });
});
