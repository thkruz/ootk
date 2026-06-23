import { RCS_VMAG_ESTIMATE_MAX, RCS_VMAG_ESTIMATE_MIN, estimateVmagFromRcs } from '../photometry';

describe('estimateVmagFromRcs', () => {
  it('returns -1.3 for a 1 square meter radar cross section', () => {
    expect(estimateVmagFromRcs(1)).toBeCloseTo(-1.3, 10);
  });

  it('gets fainter by 2.5 magnitudes per decade of decreasing RCS', () => {
    const oneTenth = estimateVmagFromRcs(0.1)!;
    const oneHundredth = estimateVmagFromRcs(0.01)!;

    expect(oneTenth).toBeCloseTo(1.2, 10);
    expect(oneHundredth - oneTenth).toBeCloseTo(2.5, 10);
  });

  it('clamps very large RCS values to the bright limit', () => {
    expect(estimateVmagFromRcs(1e9)).toBe(RCS_VMAG_ESTIMATE_MIN);
  });

  it('clamps very small RCS values to the faint limit', () => {
    expect(estimateVmagFromRcs(1e-12)).toBe(RCS_VMAG_ESTIMATE_MAX);
  });

  it('returns null for zero, negative, and non-finite inputs', () => {
    expect(estimateVmagFromRcs(0)).toBeNull();
    expect(estimateVmagFromRcs(-3)).toBeNull();
    expect(estimateVmagFromRcs(NaN)).toBeNull();
    expect(estimateVmagFromRcs(Infinity)).toBeNull();
  });

  it('returns null for non-number inputs at runtime', () => {
    expect(estimateVmagFromRcs(undefined as unknown as number)).toBeNull();
    expect(estimateVmagFromRcs('0.5' as unknown as number)).toBeNull();
  });
});
