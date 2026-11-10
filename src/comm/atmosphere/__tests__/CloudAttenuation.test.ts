/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Reference data: ITU validation spreadsheet CG-3M3J-13-ValEx Rev 8.3.0 (2024-02-12), sheet P.840-9 A_Clouds,
 * 24 rows, copied verbatim into itu-reference-values.json. The sheet evaluates P.840-9 eq 2 to 12 in double precision,
 * so a faithful implementation agrees to about 1e-9 relative; the tests use 1e-8.
 */

import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../errors';
import { Degrees } from '../../../types/types';
import { Hertz } from '../../CommTypes';
import {
  cloudAttenuation, cloudMassAbsorptionCoefficient, cloudSpecificAttenuationCoefficient, waterPermittivity,
} from '../P840CloudAttenuation';
import ref from './itu-reference-values.json';

const hz = (g: number): Hertz => (g * 1e9) as Hertz;
const expectRel = (actual: number, expected: number, rel = 1e-8): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * rel);
};

describe('P.840-9 cloud attenuation', () => {
  it('matches the sheet permittivity, K_L and A_c on all 24 rows', () => {
    expect(ref.P840.sheet_cases.length).toBe(24);
    for (const c of ref.P840.sheet_cases) {
      const eps = waterPermittivity(hz(c.f_GHz), 273.75);

      expectRel(eps.real, c.eps_prime);
      expectRel(eps.imaginary, c.eps_dprime);
      expectRel((2 + eps.real) / eps.imaginary, c.eta);
      expectRel(cloudMassAbsorptionCoefficient(hz(c.f_GHz)), c.KL_dB_per_kgm2);
      const a = cloudAttenuation({ frequency: hz(c.f_GHz), elevation: c.elevation_deg as Degrees, cloudLiquidWater: c.L_kgm2 });

      if (c.Ac_dB === 0) {
        expect(a).toBe(0);
      } else {
        expectRel(a, c.Ac_dB);
      }
    }
  });

  it('K_l is positive, grows with frequency below the water relaxation and falls as water warms at 20 GHz', () => {
    expect(cloudSpecificAttenuationCoefficient(hz(10), 273.15)).toBeGreaterThan(0);
    expect(cloudSpecificAttenuationCoefficient(hz(30), 273.15)).toBeGreaterThan(cloudSpecificAttenuationCoefficient(hz(10), 273.15));
    // Published behaviour of K_l (P.840-9 Figure 1): colder water absorbs more at microwave frequencies.
    expect(cloudSpecificAttenuationCoefficient(hz(20), 263.15)).toBeGreaterThan(cloudSpecificAttenuationCoefficient(hz(20), 293.15));
  });

  it('follows the cosecant law and is linear in L (eq 11)', () => {
    const base = { frequency: hz(20), cloudLiquidWater: 0.5 };
    const a30 = cloudAttenuation({ ...base, elevation: 30 as Degrees });
    const a90 = cloudAttenuation({ ...base, elevation: 90 as Degrees });

    expectRel(a30 / a90, 2, 1e-12);
    expectRel(cloudAttenuation({ ...base, cloudLiquidWater: 1, elevation: 30 as Degrees }), 2 * a30, 1e-12);
    expect(cloudAttenuation({ ...base, cloudLiquidWater: 0, elevation: 30 as Degrees })).toBe(0);
  });

  it('validates its inputs', () => {
    const ok = { frequency: hz(20), elevation: 30 as Degrees, cloudLiquidWater: 0.5 };

    expect(() => cloudAttenuation({ ...ok, frequency: hz(0.5) })).toThrow(ValidationError);
    expect(() => cloudAttenuation({ ...ok, frequency: hz(201) })).toThrow(ValidationError);
    expect(() => cloudAttenuation({ ...ok, elevation: 4.9 as Degrees })).toThrow(ValidationError);
    expect(() => cloudAttenuation({ ...ok, elevation: 91 as Degrees })).toThrow(ValidationError);
    expect(() => cloudAttenuation({ ...ok, cloudLiquidWater: -0.1 })).toThrow(ValidationError);
    expect(() => cloudAttenuation({ ...ok, cloudLiquidWater: NaN })).toThrow(ValidationError);
    expect(() => waterPermittivity(hz(20), 0)).toThrow(ValidationError);
  });
});
