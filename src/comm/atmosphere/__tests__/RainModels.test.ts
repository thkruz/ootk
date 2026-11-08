/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Reference data: ITU validation spreadsheet CG-3M3J-13-ValEx Rev 8.3.0 (2024-02-12), copied verbatim into
 * itu-reference-values.json together with the Rec ITU-R P.838-3 Table 5 values. Sheet numbers are full double precision
 * from a spreadsheet implementation of the same equations, so a faithful implementation agrees to ~1e-9 relative; the
 * tests use 1e-8 relative (the spreadsheet itself rounds some inputs in the last digits). Table 5 values are printed with
 * 4 significant figures so they are compared to 5e-4 relative (half a unit in the 4th digit, worst case 1e-4/0.9691...
 * with a 5x margin for the lowest-magnitude mantissas).
 */

import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../errors';
import { Degrees, Kilometers } from '../../../types/types';
import { Decibels, Hertz } from '../../CommTypes';
import { rainAttenuation, totalAttenuation } from '../P618RainAttenuation';
import { rainCoefficients, rainSpecificAttenuation } from '../P838RainCoefficients';
import { rainHeightFromIsotherm, rainHeightFromLatitude } from '../P839RainHeight';
import ref from './itu-reference-values.json';

const GHZ = 1e9 as Hertz;
const REL = 1e-8;

const expectRel = (actual: number, expected: number, rel = REL): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * rel);
};

describe('P.838-3 rain coefficients', () => {
  it('matches every sheet row (kH, kV, alphaH, alphaV, k, alpha, gammaR)', () => {
    expect(ref.P838.sheet_cases.length).toBe(16);
    for (const c of ref.P838.sheet_cases) {
      const r = rainCoefficients((c.f_GHz * GHZ) as Hertz, c.elevation_deg as Degrees, c.tilt_deg as Degrees);

      expectRel(r.kH, c.kH);
      expectRel(r.kV, c.kV);
      expectRel(r.alphaH, c.alphaH);
      expectRel(r.alphaV, c.alphaV);
      expectRel(r.k, c.k);
      expectRel(r.alpha, c.alpha);
      expectRel(rainSpecificAttenuation((c.f_GHz * GHZ) as Hertz, c.elevation_deg as Degrees, c.tilt_deg as Degrees, c.R_mmh), c.gammaR_dBkm);
    }
  });

  it('matches the printed Table 5 of P.838-3 to its 4 significant figures', () => {
    expect(ref.P838.official_table5.length).toBe(25);
    for (const c of ref.P838.official_table5) {
      // Table 5 is the horizontal / vertical case: theta = 0 with tau = 0 gives H, tau = 90 gives V.
      const h = rainCoefficients((c.f_GHz * GHZ) as Hertz, 0 as Degrees, 0 as Degrees);
      const v = rainCoefficients((c.f_GHz * GHZ) as Hertz, 0 as Degrees, 90 as Degrees);

      expectRel(h.kH, c.kH, 5e-4);
      expectRel(v.kV, c.kV, 5e-4);
      expectRel(h.alphaH, c.alphaH, 5e-4);
      expectRel(v.alphaV, c.alphaV, 5e-4);
    }
  });

  it('collapses to kH, alphaH for tau = 0 at zero elevation and kV, alphaV for tau = 90 (eq 4 and 5 limits)', () => {
    const h = rainCoefficients(20 * GHZ as Hertz, 0 as Degrees, 0 as Degrees);
    const v = rainCoefficients(20 * GHZ as Hertz, 0 as Degrees, 90 as Degrees);

    expectRel(h.k, h.kH, 1e-14);
    expectRel(h.alpha, h.alphaH, 1e-14);
    expectRel(v.k, v.kV, 1e-14);
    expectRel(v.alpha, v.alphaV, 1e-14);
  });

  it('gives the mean of H and V for circular polarisation at zenith (cos^2 theta = 0)', () => {
    const r = rainCoefficients(12 * GHZ as Hertz, 90 as Degrees, 45 as Degrees);

    expectRel(r.k, (r.kH + r.kV) / 2, 1e-12);
  });

  it('rejects out-of-range or non-finite inputs', () => {
    expect(() => rainCoefficients(0.5 * GHZ as Hertz, 30 as Degrees, 45 as Degrees)).toThrow(ValidationError);
    expect(() => rainCoefficients(1001 * GHZ as Hertz, 30 as Degrees, 45 as Degrees)).toThrow(ValidationError);
    expect(() => rainCoefficients(10 * GHZ as Hertz, 91 as Degrees, 45 as Degrees)).toThrow(ValidationError);
    expect(() => rainCoefficients(10 * GHZ as Hertz, NaN as Degrees, 45 as Degrees)).toThrow(ValidationError);
    expect(() => rainCoefficients(10 * GHZ as Hertz, 30 as Degrees, NaN as Degrees)).toThrow(ValidationError);
  });
});

describe('P.839 rain height', () => {
  it('adds 0.36 km to the 0 degC isotherm height, matching all sheet sites (P.839-4 eq 1)', () => {
    expect(ref.P839.cases.length).toBe(8);
    for (const c of ref.P839.cases) {
      expectRel(rainHeightFromIsotherm(c.h0_km as Kilometers), c.hR_km, 1e-12);
    }
  });

  it('latitude formula follows the P.839-2 piecewise form with its published breakpoints', () => {
    // P.839-2 (recommends 1: hR approximated by h0, no +0.36 km): 5.0 km for -21 <= lat <= 23,
    // 5 - 0.075 (lat - 23) for lat > 23, 5 + 0.1 (lat + 21) for -71 <= lat < -21, 0 km below -71.
    // Values below are computed by hand from those lines.
    expect(rainHeightFromLatitude(0 as Degrees)).toBeCloseTo(5, 12);
    expect(rainHeightFromLatitude(23 as Degrees)).toBeCloseTo(5, 12);
    expect(rainHeightFromLatitude(43 as Degrees)).toBeCloseTo(5 - 0.075 * 20, 12);
    expect(rainHeightFromLatitude(-10 as Degrees)).toBeCloseTo(5, 12);
    expect(rainHeightFromLatitude(-41 as Degrees)).toBeCloseTo(3, 12);
    expect(rainHeightFromLatitude(-80 as Degrees)).toBe(0);
    expect(rainHeightFromLatitude(90 as Degrees)).toBeGreaterThanOrEqual(0);
  });

  it('is within the documented rough accuracy of the sheet hR at the sheet sites', () => {
    // Measured spread of the P.839-2 formula against P.839-4 hR at these 8 sites is -0.69 to +1.62 km.
    for (const c of ref.P839.cases) {
      expect(Math.abs(rainHeightFromLatitude(c.lat as Degrees) - c.hR_km)).toBeLessThan(1.7);
    }
  });

  it('rejects invalid inputs', () => {
    expect(() => rainHeightFromIsotherm(-1 as Kilometers)).toThrow(ValidationError);
    expect(() => rainHeightFromLatitude(91 as Degrees)).toThrow(ValidationError);
  });
});

describe('P.618-14 rain attenuation', () => {
  it('reproduces every intermediate step and A_p of the 64 sheet rows', () => {
    expect(ref.P618.sheet_cases.length).toBe(64);
    for (const c of ref.P618.sheet_cases) {
      const r = rainAttenuation({
        frequency: (c.f_GHz * GHZ) as Hertz,
        elevation: c.elevation_deg as Degrees,
        polarizationTilt: c.tilt_deg as Degrees,
        rainRate: c.R001_mmh,
        latitude: c.lat as Degrees,
        stationAltitude: c.hs_km as Kilometers,
        rainHeight: c.hR_km as Kilometers,
        exceedancePercent: c.p_percent,
      });

      expectRel(r.slantLength, c.Ls_km);
      expectRel(r.horizontalLength, c.LG_km);
      expectRel(r.specificAttenuation, c.gammaR_dBkm);
      expectRel(r.horizontalReduction, c.r001);
      expectRel(r.verticalAdjustment, c.v001);
      expectRel(r.effectiveLength, c.LE_km);
      expectRel(r.attenuation001, c.A001_dB);
      expect(r.beta).toBeCloseTo(c.beta, 12);
      expectRel(r.attenuation, c.Ap_dB);
    }
  });

  it('returns zero for zero rain, or when the rain height is not above the station', () => {
    const base = {
      frequency: 20 * GHZ as Hertz, elevation: 30 as Degrees, polarizationTilt: 45 as Degrees, latitude: 40 as Degrees,
      rainHeight: 3 as Kilometers,
    };

    expect(rainAttenuation({ ...base, rainRate: 0 }).attenuation).toBe(0);
    expect(rainAttenuation({ ...base, rainRate: 30, stationAltitude: 3 as Kilometers }).attenuation).toBe(0);
    expect(rainAttenuation({ ...base, rainRate: 30, stationAltitude: 4 as Kilometers }).attenuation).toBe(0);
  });

  it('uses the geometric slant length at 90 degrees: Ls = hR - hs (eq 1 with sin = 1)', () => {
    const r = rainAttenuation({
      frequency: 20 * GHZ as Hertz, elevation: 90 as Degrees, polarizationTilt: 0 as Degrees, latitude: 50 as Degrees,
      rainRate: 20, rainHeight: 3 as Kilometers, stationAltitude: 1 as Kilometers,
    });

    expectRel(r.slantLength, 2, 1e-12);
    expect(r.horizontalLength).toBeLessThan(1e-12);
  });

  it('uses eq 2 (Re = 8500 km) below 5 degrees and eq 1 from 5 degrees up', () => {
    // Hand evaluation of P.618-14 eq 1 and eq 2 for a 3 km deep rain layer. Eq 2 is the curved-Earth form and is
    // about 2 percent shorter than the flat-Earth eq 1 length at 5 degrees, so the branch switch is a small step.
    const mk = (el: number): number => rainAttenuation({
      frequency: 20 * GHZ as Hertz, elevation: el as Degrees, polarizationTilt: 45 as Degrees, latitude: 50 as Degrees,
      rainRate: 20, rainHeight: 3 as Kilometers,
    }).slantLength;
    const eq1At5 = 3 / Math.sin(5 * Math.PI / 180);

    expect(Math.abs(mk(5) - eq1At5) / eq1At5).toBe(0);
    const sin = Math.sin(3 * Math.PI / 180);
    const eq2At3 = (2 * 3) / (Math.sqrt(sin * sin + (2 * 3) / 8500) + sin);

    expectRel(mk(3), eq2At3, 1e-12);
    expect(mk(4.9999)).toBeLessThan(eq1At5);
  });

  it('Ka band fades more than Ku band for the same rain, and low elevation fades more than high', () => {
    const at = (fGHz: number, el: number): number => rainAttenuation({
      frequency: fGHz * GHZ as Hertz, elevation: el as Degrees, polarizationTilt: 45 as Degrees, latitude: 45 as Degrees,
      rainRate: 40, rainHeight: 3.5 as Kilometers,
    }).attenuation;

    expect(at(30, 40)).toBeGreaterThan(at(12, 40));
    expect(at(12, 10)).toBeGreaterThan(at(12, 40));
    expect(at(12, 40)).toBeGreaterThan(at(12, 80));
  });

  it('A_p decreases as the exceedance percentage rises', () => {
    const at = (p: number): number => rainAttenuation({
      frequency: 20 * GHZ as Hertz, elevation: 35 as Degrees, polarizationTilt: 45 as Degrees, latitude: 45 as Degrees,
      rainRate: 40, rainHeight: 3.5 as Kilometers, exceedancePercent: p,
    }).attenuation;

    expect(at(0.001)).toBeGreaterThan(at(0.01));
    expect(at(0.01)).toBeGreaterThan(at(0.1));
    expect(at(0.1)).toBeGreaterThan(at(1));
  });

  it('falls back to the latitude rain height when none is supplied', () => {
    const p = { frequency: 20 * GHZ as Hertz, elevation: 35 as Degrees, polarizationTilt: 45 as Degrees, latitude: 45 as Degrees, rainRate: 25 };

    expect(rainAttenuation(p).rainHeight).toBeCloseTo(rainHeightFromLatitude(45 as Degrees), 12);
  });

  it('validates its inputs', () => {
    const ok = {
      frequency: 20 * GHZ as Hertz, elevation: 35 as Degrees, polarizationTilt: 45 as Degrees, latitude: 45 as Degrees, rainRate: 25,
    };

    expect(() => rainAttenuation({ ...ok, frequency: 0.5 * GHZ as Hertz })).toThrow(ValidationError);
    expect(() => rainAttenuation({ ...ok, frequency: 56 * GHZ as Hertz })).toThrow(ValidationError);
    expect(() => rainAttenuation({ ...ok, elevation: -1 as Degrees })).toThrow(ValidationError);
    expect(() => rainAttenuation({ ...ok, elevation: 91 as Degrees })).toThrow(ValidationError);
    expect(() => rainAttenuation({ ...ok, rainRate: -1 })).toThrow(ValidationError);
    expect(() => rainAttenuation({ ...ok, rainRate: NaN })).toThrow(ValidationError);
    expect(() => rainAttenuation({ ...ok, latitude: 95 as Degrees })).toThrow(ValidationError);
    expect(() => rainAttenuation({ ...ok, exceedancePercent: 0.0001 })).toThrow(ValidationError);
    expect(() => rainAttenuation({ ...ok, exceedancePercent: 6 })).toThrow(ValidationError);
    expect(() => rainAttenuation({ ...ok, rainHeight: -1 as Kilometers })).toThrow(ValidationError);
    expect(() => rainAttenuation({ ...ok, polarizationTilt: NaN as Degrees })).toThrow(ValidationError);
    expect(() => rainAttenuation({ ...ok, stationAltitude: NaN as Kilometers })).toThrow(ValidationError);
  });
});

describe('P.618-14 section 2.5 total attenuation', () => {
  it('reproduces the sheet Att_Tot rows (eq 65)', () => {
    expect(ref.P618.total_attenuation.length).toBe(4);
    for (const c of ref.P618.total_attenuation) {
      const t = totalAttenuation({
        rain: c.A_R_dB as Decibels, cloud: c.A_C_dB as Decibels, gas: c.A_G_dB as Decibels,
        scintillation: c.A_S_dB as Decibels, exceedancePercent: c.p_percent,
      });

      expectRel(t, c.A_T_dB, 1e-12);
    }
  });

  it('equals the plain sum when scintillation is zero (analytic limit of eq 65)', () => {
    expectRel(totalAttenuation({ rain: 2 as Decibels, cloud: 0.5 as Decibels, gas: 0.3 as Decibels, exceedancePercent: 0.01 }), 2.8, 1e-14);
  });

  it('drops the rain term above 5 percent (eq 66)', () => {
    const t = totalAttenuation({ rain: 9 as Decibels, cloud: 3 as Decibels, gas: 1 as Decibels, scintillation: 4 as Decibels, exceedancePercent: 10 });

    expectRel(t, 1 + 5, 1e-14);
  });

  it('validates its inputs', () => {
    const ok = { rain: 1 as Decibels, cloud: 1 as Decibels, gas: 1 as Decibels, exceedancePercent: 1 };

    expect(() => totalAttenuation({ ...ok, rain: -1 as Decibels })).toThrow(ValidationError);
    expect(() => totalAttenuation({ ...ok, gas: NaN as Decibels })).toThrow(ValidationError);
    expect(() => totalAttenuation({ ...ok, exceedancePercent: 0.0001 })).toThrow(ValidationError);
    expect(() => totalAttenuation({ ...ok, exceedancePercent: 51 })).toThrow(ValidationError);
  });
});
