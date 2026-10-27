/**
 * Permanent regression tests for the ootk v8 fixes to ContactScheduler, from the QA deep dive
 * (hq/reports/ootk-qa-deep-dive-2026-10-13.md, section 2.6 (Conjunction, sensors, scheduling)
 * plus section 1 items 7, 8 and 14).
 *
 * Each test asserts the corrected behavior. Comments keep the report item and the original
 * src file:line of the defect as an audit trail.
 * Moved from test/qa/conjunction-sensor-scheduling.qa.test.ts.
 */

import type { Degrees, Kilometers } from '@src/main';
import { AccessCalculator } from '@src/objects/AccessCalculator';
import type { AccessWindow } from '@src/objects/AccessWindow';
import type { GroundStation } from '@src/objects/GroundStation';
import type { Satellite } from '@src/objects/Satellite';
import { ContactScheduler, ContactSelectionStrategy } from '@src/scheduling/ContactScheduler';

describe('ContactScheduler (QA 2026-10 regressions)', () => {
  const t0 = new Date('2024-01-01T00:00:00Z').getTime();
  const MIN = 60_000;
  const stationA = { id: 1, name: 'Station A' } as unknown as GroundStation;
  const stationB = { id: 2, name: 'Station B' } as unknown as GroundStation;

  function win(station: GroundStation, sat: Satellite, startMin: number, endMin: number, maxEl: number): AccessWindow {
    const start = new Date(t0 + startMin * MIN);
    const end = new Date(t0 + endMin * MIN);

    return {
      start,
      end,
      duration: end.getTime() - start.getTime(),
      maxElevation: maxEl as Degrees,
      maxElevationTime: new Date((start.getTime() + end.getTime()) / 2),
      rangeAtMaxEl: 1000 as Kilometers,
      observer: station,
      target: sat,
    } as unknown as AccessWindow;
  }

  function mockAccess(windows: AccessWindow[]): void {
    vi.spyOn(AccessCalculator, 'calculateAccess').mockImplementation(
      ((station: GroundStation, sat: Satellite) =>
        windows.filter((w) => w.observer === station && w.target === sat)) as unknown as typeof AccessCalculator.calculateAccess,
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /*
   * Report section 2.6, ContactScheduler.ts:694-723. score = priority * 1000 + quality. With
   * LONGEST_DURATION, a 1200 s low-priority (1) contact scores 2200 and beats a 120 s
   * high-priority (2) contact scoring 2120. Expected: the priority-2 satellite gets the station.
   */
  it('satellite priority outranks quality even when a contact exceeds 1000 s', () => {
    const hi = { id: 101, name: 'HI' } as unknown as Satellite;
    const lo = { id: 102, name: 'LO' } as unknown as Satellite;

    mockAccess([win(stationA, hi, 5, 7, 45), win(stationA, lo, 0, 20, 45)]);

    const result = ContactScheduler.schedule([stationA], [hi, lo], new Date(t0), new Date(t0 + 60 * MIN), {
      selectionStrategy: ContactSelectionStrategy.LONGEST_DURATION,
      satellitePriority: (s) => (s.id === 101 ? 2 : 1),
    });

    expect(result.map((c) => c.satellite.id)).toContain(101);
  });

  /*
   * Report section 2.6 (likely), ContactScheduler.ts:730-744. The concurrency check counts every
   * overlapping contact, not peak simultaneous use. Limit 2, A [0,10], B [20,30], C [5,25] min:
   * at most 2 are ever simultaneous, so all 3 fit. Code blocks C (3 expected, 2 scheduled).
   */
  it('concurrency limit 2 admits C [5,25] alongside A [0,10] and B [20,30]', () => {
    const a = { id: 201, name: 'A' } as unknown as Satellite;
    const b = { id: 202, name: 'B' } as unknown as Satellite;
    const c = { id: 203, name: 'C' } as unknown as Satellite;

    mockAccess([win(stationA, a, 0, 10, 80), win(stationA, b, 20, 30, 70), win(stationA, c, 5, 25, 60)]);

    const result = ContactScheduler.schedule([stationA], [a, b, c], new Date(t0), new Date(t0 + 60 * MIN), {
      selectionStrategy: ContactSelectionStrategy.MAX_ELEVATION,
      maxConcurrentPerStation: 2,
    });

    expect(result.map((x) => x.satellite.id).sort()).toEqual([201, 202, 203]);
  });

  /*
   * Report section 2.6 (likely), ContactScheduler.ts:647-680. With allowHandover = false nothing
   * stops one satellite being scheduled at two stations over the same interval, double-counting
   * coverage. Expected: no two contacts for the same satellite overlap in time; code schedules both.
   */
  it('one satellite is not scheduled at two stations simultaneously with allowHandover false', () => {
    const sat = { id: 301, name: 'SAT' } as unknown as Satellite;

    mockAccess([win(stationA, sat, 0, 10, 60), win(stationB, sat, 0, 10, 50)]);

    const result = ContactScheduler.schedule([stationA, stationB], [sat], new Date(t0), new Date(t0 + 60 * MIN), {
      allowHandover: false,
    });

    let overlaps = 0;

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const x = result[i];
        const y = result[j];

        if (x.scheduledStart < y.scheduledEnd && y.scheduledStart < x.scheduledEnd) {
          overlaps++;
        }
      }
    }

    expect(overlaps).toBe(0);
  });
});
