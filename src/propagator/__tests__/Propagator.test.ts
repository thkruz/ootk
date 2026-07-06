import { Thrust } from '../../force/Thrust';
import { VerletBlendInterpolator } from '../../interpolator/VerletBlendInterpolator';
import { EpochUTC, J2000, Seconds } from '../../main';
import { Propagator } from '../Propagator';

// Mock implementation for testing
class MockPropagator extends Propagator {
  private _state: J2000;
  private checkpoints: J2000[] = [];

  constructor(initialState: J2000) {
    super();
    this._state = initialState;
  }

  propagate(): J2000 {
    // Simple mock: return state with slight variations based on epoch
    return this._state;
  }

  reset(): void {
    this.checkpoints = [];
  }

  checkpoint(): number {
    this.checkpoints.push(this._state);

    return this.checkpoints.length - 1;
  }

  restore(index: number): void {
    if (index >= 0 && index < this.checkpoints.length) {
      this._state = this.checkpoints[index];
    }
  }

  clearCheckpoints(): void {
    this.checkpoints = [];
  }

  get state(): J2000 {
    return this._state;
  }

  setState(state: J2000): void {
    this._state = state;
  }
}

describe('Propagator', () => {
  let mockState: J2000;
  let propagator: MockPropagator;
  let startEpoch: EpochUTC;

  beforeEach(() => {
    mockState = {
      position: { x: 7000, y: 0, z: 0, magnitude: () => 7000 },
      velocity: { x: 0, y: 7.5, z: 0 },
      epoch: new EpochUTC(0 as Seconds),
      period: 5400,
    } as J2000;
    propagator = new MockPropagator(mockState);
    startEpoch = new EpochUTC(0 as Seconds);
  });

  describe('ephemeris', () => {
    it('should generate ephemeris over time interval', () => {
      const stop = startEpoch.roll(300 as Seconds);
      const result = propagator.ephemeris(startEpoch, stop, 60 as Seconds);

      expect(result).toBeInstanceOf(VerletBlendInterpolator);
    });

    it('should use default interval of 60 seconds', () => {
      const stop = startEpoch.roll(120 as Seconds);
      const result = propagator.ephemeris(startEpoch, stop);

      expect(result).toBeInstanceOf(VerletBlendInterpolator);
    });
  });

  describe('checkpoint and restore', () => {
    it('should checkpoint and restore state', () => {
      const index = propagator.checkpoint();

      expect(index).toBe(0);

      propagator.restore(index);
      expect(propagator.state).toBe(mockState);
    });

    it('should clear checkpoints', () => {
      propagator.checkpoint();
      propagator.clearCheckpoints();

      expect(() => propagator.restore(0)).not.toThrow();
    });
  });

  describe('maneuver', () => {
    it('should generate states over maneuver duration', () => {
      const thrust = {
        start: startEpoch,
        stop: startEpoch.roll(120 as Seconds),
      } as Thrust;

      const result = propagator.maneuver(thrust, 60 as Seconds);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('ephemerisManeuver', () => {
    it('should generate maneuver ephemeris', () => {
      const finish = startEpoch.roll(300 as Seconds);
      const maneuvers: Thrust[] = [];

      const result = propagator.ephemerisManeuver(startEpoch, finish, maneuvers, 60 as Seconds);

      expect(result).toBeInstanceOf(VerletBlendInterpolator);
    });
  });

  describe('reset', () => {
    it('should reset propagator state', () => {
      propagator.reset();

      expect(() => propagator.reset()).not.toThrow();
    });

    describe('ascendingNodeEpoch', () => {
      it('should find ascending node epoch', () => {
        const mockStateWithZCrossing = {
          position: { x: 7000, y: 0, z: -100, magnitude: () => 7000 },
          velocity: { x: 0, y: 7.5, z: 1.0 },
          epoch: new EpochUTC(0 as Seconds),
          period: 5400,
        } as J2000;

        propagator.setState(mockStateWithZCrossing);
        const result = propagator.ascendingNodeEpoch(startEpoch);

        expect(result).toBeInstanceOf(EpochUTC);
      });
    });

    describe('descendingNodeEpoch', () => {
      it('should find descending node epoch', () => {
        const mockStateWithZCrossing = {
          position: { x: 7000, y: 0, z: 100, magnitude: () => 7000 },
          velocity: { x: 0, y: 7.5, z: -1.0 },
          epoch: new EpochUTC(0 as Seconds),
          period: 5400,
        } as J2000;

        propagator.setState(mockStateWithZCrossing);
        const result = propagator.descendingNodeEpoch(startEpoch);

        expect(result).toBeInstanceOf(EpochUTC);
      });
    });

    describe('apogeeEpoch', () => {
      it('should find apogee epoch', () => {
        const result = propagator.apogeeEpoch(startEpoch);

        expect(result).toBeInstanceOf(EpochUTC);
      });
    });

    describe('perigeeEpoch', () => {
      it('should find perigee epoch', () => {
        const result = propagator.perigeeEpoch(startEpoch);

        expect(result).toBeInstanceOf(EpochUTC);
      });
    });
  });
});
