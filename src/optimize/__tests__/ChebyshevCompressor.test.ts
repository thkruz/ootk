import { vi } from 'vitest';
import { EpochUTC, EpochWindow, J2000, Kilometers, KilometersPerSecond, Seconds, Vector3D } from '../../main';
import { StateInterpolator } from '../../interpolator/StateInterpolator';
import { ChebyshevCompressor } from '../ChebyshevCompressor';

describe('ChebyshevCompressor', () => {
  let mockInterpolator: StateInterpolator;
  let compressor: ChebyshevCompressor;

  beforeEach(() => {
    const startEpoch = new EpochUTC(0 as Seconds);
    const endEpoch = new EpochUTC(5400 as Seconds); // 90 minutes = one orbit period
    const mockJ2000 = new J2000(
      startEpoch,
      new Vector3D(6778 as Kilometers, 0 as Kilometers, 0 as Kilometers),
      new Vector3D(0 as KilometersPerSecond, 7.5 as KilometersPerSecond, 0 as KilometersPerSecond),
    );

    mockInterpolator = {
      window: vi.fn().mockReturnValue(new EpochWindow(startEpoch, endEpoch)),
      interpolate: vi.fn().mockReturnValue(mockJ2000),
      inWindow: vi.fn().mockReturnValue(true),
      overlap: vi.fn(),
      sizeBytes: 0,
    } as unknown as StateInterpolator;

    compressor = new ChebyshevCompressor(mockInterpolator);
  });

  test('should create an instance of ChebyshevCompressor', () => {
    expect(compressor).toBeInstanceOf(ChebyshevCompressor);
  });

  test('should compress ephemeris data', () => {
    const compressed = compressor.compress(21);

    expect(compressed).toBeDefined();
    expect(mockInterpolator.window).toHaveBeenCalled();
    expect(mockInterpolator.interpolate).toHaveBeenCalled();
  });
});
