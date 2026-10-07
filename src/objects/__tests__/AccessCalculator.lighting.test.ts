import {
  AccessCalculator,
  Degrees,
  GroundStation,
  Kilometers,
  Satellite,
  Sun,
  SunStatus,
  TleLine1,
  TleLine2,
} from '../../main';

/**
 * Lighting constraints checked against independent references: the Sun's elevation at the
 * site from astronomy-engine (Sun.getAzEl), and lightingRatio with satellite and Sun both in
 * J2000.
 */
describe('AccessCalculator lighting constraints', () => {
  const iss = new Satellite({
    tle1: '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1,
    tle2: '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2,
  });
  const site = new GroundStation({ lat: 40 as Degrees, lon: -75 as Degrees, alt: 0.1 as Kilometers });
  const start = new Date('2022-07-22T12:00:00Z');
  const end = new Date('2022-07-24T12:00:00Z');

  it('requireObserverDark keeps exactly the passes with the Sun below -6 deg', () => {
    // It returned no windows at all: Sun.getTimes moved the Date to local noon
    const all = AccessCalculator.calculateAccess(site, iss, start, end);
    const dark = AccessCalculator.calculateAccess(site, iss, start, end, { requireObserverDark: true });
    const sunEl = (d: Date) => Sun.getAzEl(site, d, false).el;

    expect(dark.length).toBeGreaterThan(0);
    for (const w of dark) {
      const mid = new Date((w.start.getTime() + w.end.getTime()) / 2);

      expect(sunEl(mid)).toBeLessThan(-6);
    }
    // Every pass that is dark throughout appears among the dark windows
    const fullyDark = all.filter((w) => sunEl(w.start) < -6 && sunEl(w.end) < -6);

    for (const w of fullyDark) {
      expect(dark.some((d) => d.start.getTime() <= w.end.getTime() && d.end.getTime() >= w.start.getTime())).toBe(true);
    }
  });

  it('does not modify the caller-visible time while checking darkness', () => {
    const d = new Date('2022-07-23T05:00:00Z');

    AccessCalculator.calculateAccess(site, iss, d, new Date(d.getTime() + 600e3), { requireObserverDark: true });
    expect(d.toISOString()).toBe('2022-07-23T05:00:00.000Z');
  });

  it('Satellite.getSunStatus uses the J2000 satellite position with the J2000 Sun', () => {
    let mismatches = 0;

    for (let ms = start.getTime(); ms < start.getTime() + 6 * 3600e3; ms += 1e3) {
      const d = new Date(ms);
      const ratio = Sun.lightingRatio(iss.toJ2000(d).position, Sun.eci(d));
      let expected = SunStatus.SUN;

      if (ratio === 0) {
        expected = SunStatus.UMBRAL;
      } else if (ratio < 1) {
        expected = SunStatus.PENUMBRAL;
      }

      if (iss.getSunStatus(d) !== expected) {
        mismatches++;
      }
    }
    // Was 1-5 s early/late at every transition with the TEME position
    expect(mismatches).toBe(0);
  });
});
