/**
 * Permanent regression tests for the v8 fixes from the 2026-10-13 deep-dive audit, section 2.1
 * (time). Report: hq/reports/ootk-qa-deep-dive-2026-10-13.md
 *
 * Moved from test/qa/time-transforms-body.qa.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { EpochUTC } from '@src/main';

/** Returns NaN instead of throwing so a thrown defect still reads as an assertion failure. */
const safe = (fn: () => number): number => {
  try {
    return fn();
  } catch {
    return Number.NaN;
  }
};

describe('EpochUTC / EpochGPS (QA 2026-10 regressions)', () => {
  // Report 2.1. src/time/EpochUTC.ts:130-134 fromDateTimeString appends Z to strings with an offset.
  // Expected: '2024-06-15T12:00:00+02:00' is 10:00Z (posix 1718445600). Actual: NaN, constructor throws.
  it('EpochUTC.fromDateTimeString honors an explicit +02:00 offset', () => {
    const posix = safe(() => EpochUTC.fromDateTimeString('2024-06-15T12:00:00+02:00').posix);

    expect(posix).toBe(Date.parse('2024-06-15T10:00:00Z') / 1000);
  });

  // Report 2.1 (likely). src/time/EpochGPS.ts:134-140 leap seconds are looked up at the GPS instant
  // treated as UTC. UTC 2016-12-31T23:59:50 (ls 36) -> GPS -> UTC should round-trip exactly.
  // Actual: the GPS instant reads as 2017-01-01T00:00:07 (ls 37), so UTC comes back 1 s early.
  it('EpochUTC -> EpochGPS -> EpochUTC round-trips exactly across the 2017-01-01 leap second', () => {
    const utc = EpochUTC.fromDateTime(new Date('2016-12-31T23:59:50Z'));
    const back = utc.toGPS().toUTC();

    expect(back.posix - utc.posix).toBeCloseTo(0, 3);
  });

  // Report 2.1 (likely). src/time/EpochUTC.ts:136-141 fromJ2000TTSeconds looks up leap seconds at the
  // TT instant treated as UTC. UTC 2016-12-31T23:59:00 -> TT is 69 s later, past the leap boundary.
  // Expected: round trip closes. Actual: 1 s early.
  it('EpochUTC.fromJ2000TTSeconds inverts toTT() within 69 s before a leap second', () => {
    const utc = EpochUTC.fromDateTime(new Date('2016-12-31T23:59:00Z'));
    const ttJ2000Seconds = utc.toTT().posix - 946728000;
    const back = EpochUTC.fromJ2000TTSeconds(ttJ2000Seconds as never);

    expect(back.posix - utc.posix).toBeCloseTo(0, 3);
  });
});
