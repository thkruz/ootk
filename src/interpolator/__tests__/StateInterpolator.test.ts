import { EpochUTC, EpochWindow, J2000, Seconds } from '../../main';
import { StateInterpolator } from '../StateInterpolator';

// Concrete implementation for testing
class TestStateInterpolator extends StateInterpolator {
  private start_: EpochUTC;
  private end_: EpochUTC;

  constructor() {
    super();
    this.start_ = new EpochUTC(0 as Seconds);
    this.end_ = new EpochUTC(86400 as Seconds);
  }

  override window(): EpochWindow {
    return new EpochWindow(this.start_, this.end_);
  }

  override interpolate(_epoch: EpochUTC): J2000 | null {
    return null;
  }
}

describe('StateInterpolator', () => {
  let interpolator: TestStateInterpolator;

  beforeEach(() => {
    interpolator = new TestStateInterpolator();
  });

  describe('interpolate', () => {
    it('should be an abstract method that must be implemented', () => {
      const epoch = EpochUTC.fromDateTime(new Date());

      expect(() => interpolator.interpolate(epoch)).not.toThrow();
    });

    it('should return null in test implementation', () => {
      const epoch = EpochUTC.fromDateTime(new Date());
      const result = interpolator.interpolate(epoch);

      expect(result).toBeNull();
    });
  });

  describe('sizeBytes', () => {
    it('should throw "Not implemented" error', () => {
      expect(() => interpolator.sizeBytes).toThrow('Not implemented.');
    });
  });

  describe('inheritance', () => {
    it('should extend Interpolator', () => {
      expect(interpolator).toBeInstanceOf(StateInterpolator);
    });
  });
});
