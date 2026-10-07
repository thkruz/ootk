import { Tle, TleLine1 } from '../../main';

describe('Tle.calcElsetAge', () => {
  it('Tle.calcElsetAge counts real elapsed days across leap days', () => {
    const line1 = '1 25544U 98067A   24001.00000000  .00016717  00000-0  10270-3 0  9002' as TleLine1;
    const endOfLeapYear = '1 25544U 98067A   24366.50000000  .00016717  00000-0  10270-3 0  9002' as TleLine1;

    // 2024 is a leap year: 366 days, not 365
    expect(Tle.calcElsetAge(line1, new Date('2025-01-01T00:00:00Z'))).toBeCloseTo(366, 9);
    // 2024-12-31T12:00 to 2025-01-01T12:00 is one day (was 0)
    expect(Tle.calcElsetAge(endOfLeapYear, new Date('2025-01-01T12:00:00Z'))).toBeCloseTo(1, 9);
    expect(Tle.calcElsetAge(line1, new Date('2024-01-01T06:00:00Z'), 'hours')).toBeCloseTo(6, 9);
  });
});
