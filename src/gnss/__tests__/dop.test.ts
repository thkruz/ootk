/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { ValidationError } from '../../errors';
import { SINGULAR_DOP, calculateDop } from '../dop';

describe('calculateDop', () => {
  // Zenith satellite plus three satellites on the horizon at 120 degree azimuth spacing.
  // With rows [sin az cos el, cos az cos el, sin el, 1] (Kaplan and Hegarty 2006, Eqs. 7.42 to 7.53), H^T H is
  // diag(1.5, 1.5, 1) plus the clock terms; D = (H^T H)^-1 follows by hand:
  //   E and N: the three horizon rows give sum sin^2 = sum cos^2 = 1.5, so D_EE = D_NN = 1/1.5 = 2/3 and
  //   HDOP^2 = 4/3 -> 1.1547.
  //   Up and clock: the zenith row [0, 0, 1, 1] and horizon rows [., ., 0, 1] give the 2 x 2 block
  //   [[1, 1], [1, 4]] whose inverse is [[4/3, -1/3], [-1/3, 1/3]], so VDOP^2 = 4/3 -> 1.1547 and
  //   TDOP^2 = 1/3 -> 0.5774.
  // Hence PDOP = sqrt(8/3) = 1.6330 and GDOP = sqrt(3) = 1.7321. Exact, so 1e-9 is a rounding bound.
  it('matches the hand-derived zenith + 3 horizon case', () => {
    const dop = calculateDop([
      { az: 0, el: 90 },
      { az: 0, el: 0 },
      { az: 120, el: 0 },
      { az: 240, el: 0 },
    ]);

    expect(dop.gdop).toBeCloseTo(Math.sqrt(3), 9);
    expect(dop.pdop).toBeCloseTo(1.633, 3);
    expect(dop.pdop).toBeCloseTo(Math.sqrt(8 / 3), 9);
    expect(dop.hdop).toBeCloseTo(1.1547, 4);
    expect(dop.vdop).toBeCloseTo(1.1547, 4);
    expect(dop.tdop).toBeCloseTo(0.5774, 4);
  });

  // Regular tetrahedron: four unit vectors with mutual angle 109.47 degrees (one at zenith, three at
  // elevation -asin(1/3)). Hand derivation: sum of east^2 = north^2 = up^2 = 4/3, cross terms and the
  // direction sums vanish (the unit vectors sum to zero), clock entry 4, so D = diag(3/4, 3/4, 3/4, 1/4)
  // and GDOP = sqrt(3 * 0.75 + 0.25) = sqrt(5/2) = 1.5811. Exact, 1e-9.
  it('gives GDOP sqrt(5/2) for a regular tetrahedron (the global minimum)', () => {
    const elLow = -Math.asin(1 / 3) * (180 / Math.PI); // -19.4712 degrees
    const dop = calculateDop([
      { az: 0, el: 90 },
      { az: 0, el: elLow },
      { az: 120, el: elLow },
      { az: 240, el: elLow },
    ]);

    expect(dop.gdop).toBeCloseTo(Math.sqrt(5 / 2), 9);
    expect(dop.pdop).toBeCloseTo(1.5, 9);
    expect(dop.tdop).toBeCloseTo(0.5, 9);
  });

  it('is invariant to a common azimuth rotation', () => {
    const base = [
      { az: 10, el: 25 },
      { az: 100, el: 40 },
      { az: 200, el: 15 },
      { az: 300, el: 60 },
      { az: 45, el: 80 },
    ];
    const a = calculateDop(base);
    const b = calculateDop(base.map((s) => ({ az: s.az + 77, el: s.el })));

    for (const k of ['gdop', 'pdop', 'hdop', 'vdop', 'tdop'] as const) {
      expect(b[k]).toBeCloseTo(a[k], 9);
    }
  });

  // Definitions (Kaplan and Hegarty Eq. 7.50 to 7.53): GDOP^2 = PDOP^2 + TDOP^2 and PDOP^2 = HDOP^2 + VDOP^2.
  it('satisfies the DOP composition identities', () => {
    const d = calculateDop([
      { az: 10, el: 25 },
      { az: 100, el: 40 },
      { az: 200, el: 15 },
      { az: 300, el: 60 },
    ]);

    expect(d.gdop ** 2).toBeCloseTo(d.pdop ** 2 + d.tdop ** 2, 9);
    expect(d.pdop ** 2).toBeCloseTo(d.hdop ** 2 + d.vdop ** 2, 9);
  });

  it('converts TDOP to seconds when asked (divide by c = 299792458 m/s)', () => {
    const sats = [
      { az: 0, el: 90 },
      { az: 0, el: 0 },
      { az: 120, el: 0 },
      { az: 240, el: 0 },
    ];
    const m = calculateDop(sats).tdop;
    const s = calculateDop(sats, { tdopInSeconds: true }).tdop;

    expect(s).toBeCloseTo(m / 299792458, 18);
  });

  it('returns all Infinity for fewer than 4 satellites', () => {
    expect(calculateDop([])).toEqual(SINGULAR_DOP);
    expect(
      calculateDop([
        { az: 0, el: 30 },
        { az: 90, el: 30 },
        { az: 180, el: 30 },
      ]),
    ).toEqual({ gdop: Infinity, pdop: Infinity, hdop: Infinity, vdop: Infinity, tdop: Infinity });
  });

  // Satellites in one vertical plane (azimuth 0 or 180) have a zero east component, so the east row and
  // column of H^T H are zero and the matrix is singular.
  it('returns Infinity for singular geometry (all satellites in one vertical plane)', () => {
    const d = calculateDop([
      { az: 0, el: 20 },
      { az: 0, el: 50 },
      { az: 180, el: 30 },
      { az: 180, el: 70 },
    ]);

    expect(d.pdop).toBe(Infinity);
    expect(d.gdop).toBe(Infinity);
  });

  it('returns Infinity when satellites are co-located', () => {
    const s = { az: 33, el: 44 };

    expect(calculateDop([s, s, s, s]).gdop).toBe(Infinity);
  });

  it('rejects non-finite angles', () => {
    expect(() => calculateDop([{ az: NaN, el: 10 }])).toThrow(ValidationError);
  });

  it('improves when a well-placed satellite is added', () => {
    const four = [
      { az: 0, el: 90 },
      { az: 0, el: 10 },
      { az: 120, el: 10 },
      { az: 240, el: 10 },
    ];
    const five = [...four, { az: 60, el: 45 }];

    expect(calculateDop(five).gdop).toBeLessThan(calculateDop(four).gdop);
  });
});
