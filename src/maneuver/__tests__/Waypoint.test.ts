import { vi } from 'vitest';
import { StateInterpolator } from '@src/interpolator/StateInterpolator';
import {
  EpochUTC,
  ForceModel,
  J2000,
  Kilometers,
  KilometersPerSecond,
  MetersPerSecond,
  SecondsPerMeterPerSecond,
  Thrust,
  Vector3D,
} from '@src/main';
import { LambertIOD } from '@src/orbit-determination/LambertIOD';
import { Waypoint } from '../Waypoint';


/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

describe('Waypoint', () => {
  let mockEpoch: EpochUTC;
  let mockRelativePosition: Vector3D<Kilometers>;
  let waypoint: Waypoint;

  beforeEach(() => {
    mockEpoch = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    mockRelativePosition = new Vector3D(1 as Kilometers, 2 as Kilometers, 3 as Kilometers);
    waypoint = new Waypoint(mockEpoch, mockRelativePosition);
  });

  describe('constructor', () => {
    it('should create a waypoint with epoch and relative position', () => {
      expect(waypoint.epoch).toBe(mockEpoch);
      expect(waypoint.relativePosition).toBe(mockRelativePosition);
    });
  });

  describe('_error', () => {
    it('should throw error when epoch is outside target interpolator window', () => {
      const mockState = new J2000(
        mockEpoch,
        new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );
      const mockForceModel = new ForceModel();
      const mockManeuver = new Thrust(
        mockEpoch,
        0 as MetersPerSecond,
        0 as MetersPerSecond,
        0 as MetersPerSecond,
        0 as SecondsPerMeterPerSecond,
      );
      const mockTarget = {
        interpolate: vi.fn().mockReturnValue(null),
      } as unknown as StateInterpolator;
      const components = new Float64Array([0, 0, 0]);

      expect(() => {
        Waypoint._error(waypoint, mockManeuver, mockState, mockForceModel, mockTarget, components);
      }).toThrow('Error calculation failed; epoch is outside the target interpolator ephemeris window.');
    });
  });

  describe('_refineManeuverScore', () => {
    it('should return a score function', () => {
      const mockState = {} as J2000;
      const mockForceModel = new ForceModel();
      const mockManeuver = new Thrust(
        mockEpoch,
        0 as MetersPerSecond,
        0 as MetersPerSecond,
        0 as MetersPerSecond,
        0 as SecondsPerMeterPerSecond,
      );
      const mockTarget = {} as StateInterpolator;

      const scoreFn = Waypoint._refineManeuverScore(
        waypoint,
        mockManeuver,
        mockState,
        mockForceModel,
        mockTarget,
      );

      expect(typeof scoreFn).toBe('function');
    });
  });

  describe('toManeuvers', () => {
    it('should throw error when waypoint is outside target interpolator window', () => {
      const mockInterceptor = new J2000(
        EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z'),
        new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );
      const mockPivot = EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z');
      const mockTarget = {
        interpolate: vi.fn().mockReturnValue(null),
      } as unknown as StateInterpolator;

      expect(() => {
        Waypoint.toManeuvers(mockInterceptor, mockPivot, [waypoint], mockTarget, null, null);
      }).toThrow('Waypoint outside target interpolator window.');
    });

    it('should return maneuvers array with pre and post maneuvers', () => {
      const mockInterceptor = {
        epoch: mockEpoch,
        position: new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        velocity: new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
        period: 5400,
      } as J2000;
      const mockPivot = mockEpoch;
      const preManeuver = new Thrust(mockEpoch, 0 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond, 0 as SecondsPerMeterPerSecond);
      const postManeuver = new Thrust(mockEpoch, 0 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond, 0 as SecondsPerMeterPerSecond);

      const result = Waypoint.toManeuvers(
        mockInterceptor,
        mockPivot,
        [],
        {} as StateInterpolator,
        [preManeuver],
        [postManeuver],
      );

      expect(result.length).toBe(2);
      expect(result[0]).toBe(preManeuver);
      expect(result[1]).toBe(postManeuver);
    });

    it('should throw error when Lambert solve result is null', () => {
      const mockInterceptor = new J2000(
        EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z'),
        new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );
      const mockPivot = EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z');
      const mockTargetState = new J2000(
        mockEpoch,
        new Vector3D(7100 as Kilometers, 100 as Kilometers, 100 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.4 as KilometersPerSecond, 0 as KilometersPerSecond),
      );
      const mockTarget = {
        interpolate: vi.fn().mockReturnValue(mockTargetState),
      } as unknown as StateInterpolator;

      // Mock LambertIOD to return null
      vi.spyOn(LambertIOD.prototype, 'estimate')
        .mockReturnValue(null);

      expect(() => {
        Waypoint.toManeuvers(mockInterceptor, mockPivot, [waypoint], mockTarget, null, null);
      }).toThrow('Lambert solve result is null.');
    });

    it('should process pre-maneuvers before pivot', () => {
      const mockInterceptor = new J2000(
        EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z'),
        new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );
      const mockPivot = EpochUTC.fromDateTimeString('2024-01-01T11:00:00.000Z');
      const preManeuver = new Thrust(
        mockInterceptor.epoch,
        1 as MetersPerSecond,
        0 as MetersPerSecond,
        0 as MetersPerSecond,
        0 as SecondsPerMeterPerSecond,
      );

      const result = Waypoint.toManeuvers(
        mockInterceptor,
        mockPivot,
        [],
        {} as StateInterpolator,
        [preManeuver],
        null,
      );

      expect(result).toContain(preManeuver);
    });

    it('should apply refine maneuvers when refine option is true', () => {
      const mockInterceptor = new J2000(
        EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z'),
        new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );
      const mockPivot = EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z');
      const mockTargetState = new J2000(
        mockEpoch,
        new Vector3D(7100 as Kilometers, 100 as Kilometers, 100 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.4 as KilometersPerSecond, 0 as KilometersPerSecond),
      );
      const mockTarget = {
        interpolate: vi.fn().mockReturnValue(mockTargetState),
      } as unknown as StateInterpolator;

      // Mock LambertIOD to return a valid state
      const mockLambertResult = new J2000(
        mockInterceptor.epoch,
        mockInterceptor.position,
        new Vector3D(0.1 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0.1 as KilometersPerSecond),
      );

      vi.spyOn(LambertIOD.prototype, 'estimate')
        .mockReturnValue(mockLambertResult);

      const refineManeuversSpy = vi.spyOn(Waypoint as any, '_refineManeuvers')
        .mockReturnValue([]);

      Waypoint.toManeuvers(mockInterceptor, mockPivot, [waypoint], mockTarget, null, null, {
        refine: true,
        maxIter: 100,
        printIter: false,
      });

      expect(refineManeuversSpy).toHaveBeenCalled();
    });

    it('should use custom duration rate when provided', () => {
      const mockInterceptor = new J2000(
        EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z'),
        new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
      );
      const mockPivot = EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z');
      const mockTargetState = new J2000(
        mockEpoch,
        new Vector3D(7100 as Kilometers, 100 as Kilometers, 100 as Kilometers),
        new Vector3D(0 as KilometersPerSecond, 7.4 as KilometersPerSecond, 0 as KilometersPerSecond),
      );
      const mockTarget = {
        interpolate: vi.fn().mockReturnValue(mockTargetState),
      } as unknown as StateInterpolator;

      // Mock LambertIOD to return a valid state
      const mockLambertResult = new J2000(
        mockInterceptor.epoch,
        mockInterceptor.position,
        new Vector3D(0.1 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0.1 as KilometersPerSecond),
      );

      vi.spyOn(LambertIOD.prototype, 'estimate')
        .mockReturnValue(mockLambertResult);

      const result = Waypoint.toManeuvers(
        mockInterceptor,
        mockPivot,
        [waypoint],
        mockTarget,
        null,
        null,
        { durationRate: 5.0 },
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].durationRate).toBe(5.0);
    });

    describe('_refineManeuvers', () => {
      it('should be called when refine option is true in toManeuvers', () => {
        const mockInterceptor = new J2000(
          EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z'),
          new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
          new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
        );
        const mockPivot = EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z');
        const mockTargetState = new J2000(
          mockEpoch,
          new Vector3D(7100 as Kilometers, 100 as Kilometers, 100 as Kilometers),
          new Vector3D(0 as KilometersPerSecond, 7.4 as KilometersPerSecond, 0 as KilometersPerSecond),
        );
        const mockTarget = {
          interpolate: vi.fn().mockReturnValue(mockTargetState),
        } as unknown as StateInterpolator;

        // Mock LambertIOD to return a valid state
        const mockLambertResult = new J2000(
          mockInterceptor.epoch,
          mockInterceptor.position,
          new Vector3D(0.1 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0.1 as KilometersPerSecond),
        );

        vi.spyOn(LambertIOD.prototype, 'estimate')
          .mockReturnValue(mockLambertResult);

        // Spy on _refineManeuvers to verify it receives correct parameters
        const refineManeuversSpy = vi.spyOn(Waypoint as unknown as { _refineManeuvers: () => Thrust[] }, '_refineManeuvers')
          .mockReturnValue([]);

        Waypoint.toManeuvers(mockInterceptor, mockPivot, [waypoint], mockTarget, null, null, {
          refine: true,
        });

        expect(refineManeuversSpy).toHaveBeenCalledWith(
          [waypoint],
          expect.any(Array),
          expect.any(Object),
          expect.any(Object),
          mockTarget,
          expect.objectContaining({ maxIter: 500, printIter: false }),
        );

        refineManeuversSpy.mockRestore();
      });

      it('should receive multiple waypoints and maneuvers when provided', () => {
        const mockInterceptor = new J2000(
          EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z'),
          new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
          new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
        );
        const mockPivot = EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z');
        const waypoint2 = new Waypoint(
          EpochUTC.fromDateTimeString('2024-01-01T14:00:00.000Z'),
          new Vector3D(2 as Kilometers, 3 as Kilometers, 4 as Kilometers),
        );
        const mockTargetState = new J2000(
          mockEpoch,
          new Vector3D(7100 as Kilometers, 100 as Kilometers, 100 as Kilometers),
          new Vector3D(0 as KilometersPerSecond, 7.4 as KilometersPerSecond, 0 as KilometersPerSecond),
        );
        const mockTarget = {
          interpolate: vi.fn().mockReturnValue(mockTargetState),
        } as unknown as StateInterpolator;

        // Mock LambertIOD
        const mockLambertResult = new J2000(
          mockInterceptor.epoch,
          mockInterceptor.position,
          new Vector3D(0.1 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0.1 as KilometersPerSecond),
        );

        vi.spyOn(LambertIOD.prototype, 'estimate')
          .mockReturnValue(mockLambertResult);

        const refineManeuversSpy = vi.spyOn(Waypoint as unknown as { _refineManeuvers: () => Thrust[] }, '_refineManeuvers')
          .mockReturnValue([]);

        Waypoint.toManeuvers(mockInterceptor, mockPivot, [waypoint, waypoint2], mockTarget, null, null, {
          refine: true,
        });

        expect(refineManeuversSpy).toHaveBeenCalledWith(
          [waypoint, waypoint2],
          expect.arrayContaining([expect.any(Thrust), expect.any(Thrust)]),
          expect.any(Object),
          expect.any(Object),
          mockTarget,
          expect.any(Object),
        );

        refineManeuversSpy.mockRestore();
      });

      it('should pass maxIter and printIter options to refine method', () => {
        const mockInterceptor = new J2000(
          EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z'),
          new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
          new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
        );
        const mockPivot = EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z');
        const mockTargetState = new J2000(
          mockEpoch,
          new Vector3D(7100 as Kilometers, 100 as Kilometers, 100 as Kilometers),
          new Vector3D(0 as KilometersPerSecond, 7.4 as KilometersPerSecond, 0 as KilometersPerSecond),
        );
        const mockTarget = {
          interpolate: vi.fn().mockReturnValue(mockTargetState),
        } as unknown as StateInterpolator;

        // Mock LambertIOD
        const mockLambertResult = new J2000(
          mockInterceptor.epoch,
          mockInterceptor.position,
          new Vector3D(0.1 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0.1 as KilometersPerSecond),
        );

        vi.spyOn(LambertIOD.prototype, 'estimate')
          .mockReturnValue(mockLambertResult);

        const refineManeuversSpy = vi.spyOn(Waypoint as unknown as { _refineManeuvers: () => Thrust[] }, '_refineManeuvers')
          .mockReturnValue([]);

        Waypoint.toManeuvers(mockInterceptor, mockPivot, [waypoint], mockTarget, null, null, {
          refine: true,
          maxIter: 100,
          printIter: true,
        });

        expect(refineManeuversSpy).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(Array),
          expect.any(Object),
          expect.any(Object),
          mockTarget,
          expect.objectContaining({
            maxIter: 100,
            printIter: true,
          }),
        );

        refineManeuversSpy.mockRestore();
      });

      it('should return empty array when no maneuvers provided', () => {
        const mockInterceptor = new J2000(
          EpochUTC.fromDateTimeString('2024-01-01T10:00:00.000Z'),
          new Vector3D(7000 as Kilometers, 0 as Kilometers, 0 as Kilometers),
          new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
        );
        const mockForceModel = new ForceModel();
        const mockTarget = {} as StateInterpolator;

        const result = Waypoint._refineManeuvers(
          [],
          [],
          mockInterceptor,
          mockForceModel,
          mockTarget,
        );

        expect(result).toEqual([]);
      });
    });
  });
});
