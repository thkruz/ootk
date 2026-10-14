/**
 * Permanent regression tests for the v8 fixes from the QA deep dive (2026-10-13),
 * slice 2.5 plus section 1 item 15.
 * Report: hq/reports/ootk-qa-deep-dive-2026-10-13.md
 * Moved from test/qa/od-maneuver-orbit-design.qa.test.ts.
 *
 * Each test asserts the corrected behavior. Do not loosen tolerances to make them pass.
 */

import { Degrees, Earth, Kilometers } from '@src/main';
import { LaunchTrajectoryGenerator, RepeatGroundTrack } from '@src/orbit-design';

describe('RepeatGroundTrack (QA 2026-10 regressions)', () => {
  /*
   * Report section 1 item 15, src/orbit-design/RepeatGroundTrack.ts:166-212.
   * The nodal period used for the repeat condition must include both the J2 drift of
   * mean anomaly (Mdot) and the apsidal rotation (omega-dot): the nodal rate of the
   * argument of latitude is n + Mdot + omega-dot (Vallado, 4th ed., Alg. 71). The old code
   * applied only the Mdot factor, so altitude came out about 3 km high.
   * Landsat-8 233/16 at 98.2 deg: expected 706.7 km, old result about 709.5 km.
   */
  it('RepeatGroundTrack.calculate puts Landsat-8 233/16 at 706.7 km', () => {
    const el = RepeatGroundTrack.calculate(233, 16, 98.2 as Degrees);
    const altitude = el.semimajorAxis - Earth.radiusMean;

    expect(Math.abs(altitude - 706.7)).toBeLessThan(1);
  });

  /*
   * Report section 1 item 15, same lines. At i = 0 deg omega-dot is largest
   * (proportional to 5 cos^2 i - 1 = 4), so omitting it costs about 12.7 km.
   * 14/1 at 0 deg: expected 819.5 km (Vallado Alg. 71 with Mdot and omega-dot).
   */
  it('RepeatGroundTrack.calculate puts the 14/1 equatorial orbit within 2 km of 819.5 km', () => {
    const el = RepeatGroundTrack.calculate(14, 1, 0 as Degrees);
    const altitude = el.semimajorAxis - Earth.radiusMean;

    expect(Math.abs(altitude - 819.5)).toBeLessThan(2);
  });

  /*
   * Report 2.5, src/orbit-design/RepeatGroundTrack.ts:318.
   * `Math.abs(Math.abs(rate) - 0.9856) < 0.1` ignored the sign. At 700 km, i = 81.8 deg
   * is the prograde mirror of the 98.2 deg SSO, so RAAN regresses at about -0.9856 deg/day.
   * Expected isSunSynchronous = false for every result; old result true.
   */
  it('RepeatGroundTrack.findNearest does not flag a prograde orbit regressing at -0.9856 deg/day as sun-synchronous', () => {
    const results = RepeatGroundTrack.findNearest(700 as Kilometers, 50 as Kilometers, {
      inclination: 81.8 as Degrees,
    });

    expect(results.length).toBeGreaterThan(0);
    // Sanity: these really are regressing (negative) orbits.
    expect(results.every((r) => r.nodalPrecessionRate < 0)).toBe(true);
    expect(results.filter((r) => r.isSunSynchronous).map((r) => `${r.revolutions}/${r.days}`)).toEqual([]);
  });
});

describe('LaunchTrajectoryGenerator (QA 2026-10 regressions)', () => {
  /*
   * Report 2.5, src/orbit-design/LaunchTrajectoryGenerator.ts:118, 400-490.
   * The inertial launch azimuth was flown as a great circle on the rotating Earth and
   * then converted ITRF to J2000, adding Earth rotation that was never compensated.
   * KSC to 51.6 deg: expected insertion inclination 51.6 +/- 0.3 deg, old result about 50.75.
   */
  it('LaunchTrajectoryGenerator inserts a KSC 51.6 deg launch within 0.3 deg of 51.6 deg', () => {
    const result = LaunchTrajectoryGenerator.generateWithBoundary({
      launchLatDeg: 28.5729,
      launchLonDeg: -80.649,
      perigeeAltKm: 400,
      apogeeAltKm: 400,
      inclinationDeg: 51.6,
      direction: 'N',
      launchTime: new Date('2024-01-01T12:00:00.000Z'),
      orbitDurationHours: 1,
    });
    const insertion = result.states[result.insertionIndex].toClassicalElements();

    expect(Math.abs(insertion.inclinationDegrees - 51.6)).toBeLessThan(0.3);
  });

  /*
   * Report 2.5, src/orbit-design/LaunchTrajectoryGenerator.ts:111-130.
   * The LEO-direct path inserted circular at the mean altitude, dropping the requested
   * eccentricity. 300 x 1500 km requests e = 1200 / (2 Re + 1800) = 0.0825; old result about 0.
   */
  it('LaunchTrajectoryGenerator keeps the requested eccentricity for a 300 x 1500 km LEO-direct orbit', () => {
    const result = LaunchTrajectoryGenerator.generateWithBoundary({
      launchLatDeg: 28.5729,
      launchLonDeg: -80.649,
      perigeeAltKm: 300,
      apogeeAltKm: 1500,
      inclinationDeg: 51.6,
      direction: 'N',
      launchTime: new Date('2024-01-01T12:00:00.000Z'),
      orbitDurationHours: 1,
    });
    const requested = (1500 - 300) / (2 * Earth.radiusMean + 1800);
    const orbit = result.states[result.insertionIndex + 1].toClassicalElements();

    expect(Math.abs(orbit.eccentricity - requested)).toBeLessThan(0.01);
  });
});
