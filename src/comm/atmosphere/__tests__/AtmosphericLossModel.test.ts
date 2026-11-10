/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * The reference numbers come from the ITU validation spreadsheet CG-3M3J-13-ValEx Rev 8.3.0 (see
 * itu-reference-values.json); the model must reproduce them end to end because its inputs map one to one onto the
 * sheet inputs. Tolerance 1e-8 relative, as in the module tests.
 */

import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../../errors';
import {
  Antenna, Decibels, Degrees, GroundStation, Hertz, Kilometers, LinkGeometry, Receiver, Transmitter, Watts,
} from '../../../main';
import { llaRad2ecef } from '../../../transforms/transforms';
import { atmosphericLossModel } from '../AtmosphericLossModel';
import { gasSlantAttenuation } from '../P676GasAttenuation';
import ref from './itu-reference-values.json';

const DATE = new Date('2024-03-01T12:00:00Z');
const DEG = Math.PI / 180;
const hz = (g: number): Hertz => (g * 1e9) as Hertz;
const expectRel = (actual: number, expected: number, rel = 1e-8): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.abs(expected) * rel);
};

const end = (lat: number, el: number, alt = 0) => ({
  lookAz: 180 as Degrees, lookEl: el as Degrees, latitude: lat as Degrees, altitude: alt as Kilometers,
});
const downlink = (lat: number, el: number, alt = 0): LinkGeometry => ({ distance: 38000 as Kilometers, rx: end(lat, el, alt) });
const byName = (terms: { name: string; db: number }[], name: string): number | undefined => terms.find((t) => t.name === name)?.db;

describe('atmosphericLossModel against the ITU sheet', () => {
  it('reproduces the sheet rain attenuation through the model (P.618-14 row, p = 1 percent)', () => {
    const c = ref.P618.sheet_cases[0];
    const model = atmosphericLossModel({
      rainRate: c.R001_mmh, rainHeight: c.hR_km as Kilometers, exceedancePercent: c.p_percent, polarizationTilt: c.tilt_deg as Degrees, gas: false,
    });
    const terms = model(downlink(c.lat, c.elevation_deg, c.hs_km), hz(c.f_GHz));

    expect(terms.map((t) => t.name)).toEqual(['rain']);
    expectRel(terms[0].db, c.Ap_dB);
  });

  it('reproduces the sheet Annex 1 gas attenuation (28 GHz, 30 degrees, sea level)', () => {
    const c = ref.P676.annex1_slant_path[0];
    const terms = atmosphericLossModel()(downlink(45, c.apparent_elevation_deg), hz(c.f_GHz));

    expect(terms.map((t) => t.name)).toEqual(['gas']);
    expectRel(terms[0].db, c.A_total_dB);
  });

  it('reproduces the sheet Annex 2 gas attenuation through surface weather', () => {
    const c = ref.P676.annex2_instantaneous[0];
    const model = atmosphericLossModel({
      gasMethod: 'annex2', surfaceMeteorology: { pressure: c.P_hPa, temperature: c.T_K, waterVapourDensity: c.rho_gm3 },
    });

    expectRel(model(downlink(45, c.elevation_deg), hz(c.f_GHz))[0].db, c.A_gas_dB);
  });

  it('falls back to Annex 1 below 5 degrees for the Annex 2 method', () => {
    const model = atmosphericLossModel({ gasMethod: 'annex2', surfaceMeteorology: { pressure: 1013, temperature: 288, waterVapourDensity: 7.5 } });

    expectRel(model(downlink(45, 3), hz(20))[0].db, gasSlantAttenuation(hz(20), 3 as Degrees), 1e-14);
  });

  it('reproduces the sheet cloud attenuation (P.840-9 row 1: 6 GHz, 15 degrees, L = 0.8236 kg/m^2)', () => {
    const c = ref.P840.sheet_cases[0];
    const terms = atmosphericLossModel({ gas: false, cloudLiquidWater: c.L_kgm2 })(downlink(0, c.elevation_deg), hz(c.f_GHz));

    expect(terms.map((t) => t.name)).toEqual(['cloud']);
    expectRel(terms[0].db, c.Ac_dB);
  });

  it('evaluates cloud at 5 degrees below 5 degrees elevation (documented underestimate)', () => {
    const m = atmosphericLossModel({ gas: false, cloudLiquidWater: 1 });

    expectRel(m(downlink(0, 2), hz(20))[0].db, m(downlink(0, 5), hz(20))[0].db, 1e-14);
  });
});

describe('atmosphericLossModel behaviour', () => {
  it('reports rain, gas and cloud in that order when all are enabled', () => {
    const terms = atmosphericLossModel({ rainRate: 20, cloudLiquidWater: 0.5 })(downlink(40, 30), hz(20));

    expect(terms.map((t) => t.name)).toEqual(['rain', 'gas', 'cloud']);
    for (const t of terms) {
      expect(t.db).toBeGreaterThan(0);
    }
  });

  it('gives a 0 dB rain term for a zero rain rate', () => {
    expect(byName(atmosphericLossModel({ rainRate: 0, gas: false })(downlink(40, 30), hz(20)), 'rain')).toBe(0);
  });

  it('Ka band fades more than Ku band for the same rain, and low elevation more than high', () => {
    const m = atmosphericLossModel({ rainRate: 30, rainHeight: 3.5 as Kilometers, gas: false });
    const ku = byName(m(downlink(45, 35), hz(12)), 'rain') as number;
    const ka = byName(m(downlink(45, 35), hz(30)), 'rain') as number;
    const low = byName(m(downlink(45, 10), hz(12)), 'rain') as number;

    expect(ka).toBeGreaterThan(ku);
    expect(low).toBeGreaterThan(ku);
  });

  it('gas attenuation is larger at low elevation and at the 22 GHz water line than at 15 GHz', () => {
    const m = atmosphericLossModel();

    expect(byName(m(downlink(45, 5), hz(20)), 'gas')).toBeGreaterThan(byName(m(downlink(45, 40), hz(20)), 'gas') as number);
    expect(byName(m(downlink(45, 40), hz(22.2)), 'gas')).toBeGreaterThan(byName(m(downlink(45, 40), hz(15)), 'gas') as number);
  });

  it('returns no terms for a space-to-space link (no ground end)', () => {
    expect(atmosphericLossModel({ rainRate: 50, cloudLiquidWater: 1 })({ distance: 1000 as Kilometers }, hz(20))).toEqual([]);
  });

  it('rejects a terrestrial link (both ends on the ground) instead of summing two Earth-space columns', () => {
    const m = atmosphericLossModel({ rainRate: 20, rainHeight: 3 as Kilometers });

    expect(() => m({ distance: 100 as Kilometers, tx: end(40, 20), rx: end(50, 35) }, hz(20))).toThrow(ValidationError);
    // One ground end is still an Earth-space link.
    expect(m({ distance: 100 as Kilometers, rx: end(50, 35) }, hz(20)).map((t) => t.name)).toEqual(['rain', 'gas']);
  });

  it('can disable the gas term', () => {
    expect(atmosphericLossModel({ gas: false })(downlink(40, 30), hz(20))).toEqual([]);
  });

  it('validates parameters when built', () => {
    expect(() => atmosphericLossModel({ rainRate: -1 })).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ rainRate: NaN })).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ cloudLiquidWater: -1 })).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ rainHeight: -1 as Kilometers })).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ exceedancePercent: 10 })).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ polarizationTilt: NaN as Degrees })).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ gasMethod: 'annex2' })).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ gasMethod: 'annex3' as 'annex1' })).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ gasMethod: 'annex2', surfaceMeteorology: { pressure: 0, temperature: 288, waterVapourDensity: 7 } })).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ gasMethod: 'annex2', surfaceMeteorology: { pressure: 1013, temperature: 0, waterVapourDensity: 7 } })).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ gasMethod: 'annex2', surfaceMeteorology: { pressure: 1013, temperature: 288, waterVapourDensity: -1 } })).toThrow(ValidationError);
  });

  it('validates frequency per enabled term and rejects a link below the horizon', () => {
    expect(() => atmosphericLossModel({ rainRate: 10, gas: false })(downlink(40, 30), hz(60))).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ cloudLiquidWater: 1, gas: false })(downlink(40, 30), hz(250))).toThrow(ValidationError);
    expect(() => atmosphericLossModel()(downlink(40, 30), hz(0.5))).toThrow(ValidationError);
    expect(() => atmosphericLossModel({ gasMethod: 'annex2', surfaceMeteorology: { pressure: 1013, temperature: 288, waterVapourDensity: 7 } })(downlink(40, 30), hz(400)))
      .toThrow(ValidationError);
    expect(() => atmosphericLossModel()(downlink(40, -0.5), hz(20))).toThrow(ValidationError);
  });
});

type Vec = { x: number; y: number; z: number };
const geoEcef = (latDeg: number, lonDeg: number, altKm: number): Vec =>
  llaRad2ecef({ lat: latDeg * DEG, lon: lonDeg * DEG, alt: altKm } as never);
const spaceStub = (j2000: Vec, ecef: Vec) =>
  ({ id: 99, name: 'sat', toJ2000: () => ({ position: j2000 }), ecef: () => ecef }) as never;

describe('atmosphericLossModel in Transmitter.calculateLinkBudget', () => {
  it('adds rain, gas and cloud terms and lowers the received power by their sum', () => {
    const f = 20e9 as Hertz;
    const ground = new GroundStation({ lat: 40 as Degrees, lon: -3 as Degrees, alt: 0.6 as Kilometers });
    const p = ground.toJ2000(DATE).position;
    const sat = spaceStub({ x: p.x + 38000, y: p.y, z: p.z }, geoEcef(0, 0, 35786));
    const mk = (): { tx: Transmitter; rx: Receiver } => {
      const tx = new Transmitter({
        id: 1, name: 'tx', frequency: f, power: 10 as Watts, bandwidth: 36e6 as Hertz, antenna: new Antenna({ gain: 30 as Decibels }), lineLoss: 0 as Decibels,
      });
      const rx = new Receiver({
        id: 2, name: 'rx', frequency: f, bandwidth: 36e6 as Hertz, noiseFigure: 1.5 as Decibels, minimumSnr: 3 as Decibels,
        antenna: new Antenna({ gain: 40 as Decibels }), lineLoss: 0 as Decibels,
      });

      tx.setParent(sat);
      rx.setParent(ground);

      return { tx, rx };
    };

    const clear = mk();
    const base = clear.tx.calculateLinkBudget(clear.rx, DATE);
    const wet = mk();
    const budget = wet.tx.calculateLinkBudget(wet.rx, DATE, {
      lossModels: [atmosphericLossModel({ rainRate: 25, rainHeight: 3.2 as Kilometers, cloudLiquidWater: 0.6 })],
    });
    const names = (budget.losses ?? []).map((t) => t.name);
    const sum = (budget.losses ?? []).reduce((s, t) => s + t.db, 0);

    expect(names).toEqual(['rain', 'gas', 'cloud']);
    expect(budget.totalAdditionalLoss).toBeCloseTo(sum, 12);
    expect(sum).toBeGreaterThan(0);
    expect(budget.receivedPower).toBeCloseTo(base.receivedPower - sum, 9);
  });
});
