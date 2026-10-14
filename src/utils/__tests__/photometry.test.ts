import { RCS_VMAG_ESTIMATE_MAX, RCS_VMAG_ESTIMATE_MIN, estimateVmagFromRcs } from '../photometry';

describe('estimateVmagFromRcs', () => {
  /*
   * Standard magnitude (1000 km, 90 deg phase) of a Lambertian sphere with cross-section
   * A = pi r^2 = 1 m^2 and albedo 0.2 (McCants / Molczan diffuse-sphere relation):
   *   m = -26.74 - 2.5 log10( rho r^2 F(90) / R^2 ),  F(90) = 2 / (3 pi) = 0.212207
   *   rho r^2 F = 0.2 * 0.318310 * 0.212207 = 0.0135095;  / (1e6 m)^2 = 1.35095e-14
   *   log10 = -13.86935;  -2.5 * that = 34.67340;  m = -26.74 + 34.67340 = +7.9334
   */
  it('gives +7.933 for a 1 square metre RCS (diffuse sphere, albedo 0.2, 1000 km, 90 deg)', () => {
    expect(estimateVmagFromRcs(1)).toBeCloseTo(7.9334, 4);
  });

  it('gets fainter by 2.5 magnitudes per decade of decreasing RCS', () => {
    const oneTenth = estimateVmagFromRcs(0.1)!;
    const oneHundredth = estimateVmagFromRcs(0.01)!;

    expect(oneTenth).toBeCloseTo(7.9334 + 2.5, 4);
    expect(oneHundredth - oneTenth).toBeCloseTo(2.5, 10);
  });

  it('gets brighter by exactly 1 magnitude when the albedo is multiplied by 10^0.4 (about 2.512)', () => {
    // Pogson: a flux ratio of 10^0.4 is one magnitude
    expect(estimateVmagFromRcs(1, 0.2)! - estimateVmagFromRcs(1, 0.2 * 10 ** 0.4)!).toBeCloseTo(1, 12);
  });

  it('stays within the albedo 0.08 to 0.5 band of about +6.9 to +8.9 for 1 m^2', () => {
    // m(rho) = 7.9334 - 2.5 log10(rho / 0.2): 0.5 -> 6.938, 0.08 -> 8.928
    expect(estimateVmagFromRcs(1, 0.5)).toBeCloseTo(6.9385, 3);
    expect(estimateVmagFromRcs(1, 0.08)).toBeCloseTo(8.9283, 3);
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
