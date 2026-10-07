import { ClassicalElements, EpochUTC, J2000, Kilometers, KilometersPerSecond, OrbitRegime, Radians, Seconds, Vector3D } from '../../main';

/** Closed-form checks: vis-viva, Kepler's equation, and the period ranges of the regimes. */
describe('ClassicalElements closed-form checks', () => {
  const epoch = EpochUTC.fromDateTime(new Date('2024-01-01T00:00:00Z'));

  it('fromStateVector uses the given mu for the semimajor axis (vis-viva)', () => {
    const r = 2000;
    const v = 1.6;
    const mu = 4902.8; // Moon
    const state = new J2000(epoch, new Vector3D(r as Kilometers, 0 as Kilometers, 0 as Kilometers),
      new Vector3D(0 as KilometersPerSecond, v as KilometersPerSecond, 0 as KilometersPerSecond));
    const el = ClassicalElements.fromStateVector(state, mu);

    // Was 1006.5 km (Earth's mu) instead of 2092.7 km
    expect(el.semimajorAxis).toBeCloseTo(1 / (2 / r - (v * v) / mu), 9);
  });

  it('propagate() satisfies Kepler\'s equation for high eccentricity', () => {
    for (const [a, e, dt] of [[100000, 0.95, 100], [100000, 0.95, 1000], [26600, 0.74, 300]] as const) {
      const el = new ClassicalElements({
        epoch,
        semimajorAxis: a as Kilometers,
        eccentricity: e,
        inclination: 1 as Radians,
        rightAscension: 0.5 as Radians,
        argPerigee: 0.3 as Radians,
        trueAnomaly: -0.2 as Radians, // just before perigee
      });
      const out = el.propagate(epoch.roll(dt as Seconds));
      const meanAnomaly = (nu: number): number => {
        const ea = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));

        return ea - e * Math.sin(ea);
      };
      const expectedM = meanAnomaly(-0.2) + el.meanMotion * dt;

      // The 32-step fixed-point solve left up to 226 km of position error here
      expect(meanAnomaly(out.trueAnomaly)).toBeCloseTo(expectedM, 10);
    }
  });

  it('getOrbitRegime() classifies a GPS orbit as MEO', () => {
    const gps = new ClassicalElements({
      epoch,
      semimajorAxis: 26560 as Kilometers,
      eccentricity: 0.01,
      inclination: 0.96 as Radians,
      rightAscension: 0 as Radians,
      argPerigee: 0 as Radians,
      trueAnomaly: 0 as Radians,
    });

    // period is already in minutes; scaling it by 1/60 made MEO unreachable
    expect(gps.getOrbitRegime()).toBe(OrbitRegime.MEO);
  });
});
