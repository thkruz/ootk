import { Degrees, GroundStation, Kilometers, RAE, Satellite, TleLine1, TleLine2 } from '../../main';

/**
 * toRae() rates must match the analytic rates RAE.fromStateVector() derives from the J2000
 * states (an independent path: J2000 -> ITRF with precession and nutation, vs rae()'s
 * TEME -> GMST rotation), in the units RAE stores: km/s and rad/s.
 */
describe('Satellite.toRae rates', () => {
  const sat = new Satellite({
    name: 'SAR test LEO',
    tle1: '1 61701U 27015A   27076.25694444  .00001000  00000-0  10000-3 0  9995' as TleLine1,
    tle2: '2 61701  97.2000 280.0000 0010000  90.0000 275.7500 15.60000000123458' as TleLine2,
  });
  const galway = new GroundStation({ name: 'Galway', lat: 53.27 as Degrees, lon: -9.05 as Degrees, alt: 0.02 as Kilometers });
  const start = Date.UTC(2027, 2, 17, 6, 10, 0);

  it('matches the analytic range, azimuth and elevation rates across visible passes', () => {
    let checked = 0;

    for (let ms = start; ms < start + 86400e3; ms += 10e3) {
      const d = new Date(ms);
      const rae = sat.toRae(galway, d)!;

      if (rae.el < 10) {
        continue;
      }
      const ref = RAE.fromStateVector(sat.toJ2000(d), galway.toJ2000(d));

      // Azimuth rate was in deg/s while RAE stores rad/s (57x too large), and the 1 s
      // forward difference put range rate 0.5 s late (tens of m/s near closest approach).
      expect(Math.abs(rae.rngRate! - ref.rngRate!)).toBeLessThan(0.002);
      expect(Math.abs(rae.azRateRad! - ref.azRateRad!)).toBeLessThan(1e-4 + 1e-3 * Math.abs(ref.azRateRad!));
      expect(Math.abs(rae.elRateRad! - ref.elRateRad!)).toBeLessThan(1e-5);
      // The deg/s getters agree with the analytic values too
      expect(Math.abs(rae.elRate! - ref.elRate!)).toBeLessThan(1e-3);
      checked++;
    }

    expect(checked).toBeGreaterThan(10);
  });

  it('does not jump by 360 deg when the azimuth passes through north', () => {
    const svalbard = new GroundStation({ name: 'Svalbard', lat: 78.23 as Degrees, lon: 15.41 as Degrees, alt: 0.5 as Kilometers });
    let crossings = 0;

    for (let ms = start; ms < start + 86400e3; ms += 1e3) {
      const before = sat.rae(svalbard, new Date(ms - 500))!;
      const after = sat.rae(svalbard, new Date(ms + 500))!;

      if (before.el > 0 && Math.abs(after.az - before.az) > 180) {
        const rae = sat.toRae(svalbard, new Date(ms))!;

        expect(Math.abs(rae.azRate!)).toBeLessThan(5);
        crossings++;
      }
    }
    expect(crossings).toBeGreaterThan(0);
  });
});
