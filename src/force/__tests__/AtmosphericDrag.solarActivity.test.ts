/**
 * QA 2026-10 regression tests for the Harris-Priester F10.7 extension (report section 2.3,
 * AtmosphericDrag.ts:73-78) and the chainable ForceModel builder (ForceModel.ts:45).
 *
 * Plan section 7 decision: F10.7 is a separate multiplicative factor on the whole HP density,
 * normalised to 1 at F10.7 = 150, never scaling the diurnal term alone.
 */
import { AtmosphericDrag } from '../AtmosphericDrag';
import { ForceModel } from '../ForceModel';
import { EpochUTC, ITRF, J2000, Kilometers, KilometersPerSecond, Sun, Vector3D } from '../../main';

type HpFn = (state: ITRF, n: number, f107: number) => number;
type ThermoFn = (heightKm: number, tInf: number) => number;
type FactorFn = (heightKm: number, f107: number) => number;
const statics = AtmosphericDrag as unknown as {
  _getHPDensity: HpFn;
  thermosphereDensity_: ThermoFn;
  solarActivityFactor_: FactorFn;
};
const getHPDensity = statics._getHPDensity;
const thermosphereDensity = statics.thermosphereDensity_.bind(AtmosphericDrag);
const solarActivityFactor = statics.solarActivityFactor_.bind(AtmosphericDrag);

const epoch = EpochUTC.fromDateTimeString('2024-03-20T12:00:00.000Z');

/** ITRF states at the diurnal bulge apex (day) and its antipode (night) at the given altitude. */
const bulgeStates = (altitude: number): { day: ITRF; night: ITRF } => {
  const sunPos = Sun.eciApparent(epoch.toDateTime());
  const sunVec = new J2000(epoch, sunPos, Vector3D.origin as Vector3D<KilometersPerSecond>)
    .toITRF().position.normalize();
  const bulge = sunVec.rotZ((-30 * Math.PI) / 180 as never).normalize();
  const r = 6378.137 + altitude;
  const v0 = Vector3D.origin as Vector3D<KilometersPerSecond>;

  return {
    day: new ITRF(epoch, bulge.scale(r) as Vector3D<Kilometers>, v0),
    night: new ITRF(epoch, bulge.scale(-r) as Vector3D<Kilometers>, v0),
  };
};

describe('AtmosphericDrag F10.7 factor (QA 2026-10)', () => {
  it('reproduces the US Standard Atmosphere 1976 total density at Tinf = 1000 K', () => {
    /*
     * The factor is a ratio of this profile at two exospheric temperatures, so the profile itself
     * is checked against an independent reference: US76 total mass density (NOAA-S/T 76-1562,
     * Table I, Tinf = 1000 K) at 200, 400 and 600 km.
     */
    expect(thermosphereDensity(200, 1000) / 2.541e-10).toBeCloseTo(1, 1);
    expect(thermosphereDensity(400, 1000) / 2.803e-12).toBeCloseTo(1, 1);
    expect(thermosphereDensity(600, 1000) / 1.137e-13).toBeCloseTo(1, 1);
  });

  it('is exactly 1 at F10.7 = 150 and at or below 120 km', () => {
    expect(solarActivityFactor(400, 150)).toBe(1);
    expect(solarActivityFactor(120, 70)).toBe(1);
    expect(solarActivityFactor(110, 250)).toBe(1);
  });

  it('increases monotonically with F10.7 at fixed altitude', () => {
    const fluxes = [50, 70, 100, 150, 200, 250, 300];

    for (const h of [200, 400, 600, 800]) {
      const factors = fluxes.map((f) => solarActivityFactor(h, f));

      for (let i = 1; i < factors.length; i++) {
        expect(factors[i]).toBeGreaterThan(factors[i - 1]);
      }
    }
  });

  it('leaves the day/night ratio unchanged for any F10.7 (scales the whole density)', () => {
    const { day, night } = bulgeStates(400);
    const ratio150 = getHPDensity(day, 4, 150) / getHPDensity(night, 4, 150);

    for (const f107 of [70, 250]) {
      expect(getHPDensity(day, 4, f107) / getHPDensity(night, 4, f107)).toBeCloseTo(ratio150, 10);
    }
  });
});

describe('ForceModel builder chaining (QA 2026-10)', () => {
  it('every setter returns the same ForceModel so README chains run', () => {
    const fm = new ForceModel();
    const chained = fm
      .setGravity()
      .setEarthGravity(4, 4)
      .setThirdBodyGravity({ moon: true, sun: true })
      .setSolarRadiationPressure(500, 10)
      .setAtmosphericDrag(500, 10, 2.2, 4, 150);

    expect(chained).toBe(fm);
  });
});

/*
 * Verifier fix M.8: the thermosphere density ratio inverts below about 190 km (1.057 at
 * F10.7 = 50 and 140 km: a quiet Sun gave MORE drag). Between 120 and 200 km the factor is now
 * 1 + s (factor(200 km) - 1), s = (h - 120) / 80, which is non-decreasing in F10.7, equals 1 at
 * F10.7 = 150 and at 120 km, and is continuous at 200 km.
 */
describe('AtmosphericDrag solar-activity factor below 200 km', () => {
  const fluxes = [0, 50, 70, 100, 150, 200, 250, 300];

  for (const h of [130, 150, 180]) {
    it(`is non-decreasing in F10.7 and exactly 1 at F10.7 = 150 at ${h} km`, () => {
      const values = fluxes.map((f) => solarActivityFactor(h, f));

      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
      expect(solarActivityFactor(h, 150)).toBe(1);
      // Quiet Sun lowers the density, active Sun raises it (the inverted ratio did the opposite)
      expect(solarActivityFactor(h, 50)).toBeLessThan(1);
      expect(solarActivityFactor(h, 250)).toBeGreaterThan(1);
    });
  }

  it('ramps linearly from 1 at 120 km to the 200 km ratio and is continuous at 200 km', () => {
    const at200 = solarActivityFactor(200, 70);
    const ratio200 = thermosphereDensity(200, 379 + 3.24 * 70) / thermosphereDensity(200, 379 + 3.24 * 150);

    expect(at200).toBeCloseTo(ratio200, 14);
    expect(solarActivityFactor(200 - 1e-9, 70)).toBeCloseTo(at200, 9);
    expect(solarActivityFactor(120, 70)).toBe(1);
    // Midpoint of the ramp is halfway between 1 and the 200 km value
    expect(solarActivityFactor(160, 70)).toBeCloseTo(1 + 0.5 * (ratio200 - 1), 14);
  });
});
