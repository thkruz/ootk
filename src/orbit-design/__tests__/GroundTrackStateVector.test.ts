import { rv2tle } from '../../orbit-determination/Rv2Tle';
import { Sgp4 } from '../../sgp4/sgp4';
import { calcGmst, eci2lla } from '../../transforms';
import { GreenwichMeanSiderealTime, Kilometers, Radians, TemeVec3 } from '../../types/types';
import { groundTrackStateVector, semimajorAxisFromMeanMotion } from '../GroundTrackStateVector';

const DEG2RAD = Math.PI / 180;

/** Minutes since a satrec's TLE epoch for a given wall-clock date. */
const tsinceMinFor = (satrec: { jdsatepoch: number }, date: Date): number => {
  const epochMs = (satrec.jdsatepoch - 2440587.5) * 86_400_000;

  return (date.getTime() - epochMs) / 60_000;
};

/** Great-circle distance (km) between two lat/lon points in degrees. */
const groundDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const earthRadiusKm = 6371;
  const p1 = lat1 * DEG2RAD;
  const p2 = lat2 * DEG2RAD;
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
};

const subPointOf = (position: { x: number; y: number; z: number }, gmst: number) =>
  eci2lla(position as TemeVec3, gmst);

describe('groundTrackStateVector', () => {
  const epoch = new Date('2026-07-17T00:00:00Z');
  const { gmst } = calcGmst(epoch);

  // ISS-like circular orbit and a Molniya-like elliptical orbit.
  const circular = { a: semimajorAxisFromMeanMotion(15.5), e: 0 };
  const elliptical = { a: semimajorAxisFromMeanMotion(2.0), e: 0.2 };

  const cases: { name: string; lat: number; lon: number; incDeg: number; dir: 'N' | 'S'; shape: { a: Kilometers; e: number } }[] = [
    { name: 'circular equator N', lat: 0, lon: 0, incDeg: 51.6, dir: 'N', shape: circular },
    { name: 'circular Cape N', lat: 28.5, lon: -80.6, incDeg: 51.6, dir: 'N', shape: circular },
    { name: 'circular Cape S', lat: 28.5, lon: -80.6, incDeg: 51.6, dir: 'S', shape: circular },
    { name: 'circular high-lat near-polar N', lat: 62, lon: 40, incDeg: 63, dir: 'N', shape: circular },
    { name: 'circular retrograde SSO S', lat: 34, lon: -120.6, incDeg: 97.8, dir: 'S', shape: circular },
    // Regression: this exact state decomposed to an inconsistent argument of latitude at e=0,
    // throwing the fitted TLE ~16000 km off before the eccentricity floor was added.
    { name: 'circular retrograde SSO S (15.5)', lat: 34, lon: -120.6, incDeg: 97.8, dir: 'S', shape: { a: semimajorAxisFromMeanMotion(15.5), e: 0 } },
    { name: 'elliptical Molniya N', lat: 45, lon: 30, incDeg: 63.4, dir: 'N', shape: elliptical },
  ];

  it.each(cases)('places the sub-point exactly over the site: $name', ({ lat, lon, incDeg, dir, shape }) => {
    const state = groundTrackStateVector({
      semimajorAxisKm: shape.a,
      eccentricity: shape.e,
      inclinationRad: (incDeg * DEG2RAD) as Radians,
      latRad: (lat * DEG2RAD) as Radians,
      lonRad: (lon * DEG2RAD) as Radians,
      gmstRad: gmst as GreenwichMeanSiderealTime,
      direction: dir,
    });

    expect(state).not.toBeNull();
    const lla = subPointOf(state!.position, gmst);

    // The constructed position must round-trip through the app's geodetic eci2lla.
    expect(lla.lat).toBeCloseTo(lat, 3);
    expect(lla.lon).toBeCloseTo(lon, 3);
  });

  it.each(cases)('rv2tle recovers the shape, sub-point, and direction: $name', ({ lat, lon, incDeg, dir, shape }) => {
    const state = groundTrackStateVector({
      semimajorAxisKm: shape.a,
      eccentricity: shape.e,
      inclinationRad: (incDeg * DEG2RAD) as Radians,
      latRad: (lat * DEG2RAD) as Radians,
      lonRad: (lon * DEG2RAD) as Radians,
      gmstRad: gmst as GreenwichMeanSiderealTime,
      direction: dir,
    })!;

    const fit = rv2tle(epoch, state.position, state.velocity, { maxIterations: 30, toleranceKm: 1e-4 });

    expect(fit).not.toBeNull();

    // Fitted inclination must match the requested orbit.
    const inc = parseFloat(fit!.tle2.substring(8, 16));

    expect(inc).toBeCloseTo(incDeg, 1);

    // Propagate the fitted TLE at the epoch and 30 s later, then check sub-point + direction.
    // (3D position carries a physically-real J2 short-period radial offset of a few km;
    // the ground track - what "launch over the site" cares about - is what we assert.)
    const satrec = Sgp4.createSatrec(fit!.tle1, fit!.tle2);
    const epochLater = new Date(epoch.getTime() + 30_000);
    const at0 = Sgp4.propagate(satrec, tsinceMinFor(satrec, epoch));
    const at1 = Sgp4.propagate(satrec, tsinceMinFor(satrec, epochLater));

    const { gmst: g0 } = calcGmst(epoch);
    const { gmst: g1 } = calcGmst(epochLater);
    const lla0 = eci2lla(at0.position as TemeVec3, g0);
    const lla1 = eci2lla(at1.position as TemeVec3, g1);

    // Ground track passes within 100 m of the launch site (vs OrbitFinder's ~2.8 km tolerance).
    expect(groundDistanceKm(lat, lon, lla0.lat, lla0.lon)).toBeLessThan(0.1);

    // 'N' ascending => latitude increasing; 'S' descending => decreasing.
    if (dir === 'N') {
      expect(lla1.lat).toBeGreaterThan(lla0.lat);
    } else {
      expect(lla1.lat).toBeLessThan(lla0.lat);
    }
  });

  it('returns null when the latitude exceeds the inclination', () => {
    const state = groundTrackStateVector({
      semimajorAxisKm: circular.a,
      eccentricity: 0,
      inclinationRad: (30 * DEG2RAD) as Radians,
      latRad: (45 * DEG2RAD) as Radians, // 45 > 30 => unreachable
      lonRad: 0 as Radians,
      gmstRad: gmst as GreenwichMeanSiderealTime,
      direction: 'N',
    });

    expect(state).toBeNull();
  });
});
