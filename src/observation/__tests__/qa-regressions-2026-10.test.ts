/**
 * QA 2026-10 regression tests for src/observation.
 *
 * Source: hq/reports/ootk-qa-deep-dive-2026-10-13.md, section 2.4.
 * Permanent regression tests for the v8 fixes; each test asserts the corrected behavior.
 * Moved from test/qa/objects-observation.qa.test.ts.
 */
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, RAE, Radians, Seconds, Vector3D } from '@src/main';

function makeEphemeris(): J2000[] {
  const base = 1704067200;
  const states: J2000[] = [];
  const w = 7.612 / 6878.137;

  // Circular 6878 km equatorial orbit sampled every 60 s.
  for (let i = 0; i < 12; i++) {
    const t = i * 60;
    const th = w * t;

    states.push(
      new J2000(
        new EpochUTC((base + t) as Seconds),
        new Vector3D(6878.137 * Math.cos(th), 6878.137 * Math.sin(th), 0) as Vector3D<Kilometers>,
        new Vector3D(-7.612 * Math.sin(th), 7.612 * Math.cos(th), 0) as Vector3D<KilometersPerSecond>,
      ),
    );
  }

  return states;
}

describe('RAE (QA 2026-10 regressions)', () => {
  // Report 2.4 (C), RAE.ts:197-208. toStateVector with missing rates must throw (per its doc)
  // or at least not mutate the observation. Expected rngRate still undefined; actual 0.
  it('toStateVector does not write 0 into missing rates on the observation', () => {
    const site = makeEphemeris()[0];
    const rae = new RAE(site.epoch, 1000 as Kilometers, 0.5 as Radians, 0.5 as Radians);

    try {
      rae.toStateVector(site);
    } catch {
      // Throwing per the documented contract is an acceptable fix.
    }

    expect(rae.rngRate).toBeUndefined();
    expect(rae.azRateRad).toBeUndefined();
    expect(rae.elRateRad).toBeUndefined();
  });
});
