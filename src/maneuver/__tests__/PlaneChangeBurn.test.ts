import { ClassicalElements, DEG2RAD, Earth, EpochUTC, Kilometers, Radians } from '../../main';
import { PlaneChangeBurn } from '../PlaneChangeBurn';

const epoch = EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z');

describe('PlaneChangeBurn', () => {
  it('reduces to 2 v sin(di/2) with v = sqrt(mu/a) on a circular orbit (Vallado, 4th ed., Sec. 6.4)', () => {
    const a = 7000;
    const elements = new ClassicalElements({
      epoch,
      semimajorAxis: a as Kilometers,
      eccentricity: 0,
      inclination: (28.5 * DEG2RAD) as Radians,
      rightAscension: 0 as Radians,
      argPerigee: 0 as Radians,
      trueAnomaly: (45 * DEG2RAD) as Radians,
    });
    const di = 5 * DEG2RAD;
    const result = PlaneChangeBurn.compute(elements, elements.inclination - di, 0, 'ascending');
    const expected = 2 * Math.sqrt(Earth.mu / a) * Math.sin(di / 2);

    expect(result.deltaV).toBeCloseTo(expected, 9);
  });

  /*
   * Independent check: the delta-v of an impulsive burn is |v_after - v_before| at the burn
   * point. Build both inertial velocity vectors from the pre- and post-burn elements and compare.
   * This holds for any flight-path angle, so it tests the cos(gamma) factor without the formula.
   */
  it.each([
    [0.7, 270, 'ascending'],
    [0.3, 200, 'descending'],
    [0.1, 0, 'ascending'],
  ] as const)('matches |v_after - v_before| for e = %f, argPerigee = %f deg, %s node', (e, wDeg, node) => {
    const elements = new ClassicalElements({
      epoch,
      semimajorAxis: 20000 as Kilometers,
      eccentricity: e,
      inclination: (30 * DEG2RAD) as Radians,
      rightAscension: (40 * DEG2RAD) as Radians,
      argPerigee: (wDeg * DEG2RAD) as Radians,
      trueAnomaly: (10 * DEG2RAD) as Radians,
    });
    const result = PlaneChangeBurn.compute(elements, elements.inclination + 10 * DEG2RAD, 0, node);
    const before = elements.propagate(result.burnEpoch).toPositionVelocity();
    const after = result.postBurnElements.toPositionVelocity();

    // Same position: the burn is impulsive.
    expect(after.position.distance(before.position)).toBeLessThan(1e-6);
    expect(Math.abs(result.deltaV - after.velocity.distance(before.velocity))).toBeLessThan(1e-9);
  });
});
