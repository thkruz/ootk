import { describe, expect, it } from 'vitest';
import { iau1980 } from '../iau1980';
import { leapSecondData } from '../LeapSecondData';

const jdOf = (iso: string) => Date.parse(iso) / 86400000 + 2440587.5;

describe('IAU 1980 nutation table', () => {
  it('has all 106 terms of the series', () => {
    expect(iau1980).toHaveLength(106);
  });

  it('carries the published leading terms (Seidelmann 1982, Vallado Table D-6, units 0.0001")', () => {
    // Om term: -17.1996" - 0.01742" T in longitude, 9.2025" + 0.00089" T in obliquity.
    expect(iau1980).toContainEqual([0, 0, 0, 0, 1, -171996, -174.2, 92025, 8.9]);
    // Annual term (l'): 0.1426" - 0.00034" T.
    expect(iau1980).toContainEqual([0, 1, 0, 0, 0, 1426, -3.4, 54, -0.1]);
    // Monthly term (l): 0.0712" + 0.00001" T.
    expect(iau1980).toContainEqual([1, 0, 0, 0, 0, 712, 0.1, -7, 0]);
  });

  it('has no duplicated argument multipliers', () => {
    const keys = new Set(iau1980.map((row) => row.slice(0, 5).join(',')));

    expect(keys.size).toBe(106);
  });
});

describe('LeapSecondData TAI-scale lookup', () => {
  // IERS Bulletin C 52 / USNO tai-utc.dat: TAI - UTC = 36 s until 2016-12-31T23:59:60 UTC,
  // 37 s from 2017-01-01T00:00:00 UTC. On the TAI scale the step is at 2017-01-01T00:00:37 TAI.
  const step = jdOf('2017-01-01T00:00:00Z');

  it('UTC-scale lookup steps at 2017-01-01T00:00:00 UTC', () => {
    expect(leapSecondData.getLeapSeconds(step - 1 / 86400)).toBe(36);
    expect(leapSecondData.getLeapSeconds(step)).toBe(37);
  });

  it('TAI-scale lookup steps at 2017-01-01T00:00:37 TAI, not at 00:00:00', () => {
    expect(leapSecondData.getLeapSecondsFromTai(step + 20 / 86400)).toBe(36);
    expect(leapSecondData.getLeapSecondsFromTai(step + 36.5 / 86400)).toBe(36);
    expect(leapSecondData.getLeapSecondsFromTai(step + 37 / 86400)).toBe(37);
  });

  it('agrees with the UTC-scale lookup away from steps', () => {
    for (const iso of ['1980-01-06T00:00:00Z', '1999-01-01T00:00:00Z', '2012-06-30T12:00:00Z', '2026-10-13T00:00:00Z']) {
      const jdUtc = jdOf(iso);
      const ls = leapSecondData.getLeapSeconds(jdUtc);

      expect(leapSecondData.getLeapSecondsFromTai(jdUtc + ls / 86400)).toBe(ls);
    }
  });
});
