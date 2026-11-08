import {
  AccessCalculator,
  AccessConstraints,
  AccessWindow,
  Degrees,
  ecef2rae,
  GroundStation,
  HorizonProfile,
  Kilometers,
  Satellite,
  TleLine1,
  TleLine2,
} from '../../main';

const iss = new Satellite({
  tle1: '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1,
  tle2: '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2,
});
const site = new GroundStation({
  id: 8101,
  name: 'Horizon Test',
  lat: 38.9 as Degrees,
  lon: -77.0 as Degrees,
  alt: 0.1 as Kilometers,
});
const t0 = new Date('2022-07-22T12:00:00Z');
const t1 = new Date(t0.getTime() + 24 * 3600 * 1000);

const raeAt = (ms: number) => ecef2rae(site.llaAt(new Date(ms))!, iss.ecef(new Date(ms))!);
const windowsWith = (c: AccessConstraints) => AccessCalculator.calculateAccess(site, iss, t0, t1, c);

describe('AccessCalculator with a horizon profile', () => {
  const base = windowsWith({});

  it('has baseline passes to work with', () => {
    expect(base.length).toBeGreaterThan(3);
  });

  it('constant(10) gives windows identical to minElevation: 10 (same ms)', () => {
    const a = windowsWith({ minElevation: 10 as Degrees });
    const b = windowsWith({ horizon: HorizonProfile.constant(10) });

    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBe(a.length);
    a.forEach((w, i) => {
      expect(b[i].start.getTime()).toBe(w.start.getTime());
      expect(b[i].end.getTime()).toBe(w.end.getTime());
    });
  });

  it('uses max(minElevation, horizon)', () => {
    const a = windowsWith({ minElevation: 15 as Degrees });
    const b = windowsWith({ minElevation: 15 as Degrees, horizon: HorizonProfile.constant(10) });
    const c = windowsWith({ minElevation: 5 as Degrees, horizon: HorizonProfile.constant(15) });

    expect(b.map((w) => w.start.getTime())).toEqual(a.map((w) => w.start.getTime()));
    expect(c.map((w) => w.end.getTime())).toEqual(a.map((w) => w.end.getTime()));
  });

  /** Rise or set azimuth of a baseline window (1 s inside the edge). */
  const azAt = (w: AccessWindow, rise: boolean) => raeAt(rise ? w.start.getTime() + 1000 : w.end.getTime() - 1000).az;
  const sector = (center: number) => HorizonProfile.fromElevationMasks(
    [{ startAz: ((center - 12 + 360) % 360) as Degrees, stopAz: ((center + 12) % 360) as Degrees, minEl: 25 as Degrees }],
    false,
    0,
  );

  it('a raised sector delays rise only for passes that rise in it, and advances set only for passes that set in it', () => {
    const w0 = base.find((w) => w.start.getTime() > t0.getTime() && w.end.getTime() < t1.getTime())!;
    const riseProfile = sector(azAt(w0, true));
    const clipped = windowsWith({ horizon: riseProfile });

    // Every baseline pass whose sampled track never goes below the horizon is unchanged to the ms
    let unchanged = 0;

    base.forEach((w) => {
      let violated = false;

      for (let ms = w.start.getTime(); ms <= w.end.getTime(); ms += 1000) {
        const r = raeAt(ms);

        if (r.el < riseProfile.elevationAt(r.az) - 1e-9) {
          violated = true;
          break;
        }
      }
      if (!violated) {
        const match = clipped.filter((c) => c.start.getTime() < w.end.getTime() && c.end.getTime() > w.start.getTime());

        expect(match).toHaveLength(1);
        expect(match[0].start.getTime()).toBe(w.start.getTime());
        expect(match[0].end.getTime()).toBe(w.end.getTime());
        unchanged++;
      }
    });
    expect(unchanged).toBeGreaterThan(0);

    // The pass that rises in the sector starts later and ends where it did
    const c0 = clipped.find((c) => c.end.getTime() > w0.start.getTime())!;

    expect(c0.start.getTime()).toBeGreaterThan(w0.start.getTime());
    expect(c0.end.getTime()).toBe(w0.end.getTime());

    // A sector at the set azimuth advances the set and leaves the rise unchanged
    const setClipped = windowsWith({ horizon: sector(azAt(w0, false)) });
    const s0 = setClipped.find((c) => c.end.getTime() > w0.start.getTime())!;

    expect(s0.end.getTime()).toBeLessThan(w0.end.getTime());
    expect(s0.start.getTime()).toBe(w0.start.getTime());
  });

  it('rise and set instants satisfy el == horizon.elevationAt(az) within 1 ms resolution', () => {
    const horizon = HorizonProfile.fromPoints([{ az: 0, el: 5 }, { az: 90, el: 25 }, { az: 180, el: 8 }, { az: 270, el: 12 }]);
    const windows = windowsWith({ horizon });
    let checked = 0;

    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      const s = w.start.getTime();
      const e = w.end.getTime();

      if (s > t0.getTime()) {
        const before = raeAt(s - 1);
        const after = raeAt(s + 1);

        expect(before.el).toBeLessThan(horizon.elevationAt(before.az) + 1e-6);
        expect(after.el).toBeGreaterThanOrEqual(horizon.elevationAt(after.az) - 1e-6);
        // ISS elevation rate is well under 1 deg/s, so a 1 ms bracket bounds the miss to 1e-3 deg
        expect(Math.abs(raeAt(s).el - horizon.elevationAt(raeAt(s).az))).toBeLessThan(2e-3);
        checked++;
      }
      if (e < t1.getTime()) {
        const before = raeAt(e - 1);
        const after = raeAt(e + 1);

        expect(before.el).toBeGreaterThanOrEqual(horizon.elevationAt(before.az) - 1e-6);
        expect(after.el).toBeLessThan(horizon.elevationAt(after.az) + 1e-6);
        expect(Math.abs(raeAt(e).el - horizon.elevationAt(raeAt(e).az))).toBeLessThan(2e-3);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(4);
  });
});
