import { vi, Mocked } from 'vitest';
import { Thrust } from '../../force/Thrust';
import { EpochUTC, Kilometers, KilometersPerSecond, Seconds, StateVector, Tle, Vector3D } from '../../main';
import { Sgp4Propagator } from '../Sgp4Propagator';

describe('Sgp4Propagator', () => {
  let propagator: Sgp4Propagator;
  let mockTle: Mocked<Tle>;
  let mockJ2000State: StateVector;

  beforeEach(() => {
    mockJ2000State = {
      position: { x: 1000 as Kilometers, y: 2000 as Kilometers, z: 3000 as Kilometers } as Vector3D<Kilometers>,
      velocity: { x: 1 as KilometersPerSecond, y: 2 as KilometersPerSecond, z: 3 as KilometersPerSecond } as Vector3D<KilometersPerSecond>,
    } as StateVector;

    mockTle = {
      state: {
        toJ2000: vi.fn().mockReturnValue(mockJ2000State),
      },
      propagate: vi.fn().mockReturnValue({
        toJ2000: vi.fn().mockReturnValue({
          position: { x: 1100, y: 2100, z: 3100 },
          velocity: { x: 1.1, y: 2.1, z: 3.1 },
        }),
      }),
    } as unknown as Mocked<Tle>;

    propagator = new Sgp4Propagator(mockTle);
  });

  describe('constructor', () => {
    it('should initialize with TLE state in J2000', () => {
      expect(mockTle.state.toJ2000).toHaveBeenCalled();
      expect(propagator.state).toBe(mockJ2000State);
    });
  });

  describe('state getter', () => {
    it('should return the cached state', () => {
      expect(propagator.state).toBe(mockJ2000State);
    });
  });

  describe('ephemerisManeuver', () => {
    it('should throw error for maneuver calculations', () => {
      const start = new EpochUTC(Date.now() / 1000 as Seconds);
      const finish = new EpochUTC(Date.now() / 1000 + 3600 as Seconds);
      const maneuvers: Thrust[] = [];

      expect(() => propagator.ephemerisManeuver(start, finish, maneuvers)).toThrow(
        'Maneuvers cannot be modelled with SGP4.',
      );
    });
  });

  describe('maneuver', () => {
    it('should throw error for maneuver operations', () => {
      const mockThrust = {} as Thrust;

      expect(() => propagator.maneuver(mockThrust)).toThrow(
        'Maneuvers cannot be modelled with SGP4.',
      );
    });
  });

  describe('propagate', () => {
    it('should propagate to given epoch and update cache', () => {
      const epoch = new EpochUTC(Date.now() / 1000 as Seconds);
      const result = propagator.propagate(epoch);

      expect(mockTle.propagate).toHaveBeenCalledWith(epoch);
      expect(result.position.x).toBe(1100);
      expect(propagator.state).toBe(result);
    });
  });

  describe('reset', () => {
    it('should reset cache to initial TLE state', () => {
      const epoch = new EpochUTC(Date.now() / 1000 as Seconds);

      propagator.propagate(epoch);

      propagator.reset();

      expect(mockTle.state.toJ2000).toHaveBeenCalled();
      expect(propagator.state).toBe(mockJ2000State);
    });
  });

  describe('checkpoint', () => {
    it('should save current state and return checkpoint index', () => {
      const index = propagator.checkpoint();

      expect(index).toBe(0);
    });

    it('should return incremented index for multiple checkpoints', () => {
      const index1 = propagator.checkpoint();
      const index2 = propagator.checkpoint();

      expect(index1).toBe(0);
      expect(index2).toBe(1);
    });
  });

  describe('clearCheckpoints', () => {
    it('should clear all checkpoints', () => {
      propagator.checkpoint();
      propagator.checkpoint();
      propagator.clearCheckpoints();

      const index = propagator.checkpoint();

      expect(index).toBe(0);
    });
  });

  describe('restore', () => {
    it('should restore state from checkpoint', () => {
      const initialState = propagator.state;
      const checkpointIndex = propagator.checkpoint();

      const epoch = new EpochUTC(Date.now() / 1000 as Seconds);

      propagator.propagate(epoch);

      propagator.restore(checkpointIndex);

      expect(propagator.state).toBe(initialState);
    });

    it('should restore correct state from multiple checkpoints', () => {
      propagator.checkpoint();

      propagator.propagate(new EpochUTC(Date.now() / 1000 as Seconds));
      const state1 = propagator.state;
      const checkpoint1 = propagator.checkpoint();

      propagator.propagate(new EpochUTC(Date.now() / 1000 + 1 as Seconds));
      propagator.restore(checkpoint1);
      expect(propagator.state).toBe(state1);
    });
  });
});
