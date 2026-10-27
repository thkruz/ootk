/**
 * Permanent regression tests for the v8 fixes from the QA deep dive (2026-10-13),
 * slice 2.5 plus section 1 item 3.
 * Report: hq/reports/ootk-qa-deep-dive-2026-10-13.md
 * Moved from test/qa/od-maneuver-orbit-design.qa.test.ts.
 *
 * Each test asserts the corrected behavior. Do not loosen tolerances to make them pass.
 */

import {
  ClassicalElements,
  DEG2RAD,
  Earth,
  EpochUTC,
  J2000,
  Kilometers,
  PlaneChangeBurn,
  Radians,
  Seconds,
  Vector3D,
  Waypoint,
} from '@src/main';
import { KeplerPropagator } from '@src/propagator/KeplerPropagator';

function leoElements(epoch: EpochUTC): ClassicalElements {
  return new ClassicalElements({
    epoch,
    semimajorAxis: (Earth.radiusMean + 400) as Kilometers,
    eccentricity: 0.0,
    inclination: (51.6 * DEG2RAD) as Radians,
    argPerigee: 0 as Radians,
    rightAscension: (45 * DEG2RAD) as Radians,
    trueAnomaly: 0 as Radians,
  });
}

describe('Waypoint (QA 2026-10 regressions)', () => {
  /*
   * Report section 1 item 3, src/maneuver/Waypoint.ts:179.
   * `revs = Math.floor(tof / state.period)` divided seconds by minutes. For a 30 min
   * (1800 s) transfer on a 92.4 min orbit this asked Lambert for floor(1800 / 92.4) = 19
   * revolutions instead of 0, and the solve failed with "Lambert solve result is null".
   * Expected: no throw, and a near-zero burn because the waypoint is on the same orbit.
   */
  it('Waypoint.toManeuvers solves a 30 minute LEO transfer without throwing', () => {
    const start = EpochUTC.fromDateTimeString('2024-01-01T12:00:00.000Z');
    const elements = leoElements(start);
    const interceptor = J2000.fromClassicalElements(elements);
    const target = new KeplerPropagator(elements).ephemeris(start, start.roll(7200 as Seconds), 60 as Seconds);
    const wpEpoch = start.roll(1800 as Seconds);
    const waypoint = new Waypoint(wpEpoch, new Vector3D(0 as Kilometers, 0 as Kilometers, 0 as Kilometers));

    let maneuvers: ReturnType<typeof Waypoint.toManeuvers> = [];

    expect(() => {
      maneuvers = Waypoint.toManeuvers(interceptor, start, [waypoint], target, null, null);
    }).not.toThrow();

    expect(maneuvers).toHaveLength(1);
    // Same orbit, same point: the burn should be essentially zero (m/s).
    expect(maneuvers[0].magnitude).toBeLessThan(0.1);
  });
});

describe('PlaneChangeBurn (QA 2026-10 regressions)', () => {
  /*
   * Report 2.5, src/maneuver/PlaneChangeBurn.ts:115-136.
   * A pure plane change rotates only the horizontal velocity component:
   * dv = 2 v cos(gamma) sin(di/2). The old code used the full speed v.
   * e = 0.7, node at nu = 90 deg: tan(gamma) = e sin(nu)/(1 + e cos(nu)) = 0.7, so
   * cos(gamma) = 0.819 and the old code was about 22% high.
   */
  it('PlaneChangeBurn.compute uses the horizontal velocity at an eccentric node (2 v cos(gamma) sin(di/2))', () => {
    const a = 20000;
    const e = 0.7;
    const elements = new ClassicalElements({
      epoch: EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z'),
      semimajorAxis: a as Kilometers,
      eccentricity: e,
      inclination: (30 * DEG2RAD) as Radians,
      rightAscension: 0 as Radians,
      // Ascending node at argPerigee + nu = 0 (mod 360), so nu = 90 deg at the node.
      argPerigee: (270 * DEG2RAD) as Radians,
      trueAnomaly: 0 as Radians,
    });
    const di = 10 * DEG2RAD;
    const result = PlaneChangeBurn.compute(elements, elements.inclination + di, 0, 'ascending');

    const nu = 90 * DEG2RAD;
    const p = a * (1 - e * e);
    const r = p / (1 + e * Math.cos(nu));
    const v = Math.sqrt(Earth.mu * (2 / r - 1 / a));
    const gamma = Math.atan2(e * Math.sin(nu), 1 + e * Math.cos(nu));
    const expected = 2 * v * Math.cos(gamma) * Math.sin(di / 2);

    expect(Math.abs(result.deltaV - expected) / expected).toBeLessThan(1e-3);
  });
});
