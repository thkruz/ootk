import { describe, expect, it } from 'vitest';
import { ebN0FromCno, marginAtRange, thresholdRangeKm } from '../LinkBudgetSweep';

describe('LinkBudgetSweep', () => {
  it('computes Eb/N0 from C/N0', () => {
    expect(ebN0FromCno(50, 10000)).toBeCloseTo(10, 6);
  });

  it('loses 6.02 dB when range doubles', () => {
    expect(marginAtRange(10, 1000, 2000)).toBeCloseTo(10 - 6.0206, 3);
  });

  it('gives zero margin at the threshold range', () => {
    const d = thresholdRangeKm(12, 1000);

    expect(marginAtRange(12, 1000, d)).toBeCloseTo(0, 9);
    expect(thresholdRangeKm(0, 1000)).toBeCloseTo(1000, 9);
  });

  it('rejects invalid input', () => {
    expect(() => ebN0FromCno(50, 0)).toThrow(RangeError);
    expect(() => marginAtRange(1, 0, 5)).toThrow(RangeError);
    expect(() => thresholdRangeKm(1, -1)).toThrow(RangeError);
  });
});
