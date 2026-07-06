import { EpochUTC, EpochWindow, Seconds } from '../../main';
import { FieldInterpolator } from '../FieldInterpolator';

class TestFieldInterpolator extends FieldInterpolator {
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

  override interpolate(final: unknown, EpochUTC: unknown, epoch: unknown): unknown {
    return { final, EpochUTC, epoch };
  }
}

describe('FieldInterpolator', () => {
  let interpolator: TestFieldInterpolator;

  beforeEach(() => {
    interpolator = new TestFieldInterpolator();
  });

  it('should create an instance', () => {
    expect(interpolator).toBeInstanceOf(FieldInterpolator);
  });

  it('should have Float64List property', () => {
    expect(interpolator.Float64List).toBeUndefined();
    interpolator.Float64List = new Float64Array([1, 2, 3]);
    expect(interpolator.Float64List).toBeInstanceOf(Float64Array);
    expect(interpolator.Float64List.length).toBe(3);
  });

  it('should implement interpolate method', () => {
    const final = { x: 1, y: 2 };
    const epochUTC = 12345;
    const epoch = 67890;

    const result = interpolator.interpolate(final, epochUTC, epoch);

    expect(result).toEqual({ final, EpochUTC: epochUTC, epoch });
  });

  it('should handle Float64Array assignment', () => {
    const arr = new Float64Array([1.5, 2.5, 3.5]);

    interpolator.Float64List = arr;

    expect(interpolator.Float64List).toBe(arr);
    expect(interpolator.Float64List![0]).toBe(1.5);
  });
});
