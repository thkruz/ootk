import {
  APPARENT_VMAG_INVISIBLE,
  RCS_VMAG_ESTIMATE_MAX,
  RCS_VMAG_ESTIMATE_MIN,
  apparentVmagFromStdMag,
  estimateVmagFromRcs,
  lambertPhaseRelativeTo90,
  solarPhaseAngle,
} from '../photometry';

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

describe('lambertPhaseRelativeTo90', () => {
  it('is 1 at 90 deg, pi at full phase and 0 at 180 deg', () => {
    expect(lambertPhaseRelativeTo90(Math.PI / 2)).toBeCloseTo(1, 12);
    expect(lambertPhaseRelativeTo90(0)).toBeCloseTo(Math.PI, 12);
    expect(lambertPhaseRelativeTo90(Math.PI)).toBeCloseTo(0, 12);
  });
});

describe('solarPhaseAngle', () => {
  it('is 0 when the observer looks from the Sun side and 90 deg in quadrature', () => {
    const target = { x: 7000, y: 0, z: 0 };

    expect(solarPhaseAngle(target, { x: 1.5e8, y: 0, z: 0 }, { x: 9000, y: 0, z: 0 })).toBeCloseTo(0, 12);
    expect(solarPhaseAngle(target, { x: 7000, y: 1.5e8, z: 0 }, { x: 6378, y: 0, z: 0 })).toBeCloseTo(Math.PI / 2, 12);
  });

  it('is 180 deg when the target sits between the observer and the Sun', () => {
    expect(solarPhaseAngle({ x: 7000, y: 0, z: 0 }, { x: 1.5e8, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBeCloseTo(Math.PI, 12);
  });

  it('returns NaN for a degenerate (zero-length) direction', () => {
    expect(solarPhaseAngle({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0 })).toBeNaN();
  });
});

describe('apparentVmagFromStdMag', () => {
  /*
   * Hand-computed from m = m_std + 5 log10(R / 1000) - 2.5 log10(sin(phi) + (pi - phi) cos(phi)) - 2.5 log10(L):
   *   1000 km, 90 deg, L = 1 -> m_std exactly
   *   2000 km -> + 5 log10(2) = +1.50515
   *   0 deg phase -> - 2.5 log10(pi) = -1.24287
   *   L = 0.5 -> + 2.5 log10(2) = +0.75257
   */
  it('equals the standard magnitude at 1000 km, 90 deg phase and full sun', () => {
    expect(apparentVmagFromStdMag(4, 1000, Math.PI / 2)).toBeCloseTo(4, 12);
  });

  it('adds 5 log10(range / 1000 km) for range', () => {
    expect(apparentVmagFromStdMag(4, 2000, Math.PI / 2)).toBeCloseTo(5.50515, 5);
    expect(apparentVmagFromStdMag(4, 500, Math.PI / 2)).toBeCloseTo(2.49485, 5);
  });

  it('brightens by 2.5 log10(pi) = 1.243 mag at full phase', () => {
    expect(apparentVmagFromStdMag(4, 1000, 0)).toBeCloseTo(2.75713, 5);
  });

  it('dims by 2.5 log10(1 / L) in the penumbra', () => {
    expect(apparentVmagFromStdMag(4, 1000, Math.PI / 2, 0.5)).toBeCloseTo(4.75257, 5);
  });

  it('matches the ISS order of magnitude: std -1.3 at 420 km, 60 deg phase is about -3.9', () => {
    // -1.3 + 5 log10(0.42) - 2.5 log10(sin 60 + (2 pi / 3) cos 60) = -1.3 - 1.8838 - 0.7044 = -3.888
    expect(apparentVmagFromStdMag(-1.3, 420, Math.PI / 3)).toBeCloseTo(-3.888, 3);
  });

  it('returns null in umbra, at 180 deg phase, and for invalid inputs', () => {
    expect(apparentVmagFromStdMag(4, 1000, Math.PI / 2, 0)).toBeNull();
    expect(apparentVmagFromStdMag(4, 1000, Math.PI)).toBeNull();
    expect(apparentVmagFromStdMag(4, 0, Math.PI / 2)).toBeNull();
    expect(apparentVmagFromStdMag(NaN, 1000, Math.PI / 2)).toBeNull();
    expect(apparentVmagFromStdMag(4, 1000, NaN)).toBeNull();
  });

  it('reports objects fainter than the invisibility floor as null', () => {
    expect(apparentVmagFromStdMag(APPARENT_VMAG_INVISIBLE, 2000, Math.PI / 2)).toBeNull();
  });
});
