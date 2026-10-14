/**
 * Regression tests for the 2026-10 QA fixes in src/coordinate, each checked against an independent reference
 * (closed form, published example, python-sgp4, Space-Track definition) rather than a snapshot.
 */
import {
  ClassicalElements,
  EpochUTC,
  FormatTle,
  Geodetic,
  Hill,
  ITRF,
  J2000,
  OrbitRegime,
  Thrust,
  Tle,
  Vector3D,
  Waypoint,
  earthGravityParam,
  type Degrees,
  type Kilometers,
  type KilometersPerSecond,
  type MetersPerSecond,
  type Radians,
  type Seconds,
  type TleLine1,
  type TleLine2,
} from '../../main';
import { convert6DigitToA5, convertA5to6Digit } from '../alpha5';

const km = (v: number) => v as Kilometers;
const kms = (v: number) => v as KilometersPerSecond;
const DEG = Math.PI / 180;
const epoch = EpochUTC.fromDateTime(new Date('2025-01-19T12:00:00.000Z'));

describe('alpha-5 encoder (Space-Track definition)', () => {
  /*
   * Space-Track "Alpha-5" documentation: the first two digits 10-33 map to A-Z skipping I and O
   * (A=10 ... H=17, J=18 ... N=22, P=23 ... Z=33). Examples published there.
   */
  it.each([
    ['100000', 'A0000'],
    ['148493', 'E8493'],
    ['182931', 'J2931'],
    ['234018', 'P4018'],
    ['301929', 'W1929'],
    ['339999', 'Z9999'],
  ])('encodes %s as %s and decodes it back', (sixDigit, alpha5) => {
    expect(convert6DigitToA5(sixDigit)).toBe(alpha5);
    expect(convertA5to6Digit(alpha5)).toBe(sixDigit);
  });

  it('every number from 100000 to 339999 round-trips and never uses I or O', () => {
    for (let n = 100000; n <= 339999; n++) {
      const six = n.toString();
      const a5 = convert6DigitToA5(six);

      if ((/^[IO]/u).test(a5) || convertA5to6Digit(a5) !== six) {
        throw new Error(`${six} encoded as ${a5}`);
      }
    }
  });

  it('every number from 230000 to 239999 encodes with the letter P', () => {
    for (let n = 230000; n <= 239999; n++) {
      expect(convert6DigitToA5(n.toString())[0]).toBe('P');
    }
  });

  it('a zero-padded 6-digit number below 100000 encodes as its plain 5 digits', () => {
    expect(convert6DigitToA5('012345')).toBe('12345');
  });
});

describe('Tle.meanMoDev2 (assumed decimal point and exponent)', () => {
  /*
   * Spacetrack Report #3 test case 88888, line 1 as distributed with python-sgp4. python-sgp4 2.27
   * (sgp4.io.twoline2rv with wgs72) parses the nddot field ' 13844-3' to 2.913090538750181e-13 rad/min^3, which
   * times xpdotp * 1440^2 (xpdotp = 1440 / 2pi) is 0.00013844 rev/day^3.
   */
  it('matches python-sgp4 for the Spacetrack Report #3 TLE (88888): 1.3844e-4', () => {
    const line1 = '1 88888U          80275.98708465  .00073094  13844-3  66816-4 0    87' as TleLine1;

    expect(line1.substring(44, 52)).toBe(' 13844-3');
    expect(Tle.meanMoDev2(line1)).toBeCloseTo(1.3844e-4, 15);
  });

  // The nddot and BSTAR fields share the SMMMMMEX format, so the same 8 characters must decode identically.
  it.each([' 12345-5', '-12345-5', ' 50000+1', '+00000+0', ' 00000-0'])('decodes %s the same way Tle.bstar decodes it', (field) => {
    const base = '1 88888U          80275.98708465  .00073094  00000-0  00000-0 0    87';
    const nddotLine = `${base.substring(0, 44)}${field}${base.substring(52)}` as TleLine1;
    const bstarLine = `${base.substring(0, 53)}${field}${base.substring(61)}` as TleLine1;

    expect(Tle.meanMoDev2(nddotLine)).toBeCloseTo(Tle.bstar(bstarLine), 15);
  });
});

describe('ITRF.toGeodetic on the polar axis', () => {
  // WGS-84 closed form: on the polar axis lat = +/-90 deg and h = |z| - b, b = a (1 - f).
  it.each([7000, -7000, 6356.7523142, -6356.7523142, 100])('z = %s km gives lat = sign(z) 90 deg and h = |z| - b', (z) => {
    const geo = new ITRF(epoch, new Vector3D(km(0), km(0), km(z)), new Vector3D(kms(0), kms(0), kms(0))).toGeodetic();
    const b = 6378.1363 * (1 - 1 / 298.257223563); // Earth.radiusEquator and Earth.flattening

    expect(geo.lat).toBe((Math.sign(z) * Math.PI) / 2);
    expect(geo.alt).toBeCloseTo(Math.abs(z) - b, 9);
    // Within 1 m of the WGS-84 polar radius 6356.7523142 km (ootk's a is 6378.1363, not 6378.137).
    expect(Math.abs(Math.abs(z) - geo.alt - 6356.7523142)).toBeLessThan(1e-3);
  });

  it('agrees with Geodetic.toITRF round trip near the pole (1 m off the axis)', () => {
    const g = new Geodetic((89.99999 * DEG) as Radians, (30 * DEG) as Radians, km(500));
    const back = g.toITRF(epoch).toGeodetic();

    expect(back.lat).toBeCloseTo(g.lat, 12);
    expect(back.alt).toBeCloseTo(500, 9);
  });
});

describe('ClassicalElements.fromStateVector (Vallado Algorithm 9)', () => {
  /*
   * Vallado, Fundamentals of Astrodynamics and Applications, 4th ed., Example 2-5, mu = 398600.4418:
   * p = 11067.790 km, e = 0.832853, i = 87.870 deg, RAAN = 227.898 deg, argp = 53.38 deg, nu = 92.335 deg.
   */
  it('reproduces Vallado Example 2-5', () => {
    const state = new J2000(
      epoch,
      new Vector3D(km(6524.834), km(6862.875), km(6448.296)),
      new Vector3D(kms(4.901327), kms(5.533756), kms(-1.976341)),
    );
    const coe = ClassicalElements.fromStateVector(state, 398600.4418);

    expect(coe.semimajorAxis * (1 - coe.eccentricity ** 2)).toBeCloseTo(11067.79, 1);
    expect(coe.eccentricity).toBeCloseTo(0.832853, 5);
    expect(coe.inclinationDegrees).toBeCloseTo(87.87, 2);
    expect(coe.rightAscensionDegrees).toBeCloseTo(227.898, 2);
    expect(coe.argPerigeeDegrees).toBeCloseTo(53.38, 1);
    expect(coe.trueAnomalyDegrees).toBeCloseTo(92.335, 2);
  });

  // Equatorial circular orbit: only the true longitude is defined; it must equal atan2(y, x) of the position.
  it.each([0, 1, 2, 3, 4, 5, 6])('a prograde equatorial circular orbit at true longitude %s rad keeps it', (lambda) => {
    const r = 7000;
    const v = Math.sqrt(earthGravityParam / r);
    const state = new J2000(
      epoch,
      new Vector3D(km(r * Math.cos(lambda)), km(r * Math.sin(lambda)), km(0)),
      new Vector3D(kms(-v * Math.sin(lambda)), kms(v * Math.cos(lambda)), kms(0)),
    );
    const coe = ClassicalElements.fromStateVector(state);

    expect(coe.rightAscension).toBe(0);
    expect(coe.argPerigee).toBe(0);
    expect(coe.trueAnomaly).toBeCloseTo(lambda, 12);
    expect(coe.toJ2000().position.subtract(state.position).magnitude()).toBeLessThan(1e-6);
    expect(coe.toJ2000().velocity.subtract(state.velocity).magnitude()).toBeLessThan(1e-9);
  });

  // Symmetry: a retrograde equatorial orbit is the mirror (y -> -y) of a prograde one, and both round-trip.
  it('retrograde and prograde equatorial eccentric orbits both round-trip in position and velocity', () => {
    for (const ySign of [1, -1]) {
      const vp = 1.1 * Math.sqrt(earthGravityParam / 7000);
      const state = new J2000(
        epoch,
        new Vector3D(km(4000), km(ySign * 5000), km(0)),
        new Vector3D(kms(-ySign * vp * 0.6), kms(vp * 0.8), kms(0)),
      );
      const back = ClassicalElements.fromStateVector(state).toJ2000();

      expect(back.position.subtract(state.position).magnitude()).toBeLessThan(1e-6);
      expect(back.velocity.subtract(state.velocity).magnitude()).toBeLessThan(1e-9);
    }
  });

  // Inclined circular: argp = 0 and trueAnomaly is the argument of latitude.
  it('an inclined circular orbit returns argp = 0 and the argument of latitude as true anomaly', () => {
    const coe0 = new ClassicalElements({
      epoch,
      semimajorAxis: km(7000),
      eccentricity: 0,
      inclination: (51.6 * DEG) as Radians,
      rightAscension: 1 as Radians,
      argPerigee: 0.4 as Radians,
      trueAnomaly: 2 as Radians,
    });
    const coe = ClassicalElements.fromStateVector(coe0.toJ2000());

    expect(coe.argPerigee).toBe(0);
    expect(coe.trueAnomaly).toBeCloseTo(2.4, 9);
    expect(coe.rightAscension).toBeCloseTo(1, 9);
  });
});

describe('ClassicalElements apogee and perigee', () => {
  // Plan section 6: altitudes are above the WGS-84 equatorial radius 6378.137 km; radii are geocentric.
  it('altitude = geocentric radius - 6378.137 km', () => {
    const coe = new ClassicalElements({
      epoch,
      semimajorAxis: km(26560),
      eccentricity: 0.7,
      inclination: (63.4 * DEG) as Radians,
      rightAscension: 0 as Radians,
      argPerigee: (270 * DEG) as Radians,
      trueAnomaly: 0 as Radians,
    });

    expect(coe.apogeeRadius).toBeCloseTo(26560 * 1.7, 9);
    expect(coe.perigeeRadius).toBeCloseTo(26560 * 0.3, 9);
    expect(coe.apogee).toBeCloseTo(26560 * 1.7 - 6378.137, 9);
    expect(coe.perigee).toBeCloseTo(26560 * 0.3 - 6378.137, 9);
  });

  it('Tle.apogee and Tle.perigee use the same reference as ClassicalElements', () => {
    const tle = new Tle(
      '1 25544U 98067A   25019.50000000  .00016717  00000-0  10270-3 0  9005' as TleLine1,
      '2 25544  51.6400 339.8000 0002571  90.5000 269.6000 15.50000000000000' as TleLine2,
    );

    expect(tle.apogeeRadius - tle.apogee).toBeCloseTo(6378.137, 9);
    expect(tle.perigeeRadius - tle.perigee).toBeCloseTo(6378.137, 9);
  });
});

describe('ClassicalElements.getOrbitRegime MEO band', () => {
  const regime = (a: number, e = 0.001) => new ClassicalElements({
    epoch,
    semimajorAxis: km(a),
    eccentricity: e,
    inclination: (55 * DEG) as Radians,
    rightAscension: 0 as Radians,
    argPerigee: 0 as Radians,
    trueAnomaly: 0 as Radians,
  }).getOrbitRegime();

  // Published semimajor axes: O3b 14,440 km; GLONASS 25,510 km; GPS 26,560 km; BeiDou MEO 27,906 km; Galileo 29,600 km.
  it.each([14440, 25510, 26560, 27906, 29600])('a = %s km is MEO', (a) => {
    expect(regime(a)).toBe(OrbitRegime.MEO);
  });

  it('LEO, GEO and HEO keep their classes', () => {
    expect(regime(6778)).toBe(OrbitRegime.LEO);
    expect(regime(42164)).toBe(OrbitRegime.GEO);
    expect(regime(26560, 0.72)).toBe(OrbitRegime.HEO);
  });
});

describe('EquinoctialElements.toClassicalElements angle range', () => {
  // Round trip for angles in every quadrant: each must come back in [0, 2pi) and equal to the input.
  it.each([0.5, 2, 3.5, 5.5])('RAAN = argp = nu = %s rad round-trips', (angle) => {
    const coe = new ClassicalElements({
      epoch,
      semimajorAxis: km(7000),
      eccentricity: 0.01,
      inclination: 0.9 as Radians,
      rightAscension: angle as Radians,
      argPerigee: angle as Radians,
      trueAnomaly: angle as Radians,
    });
    const back = coe.toEquinoctialElements().toClassicalElements();

    expect(back.rightAscension).toBeCloseTo(angle, 9);
    expect(back.argPerigee).toBeCloseTo(angle, 9);
    expect(back.trueAnomaly).toBeCloseTo(angle, 9);
  });
});

describe('Geodetic.isInView', () => {
  /*
   * Closed form on a sphere: the line of sight between radii r1 and r2 grazes the surface at central angle
   * acos(R/r1) + acos(R/r2). Check just inside and just outside that limit for unequal altitudes.
   */
  it('switches at acos(R/r1) + acos(R/r2) for 400 km and 20,000 km points', () => {
    const a = Geodetic.fromDegrees(0 as Degrees, 0 as Degrees, km(400));
    const limitDeg = (a.fieldOfView() + Geodetic.fromDegrees(0 as Degrees, 0 as Degrees, km(20000)).fieldOfView()) / DEG;

    expect(limitDeg).toBeGreaterThan(90);
    expect(a.isInView(Geodetic.fromDegrees(0 as Degrees, (limitDeg - 0.01) as Degrees, km(20000)))).toBe(true);
    expect(a.isInView(Geodetic.fromDegrees(0 as Degrees, (limitDeg + 0.01) as Degrees, km(20000)))).toBe(false);
  });

  it('a ground point sees a satellite exactly within the satellite horizon angle', () => {
    const ground = Geodetic.fromDegrees(0 as Degrees, 0 as Degrees, km(0));
    const satFov = Geodetic.fromDegrees(0 as Degrees, 0 as Degrees, km(500)).fieldOfView() / DEG;

    expect(ground.isInView(Geodetic.fromDegrees(0 as Degrees, (satFov - 0.01) as Degrees, km(500)))).toBe(true);
    expect(ground.isInView(Geodetic.fromDegrees(0 as Degrees, (satFov + 0.01) as Degrees, km(500)))).toBe(false);
  });
});

describe('FormatTle.eccentricity below 1e-6', () => {
  // Truncation to 7 decimals: n x 1e-7 must print n, and values below 1e-7 print zero.
  it.each([
    [5e-7, '0000005'],
    [1e-7, '0000001'],
    [9.9e-7, '0000009'],
    [5e-8, '0000000'],
    [1.5e-6, '0000015'],
    [0.0002554, '0002554'],
  ])('%s formats as %s', (ecc, expected) => {
    expect(FormatTle.eccentricity(ecc)).toBe(expected);
  });
});

describe('Hill.maneuverSequence pre-maneuver window', () => {
  /*
   * Property: the plan built by maneuverSequence, executed in order, reaches the waypoint. A pre-maneuver in
   * [epoch, pivot] is part of the coast and must be applied; one after the pivot is not a pre-maneuver.
   */
  it('keeps pre-maneuvers in [epoch, pivot], drops later ones, and the executed plan reaches the waypoint', () => {
    const t0 = epoch;
    const hill = new Hill(t0, new Vector3D(km(0), km(-1), km(0)), new Vector3D(kms(0), kms(0), kms(0)), km(6778));
    const before = new Thrust(t0.roll(300 as Seconds), 0 as MetersPerSecond, 0.1 as MetersPerSecond, 0 as MetersPerSecond);
    const after = new Thrust(t0.roll(900 as Seconds), 0.2 as MetersPerSecond, 0 as MetersPerSecond, 0 as MetersPerSecond);
    const pivot = t0.roll(600 as Seconds);
    const target = new Vector3D(km(0.2), km(-0.5), km(0.1));
    const wpt = new Waypoint(t0.roll(3000 as Seconds), target);

    const plan = hill.maneuverSequence(pivot, [wpt], [after, before]);

    expect(plan).toContain(before);
    expect(plan).not.toContain(after);

    let state = hill;

    for (const mvr of plan) {
      state = state.maneuver(mvr);
    }
    const reached = state.propagate(wpt.epoch).position;

    expect(reached.subtract(target).magnitude()).toBeLessThan(1e-9);
  });
});
