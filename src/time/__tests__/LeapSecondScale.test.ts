import { describe, expect, it } from 'vitest';
import { EpochUTC, Seconds } from '../../main';

const J2000_POSIX = 946728000;

describe('Leap seconds are looked up on the right time scale', () => {
  // Sweep across the 2016-12-31T23:59:60 leap second (IERS Bulletin C 52) at 1 s steps.
  const start = Date.parse('2016-12-31T23:58:00Z') / 1000;
  const posixes = Array.from({ length: 300 }, (_, i) => start + i);

  it('UTC -> GPS -> UTC round-trips every second across the 2017 leap second', () => {
    for (const p of posixes) {
      const utc = new EpochUTC(p as Seconds);

      expect(utc.toGPS().toUTC().posix - p).toBeCloseTo(0, 6);
    }
  });

  it('UTC -> TT -> UTC (fromJ2000TTSeconds) round-trips every second across the 2017 leap second', () => {
    for (const p of posixes) {
      const utc = new EpochUTC(p as Seconds);
      const back = EpochUTC.fromJ2000TTSeconds((utc.toTT().posix - J2000_POSIX) as Seconds);

      expect(back.posix - p).toBeCloseTo(0, 6);
    }
  });

  it('GPS - UTC is 17 s before and 18 s after 2017-01-01 (USNO GPS-UTC table)', () => {
    // GPS week 1930 starts at 2017-01-01T00:00:00 GPS. UTC 23:59:59 + 17 s is GPS 00:00:16;
    // UTC 00:00:00 + 18 s is GPS 00:00:18 (the leap second 23:59:60 UTC is GPS 00:00:17).
    const before = EpochUTC.fromDateTimeString('2016-12-31T23:59:59Z').toGPS();
    const after = EpochUTC.fromDateTimeString('2017-01-01T00:00:00Z').toGPS();

    expect(before.week).toBe(1930);
    expect(before.seconds).toBeCloseTo(16, 6);
    expect(after.week).toBe(1930);
    expect(after.seconds).toBeCloseTo(18, 6);
  });

  // Float64 posix seconds near 1.48e9 resolve to about 2.4e-7 s, so compare to 1e-6 s.
  it('TT - UTC is 69.184 s after 2017-01-01 and 68.184 s before', () => {
    const before = EpochUTC.fromDateTimeString('2016-12-31T23:59:59Z');
    const after = EpochUTC.fromDateTimeString('2017-01-01T00:00:00Z');

    expect(before.toTT().posix - before.posix).toBeCloseTo(68.184, 6);
    expect(after.toTT().posix - after.posix).toBeCloseTo(69.184, 6);
  });
});

describe('EpochUTC.fromDateTimeString zone handling', () => {
  const ref = Date.parse('2024-06-15T10:00:00Z') / 1000;

  it.each([
    ['2024-06-15T10:00:00Z'],
    ['2024-06-15T10:00:00'],
    ['2024-06-15T12:00:00+02:00'],
    ['2024-06-15T05:00:00-05:00'],
    ['2024-06-15T15:30:00+0530'],
    ['  2024-06-15T10:00:00.000Z  '],
  ])('%s is 2024-06-15T10:00:00Z', (s) => {
    expect(EpochUTC.fromDateTimeString(s).posix).toBe(ref);
  });
});
