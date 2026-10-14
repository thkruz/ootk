/**
 * QA 2026-10-13 regression tests: Harris-Priester F10.7 scaling and the ForceModel builder.
 *
 * Source: hq/reports/ootk-qa-deep-dive-2026-10-13.md, section 2.3.
 * Permanent regression tests for the v8 fixes. Moved from test/qa/sgp4-propagator-force.qa.test.ts.
 */
import {
  AtmosphericDrag,
  EpochUTC,
  ForceModel,
  ITRF,
  J2000,
  Kilometers,
  KilometersPerSecond,
  Sun,
  Vector3D,
} from '@src/main';

describe('Harris-Priester atmospheric drag F10.7 scaling (QA 2026-10 regressions)', () => {
  type HpFn = (state: ITRF, n: number, f107: number) => number;
  const getHPDensity = (AtmosphericDrag as unknown as { _getHPDensity: HpFn })._getHPDensity;
  const epoch = EpochUTC.fromDateTimeString('2024-03-20T12:00:00.000Z');
  const altitude = 400;

  /** ITRF states at the diurnal bulge apex (day) and its antipode (night). */
  const bulgeStates = (): { day: ITRF; night: ITRF } => {
    const sunPos = Sun.eciApparent(epoch.toDateTime());
    const sunVec = new J2000(epoch, sunPos, Vector3D.origin as Vector3D<KilometersPerSecond>)
      .toITRF().position.normalize();
    const bulge = sunVec.rotZ((-30 * Math.PI) / 180 as never).normalize();
    const r = 6378.137 + altitude + 0.5;
    const v0 = Vector3D.origin as Vector3D<KilometersPerSecond>;

    return {
      day: new ITRF(epoch, bulge.scale(r) as Vector3D<Kilometers>, v0),
      night: new ITRF(epoch, bulge.scale(-r) as Vector3D<Kilometers>, v0),
    };
  };

  /*
   * Report 2.3, force/AtmosphericDrag.ts:73-78. Density is rhoMin + (rhoMax - rhoMin) * solarScale * cosPow,
   * and solarScale = 0 at F10.7 = 70, so day == night. Standard HP has rhoMax/rhoMin of about 3-4 at 400 km.
   * Expected: day/night ratio > 2 at F10.7 = 70. Actual: exactly 1.
   */
  it('keeps the day/night density bulge at F10.7 = 70', () => {
    const { day, night } = bulgeStates();
    const rhoDay = getHPDensity(day, 4, 70);
    const rhoNight = getHPDensity(night, 4, 70);

    expect(rhoNight).toBeGreaterThan(0);
    expect(rhoDay / rhoNight).toBeGreaterThan(2);
  });

  /*
   * Report 2.3, force/AtmosphericDrag.ts:73-78. The overall density level never scales with activity:
   * night-side density is rhoMin regardless of F10.7. Expected: night density at F10.7 = 250 exceeds the
   * value at F10.7 = 70. Actual: identical.
   */
  it('night-side density increases with F10.7', () => {
    const { night } = bulgeStates();

    expect(getHPDensity(night, 4, 250)).toBeGreaterThan(getHPDensity(night, 4, 70));
  });
});

describe('ForceModel builder API (QA 2026-10 regressions)', () => {
  /*
   * Report 2.3, force/README.md and ForceModel.ts:45. README chains `.setEarthGravity(...)`; it returns void
   * so the chain throws. Expected: returns the ForceModel instance. Actual: undefined.
   */
  it('setEarthGravity returns the ForceModel so README chaining works', () => {
    const fm = new ForceModel();

    expect(fm.setEarthGravity(4, 4) as unknown).toBe(fm);
  });
});
