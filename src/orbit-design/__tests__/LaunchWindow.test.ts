import { rv2tle } from '../../orbit-determination/Rv2Tle';
import { Satellite } from '../../objects/Satellite';
import { calcGmst } from '../../transforms';
import { Degrees, GreenwichMeanSiderealTime, Radians, TleLine1, TleLine2 } from '../../types/types';
import { DEG2RAD, RAD2DEG } from '../../utils/constants';
import { groundTrackStateVector, semimajorAxisFromMeanMotion } from '../GroundTrackStateVector';
import { LaunchWindowFinder } from '../LaunchWindow';

// Standard ISS TLE — inclination 51.6415, RAAN 161.8339 at epoch 22203.46960946.
const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

// Kennedy Space Center
const KSC_LAT = 28.608 as Degrees;
const KSC_LON = -80.604 as Degrees;

const baseOptions = {
  siteLat: KSC_LAT,
  siteLon: KSC_LON,
  inclination: 51.6415 as Degrees,
  direction: 'N' as const,
  startTime: new Date('2022-07-22T00:00:00Z'),
};

const norm180 = (deg: number): number => {
  const n = ((deg % 360) + 360) % 360;

  return n >= 180 ? n - 360 : n;
};

describe('LaunchWindowFinder geometry', () => {
  it('rejects inclinations below the site latitude', () => {
    const finder = new LaunchWindowFinder({ ...baseOptions, inclination: 20 as Degrees, targetRaan: 0 as Degrees });

    expect(finder.isGeometryPossible()).toBe(false);
    expect(finder.findBestLaunchTime()).toBeNull();
  });

  it('accepts retrograde inclinations that still reach the site latitude', () => {
    const finder = new LaunchWindowFinder({ ...baseOptions, inclination: 97.5 as Degrees, targetRaan: 0 as Degrees });

    expect(finder.isGeometryPossible()).toBe(true);
  });

  it('achievable RAAN advances with Earth rotation (~15°/hr eastward sweep)', () => {
    const finder = new LaunchWindowFinder({ ...baseOptions, targetRaan: 0 as Degrees });
    const t0 = new Date('2022-07-22T00:00:00Z');
    const t1 = new Date('2022-07-22T01:00:00Z');
    const delta = norm180(finder.achievableRaan(t1) - finder.achievableRaan(t0));

    expect(delta).toBeGreaterThan(14.9);
    expect(delta).toBeLessThan(15.2);
  });

  it('north and south legs reach different planes at the same instant', () => {
    const north = new LaunchWindowFinder({ ...baseOptions, direction: 'N', targetRaan: 0 as Degrees });
    const south = new LaunchWindowFinder({ ...baseOptions, direction: 'S', targetRaan: 0 as Degrees });
    const t = new Date('2022-07-22T00:00:00Z');

    expect(Math.abs(norm180(north.achievableRaan(t) - south.achievableRaan(t)))).toBeGreaterThan(1);
  });
});

describe('LaunchWindowFinder vs ground-track state vector (physical cross-check)', () => {
  it('matches the RAAN of an orbit placed over the site at the launch time', () => {
    const sat = new Satellite({ tle1, tle2 });
    const t = new Date('2022-07-22T12:00:00Z');

    // Independently build an orbit passing over the site at t and read back its RAAN.
    const state = groundTrackStateVector({
      semimajorAxisKm: semimajorAxisFromMeanMotion(sat.meanMotion),
      eccentricity: sat.eccentricity,
      inclinationRad: (sat.inclination * DEG2RAD) as Radians,
      latRad: (KSC_LAT * DEG2RAD) as Radians,
      lonRad: (KSC_LON * DEG2RAD) as Radians,
      gmstRad: calcGmst(t).gmst as GreenwichMeanSiderealTime,
      direction: 'N',
    })!;
    const fit = rv2tle(t, state.position, state.velocity, { maxIterations: 30, toleranceKm: 1e-4 })!;

    // RAAN lives in TLE line 2, columns 18-25.
    const placedOrbitRaan = parseFloat(fit.tle2.substring(17, 25));
    const finder = new LaunchWindowFinder({ ...baseOptions, targetRaan: 0 as Degrees });
    const closedFormRaan = finder.achievableRaan(t);

    // LaunchWindowFinder works in geocentric latitude while the placed orbit
    // matches the geodetic subpoint, so allow a degree of slack.
    expect(Math.abs(norm180(closedFormRaan - placedOrbitRaan))).toBeLessThan(1);
  });
});

describe('LaunchWindowFinder search', () => {
  it('recovers a known launch time from its own achievable RAAN', () => {
    const probe = new LaunchWindowFinder({ ...baseOptions, targetRaan: 0 as Degrees });
    const knownTime = new Date('2022-07-22T09:37:21Z');
    const targetRaan = probe.achievableRaan(knownTime);

    const finder = new LaunchWindowFinder({ ...baseOptions, targetRaan });
    const window = finder.findBestLaunchTime();

    expect(window).not.toBeNull();
    expect(Math.abs(window!.time.getTime() - knownTime.getTime())).toBeLessThanOrEqual(2000);
    expect(Math.abs(window!.raanError)).toBeLessThan(0.02);
  });

  it('accounts for target nodal drift when targetRaan is a function', () => {
    const sat = new Satellite({ tle1, tle2 });
    const finder = new LaunchWindowFinder({
      ...baseOptions,
      targetRaan: (time: Date) => LaunchWindowFinder.meanRaanAt(sat.satrec, time),
    });
    const window = finder.findBestLaunchTime();

    expect(window).not.toBeNull();
    expect(Math.abs(window!.raanError)).toBeLessThan(0.02);
    // The matched plane must agree with the drifted target plane at that time.
    expect(Math.abs(norm180(window!.achievableRaan - LaunchWindowFinder.meanRaanAt(sat.satrec, window!.time)))).toBeLessThan(0.02);
  });
});

describe('LaunchWindowFinder.meanRaanAt', () => {
  it('returns the epoch RAAN at the TLE epoch and drifts westward for prograde LEO', () => {
    const sat = new Satellite({ tle1, tle2 });
    // TLE epoch 22203.46960946 => 2022, day 203.46960946
    const epoch = new Date(Date.UTC(2022, 0, 1) + (203.46960946 - 1) * 86400 * 1000);
    const atEpoch = LaunchWindowFinder.meanRaanAt(sat.satrec, epoch);

    expect(Math.abs(norm180(atEpoch - 161.8339))).toBeLessThan(0.01);

    const oneDayLater = LaunchWindowFinder.meanRaanAt(sat.satrec, new Date(epoch.getTime() + 86400 * 1000));
    const driftPerDay = norm180(oneDayLater - atEpoch);

    // ISS nodal regression is roughly -5°/day.
    expect(driftPerDay).toBeLessThan(-4);
    expect(driftPerDay).toBeGreaterThan(-6);
    expect(driftPerDay).toBeCloseTo(sat.satrec.nodedot * 1440 * RAD2DEG, 1);
  });
});
