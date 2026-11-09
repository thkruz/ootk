/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Reference data: ITU validation spreadsheet CG-3M3J-13-ValEx Rev 8.3.0 (2024-02-12), sheets P.676-13 SpAtt,
 * A_Gas_A1_2.2.1a/b and A_Gas_A2_INST, copied verbatim into itu-reference-values.json. The spreadsheet performs the
 * same arithmetic in double precision, so a faithful implementation agrees to about 1e-9 relative; the tests use 1e-8
 * (the Annex 1 layer sum accumulates 922 terms and the sheet rounds its layer heights in the last digits).
 */

import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../errors';
import { Degrees, Kilometers } from '../../../types/types';
import { Hertz } from '../../CommTypes';
import { gasInstantaneousAttenuation, gasSlantAttenuation, gasSpecificAttenuation } from '../P676GasAttenuation';
import { referenceAtmosphere } from '../P835ReferenceAtmosphere';
import ref from './itu-reference-values.json';

const GHZ = 1e9;
const hz = (g: number): Hertz => (g * GHZ) as Hertz;
const expectRel = (actual: number, expected: number, rel = 1e-8): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * rel);
};

describe('P.676-13 Annex 1 specific attenuation', () => {
  it('matches the sheet gamma_o and gamma_w (eq 1 to 9)', () => {
    expect(ref.P676.annex1_specific_attenuation.length).toBe(5);
    for (const c of ref.P676.annex1_specific_attenuation) {
      const g = gasSpecificAttenuation(hz(c.f_GHz), c.p_hPa_used_as_dry_pressure, c.e_hPa, c.T_K);

      expectRel(g.oxygen, c.gamma_o_dBkm);
      expectRel(g.waterVapour, c.gamma_w_dBkm);
      expectRel(g.total, c.gamma_o_dBkm + c.gamma_w_dBkm);
    }
  });

  it('has no water vapour contribution when e = 0 and a much larger oxygen value in the 60 GHz complex', () => {
    const dry = gasSpecificAttenuation(hz(20), 1013.25, 0, 288.15);

    expect(dry.waterVapour).toBe(0);
    expect(gasSpecificAttenuation(hz(60), 1013.25, 0, 288.15).oxygen).toBeGreaterThan(10 * dry.oxygen);
  });

  it('validates its inputs', () => {
    expect(() => gasSpecificAttenuation(hz(0.5), 1000, 10, 288)).toThrow(ValidationError);
    expect(() => gasSpecificAttenuation(hz(1001), 1000, 10, 288)).toThrow(ValidationError);
    expect(() => gasSpecificAttenuation(hz(20), 0, 10, 288)).toThrow(ValidationError);
    expect(() => gasSpecificAttenuation(hz(20), 1000, -1, 288)).toThrow(ValidationError);
    expect(() => gasSpecificAttenuation(hz(20), 1000, 10, 0)).toThrow(ValidationError);
    expect(() => gasSpecificAttenuation(hz(20), NaN, 10, 288)).toThrow(ValidationError);
  });
});

describe('P.835-6 reference atmosphere', () => {
  it('has the standard sea-level state and the 2 km vapour scale height', () => {
    const s = referenceAtmosphere(0 as Kilometers);

    expectRel(s.temperature, 288.15, 1e-14);
    expectRel(s.totalPressure, 1013.25, 1e-14);
    expectRel(s.waterVapourDensity, 7.5, 1e-12);
    expectRel(s.vapourPressure, (7.5 * 288.15) / 216.7, 1e-12);
    expectRel(s.dryPressure, s.totalPressure - s.vapourPressure, 1e-14);
    expectRel(referenceAtmosphere(2 as Kilometers).waterVapourDensity, 7.5 / Math.E, 1e-6);
  });

  it('has the standard-atmosphere tropopause (216.65 K at 15 km geopotential) and rejects bad altitudes', () => {
    // Geometric altitude giving h' = 15 km: h = 6356.766 h' / (6356.766 - h')
    const h = (6356.766 * 15) / (6356.766 - 15);

    expectRel(referenceAtmosphere(h as Kilometers).temperature, 216.65, 1e-12);
    expect(() => referenceAtmosphere(-1 as Kilometers)).toThrow(ValidationError);
    expect(() => referenceAtmosphere(101 as Kilometers)).toThrow(ValidationError);
    expect(() => referenceAtmosphere(NaN as Kilometers)).toThrow(ValidationError);
  });
});

describe('P.676-13 Annex 1 slant path', () => {
  it('matches the sheet 922-layer result at 28 GHz, 30 degrees, sea level', () => {
    const c = ref.P676.annex1_slant_path[0];

    expectRel(gasSlantAttenuation(hz(c.f_GHz), c.apparent_elevation_deg as Degrees), c.A_total_dB);
  });

  it('matches the sheet result for a station at 1.3 km (eq 16a to 16d layer grid, 1.3 to 100 km)', () => {
    const c = ref.P676.annex1_slant_path[1];

    expectRel(
      gasSlantAttenuation(hz(c.f_GHz), c.apparent_elevation_deg as Degrees, { stationAltitude: c.station_height_km as Kilometers }),
      c.A_total_dB,
    );
  });

  it('matches the 1.3 km to 8 km value of the same sheet worked example', () => {
    // Sheet A_Gas_A1_2.2.1b example 2, second row: 28 GHz, 30 degrees, h1 = 1.3 km, h2 = 8 km.
    expectRel(
      gasSlantAttenuation(hz(28), 30 as Degrees, { stationAltitude: 1.3 as Kilometers, topAltitude: 8 as Kilometers }),
      0.24376211236218553,
    );
  });

  it('is larger at lower elevation and close to the cosecant law at moderate elevation', () => {
    const a10 = gasSlantAttenuation(hz(20), 10 as Degrees);
    const a30 = gasSlantAttenuation(hz(20), 30 as Degrees);
    const a90 = gasSlantAttenuation(hz(20), 90 as Degrees);

    expect(a10).toBeGreaterThan(a30);
    expect(a30).toBeGreaterThan(a90);
    // Plane-parallel limit: A(30)/A(90) = 1/sin(30) = 2; refraction and curvature move it by well under 1 percent.
    expect(Math.abs(a30 / a90 - 2)).toBeLessThan(0.01);
  });

  it('works at zero elevation (horizon path) and is finite and larger than at 5 degrees', () => {
    const a0 = gasSlantAttenuation(hz(20), 0 as Degrees);

    expect(Number.isFinite(a0)).toBe(true);
    expect(a0).toBeGreaterThan(gasSlantAttenuation(hz(20), 5 as Degrees));
  });

  it('gives a higher station less attenuation', () => {
    expect(gasSlantAttenuation(hz(28), 30 as Degrees, { stationAltitude: 3 as Kilometers }))
      .toBeLessThan(gasSlantAttenuation(hz(28), 30 as Degrees));
  });

  it('runs in a few milliseconds at most per call once the layer table is built', () => {
    gasSlantAttenuation(hz(20), 30 as Degrees);
    const n = 100;
    const t0 = performance.now();

    for (let i = 0; i < n; i++) {
      gasSlantAttenuation(hz(10 + i * 0.1), (5 + i * 0.5) as Degrees);
    }
    const perCall = (performance.now() - t0) / n;

    // The design target is under 2 ms; the bound is loose so slow shared CI machines do not flake.
    expect(perCall).toBeLessThan(10);
  });

  it('validates its inputs', () => {
    expect(() => gasSlantAttenuation(hz(0.5), 30 as Degrees)).toThrow(ValidationError);
    expect(() => gasSlantAttenuation(hz(20), -1 as Degrees)).toThrow(ValidationError);
    expect(() => gasSlantAttenuation(hz(20), 91 as Degrees)).toThrow(ValidationError);
    expect(() => gasSlantAttenuation(hz(20), 30 as Degrees, { stationAltitude: -0.1 as Kilometers })).toThrow(ValidationError);
    expect(() => gasSlantAttenuation(hz(20), 30 as Degrees, { stationAltitude: 100 as Kilometers })).toThrow(ValidationError);
    expect(() => gasSlantAttenuation(hz(20), 30 as Degrees, { stationAltitude: 5 as Kilometers, topAltitude: 5 as Kilometers })).toThrow(ValidationError);
    expect(() => gasSlantAttenuation(hz(20), 30 as Degrees, { topAltitude: 101 as Kilometers })).toThrow(ValidationError);
  });
});

describe('P.676-13 Annex 2 instantaneous', () => {
  it('reproduces the 10 sheet rows (gamma, equivalent heights and total)', () => {
    expect(ref.P676.annex2_instantaneous.length).toBe(10);
    for (const c of ref.P676.annex2_instantaneous) {
      const a = gasInstantaneousAttenuation({
        frequency: hz(c.f_GHz), elevation: c.elevation_deg as Degrees, pressure: c.P_hPa, temperature: c.T_K, waterVapourDensity: c.rho_gm3,
      });

      expectRel(a, c.A_gas_dB);
    }
  });

  it('agrees with Annex 1 at 30 degrees in the standard atmosphere to within 10 percent (sanity, not a reference)', () => {
    const s = referenceAtmosphere(0 as Kilometers);
    const a2 = gasInstantaneousAttenuation({
      frequency: hz(28), elevation: 30 as Degrees, pressure: s.totalPressure, temperature: s.temperature, waterVapourDensity: s.waterVapourDensity,
    });
    const a1 = gasSlantAttenuation(hz(28), 30 as Degrees);

    expect(Math.abs(a2 - a1) / a1).toBeLessThan(0.1);
  });

  it('validates its inputs', () => {
    const ok = { frequency: hz(20), elevation: 30 as Degrees, pressure: 1013, temperature: 288, waterVapourDensity: 7.5 };

    expect(() => gasInstantaneousAttenuation({ ...ok, frequency: hz(351) })).toThrow(ValidationError);
    expect(() => gasInstantaneousAttenuation({ ...ok, frequency: hz(0.5) })).toThrow(ValidationError);
    expect(() => gasInstantaneousAttenuation({ ...ok, elevation: 4 as Degrees })).toThrow(ValidationError);
    expect(() => gasInstantaneousAttenuation({ ...ok, elevation: 91 as Degrees })).toThrow(ValidationError);
    expect(() => gasInstantaneousAttenuation({ ...ok, pressure: 0 })).toThrow(ValidationError);
    expect(() => gasInstantaneousAttenuation({ ...ok, temperature: -1 })).toThrow(ValidationError);
    expect(() => gasInstantaneousAttenuation({ ...ok, waterVapourDensity: -1 })).toThrow(ValidationError);
    expect(() => gasInstantaneousAttenuation({ ...ok, waterVapourDensity: 1000 })).toThrow(ValidationError);
  });
});
