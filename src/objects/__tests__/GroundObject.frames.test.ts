import { Degrees, DynamicGroundObject, GroundStation, Kilometers, RAE, Satellite, TleLine1, TleLine2 } from '../../main';

/**
 * A ground site has one position: the WGS84 one that ecef() and Satellite.rae() use.
 * Every inertial representation (eci() in TEME, toJ2000() in J2000) must be that same
 * point in the matching frame, moving with the Earth.
 */
describe('GroundObject inertial positions agree with its WGS84 ECEF position', () => {
  const galway = new GroundStation({ name: 'Galway', lat: 53.27 as Degrees, lon: -9.05 as Degrees, alt: 0.02 as Kilometers });
  const date = new Date(Date.UTC(2027, 2, 17, 6, 10, 0));

  it('toJ2000() rotates back to ecef() and is at rest in ITRF', () => {
    const itrf = galway.toJ2000(date).toITRF();
    const ecef = galway.ecef();

    // Was ~30 km off (spherical Earth, and a GMST-only rotation labelled J2000)
    expect(itrf.position.subtract({ x: ecef.x, y: ecef.y, z: ecef.z } as never).magnitude()).toBeLessThan(0.001);
    // Was 0.28 km/s (zero inertial velocity means the site spins backwards in ITRF)
    expect(itrf.velocity.magnitude()).toBeLessThan(1e-6);
  });

  it('toJ2000() carries the Earth-rotation velocity', () => {
    const j2000 = galway.toJ2000(date);
    const rho = Math.hypot(galway.ecef().x, galway.ecef().y);

    expect(j2000.velocity.magnitude()).toBeCloseTo(7.292115146706979e-5 * rho, 6);
  });

  it('RAE from the J2000 states matches Satellite.rae() (TEME/GMST path)', () => {
    const sat = new Satellite({
      name: 'SAR test LEO',
      tle1: '1 61701U 27015A   27076.25694444  .00001000  00000-0  10000-3 0  9995' as TleLine1,
      tle2: '2 61701  97.2000 280.0000 0010000  90.0000 275.7500 15.60000000123458' as TleLine2,
    });

    let checked = 0;

    for (let ms = date.getTime(); ms < date.getTime() + 86400e3; ms += 60e3) {
      const d = new Date(ms);
      const rae = sat.rae(galway, d)!;

      if (rae.el < 5) {
        continue;
      }
      const fromJ2000 = RAE.fromStateVector(sat.toJ2000(d), galway.toJ2000(d));
      const rdot = (sat.rae(galway, new Date(ms + 500))!.rng - sat.rae(galway, new Date(ms - 500))!.rng);

      expect(Math.abs(fromJ2000.rng - rae.rng)).toBeLessThan(0.01);
      expect(Math.abs(fromJ2000.el - rae.el)).toBeLessThan(0.001);
      expect(Math.abs(fromJ2000.rngRate! - rdot)).toBeLessThan(0.001);
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });
});

describe('DynamicGroundObject uses the same site model as GroundObject', () => {
  const t0 = new Date(Date.UTC(2027, 2, 17, 6, 0, 0));
  const ship = new DynamicGroundObject({
    name: 'Ship',
    waypoints: [
      { time: t0, lat: 53.27 as Degrees, lon: -9.05 as Degrees, alt: 0.02 as Kilometers },
      { time: new Date(t0.getTime() + 3600e3), lat: 53.27 as Degrees, lon: -9.05 as Degrees, alt: 0.02 as Kilometers },
    ],
  });
  const fixed = new GroundStation({ lat: 53.27 as Degrees, lon: -9.05 as Degrees, alt: 0.02 as Kilometers });
  const date = new Date(t0.getTime() + 600e3);

  it('getEci() equals GroundObject.eci() (was ~21 km off on the spherical Earth)', () => {
    const a = ship.getEci(date)!;
    const b = fixed.eci(date);

    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-9);
  });

  it('getJ2000() equals GroundObject.toJ2000()', () => {
    const a = ship.getJ2000(date)!;
    const b = fixed.toJ2000(date);

    expect(a.position.subtract(b.position).magnitude()).toBeLessThan(1e-9);
    expect(a.velocity.subtract(b.velocity).magnitude()).toBeLessThan(1e-12);
  });
});
