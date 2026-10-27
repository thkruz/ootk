/**
 * ootk v8 regression tests for ContactScheduler (QA deep dive 2026-10-13, report section 2.6;
 * plan section 7: `oneContactPerSatellite` defaults to true, `allowHandover` keeps its meaning).
 * Each test checks a scheduling invariant rather than one pinned value.
 */

import type { Degrees, Kilometers } from '../../types/types';
import { AccessCalculator } from '../../objects/AccessCalculator';
import type { AccessWindow } from '../../objects/AccessWindow';
import type { GroundStation } from '../../objects/GroundStation';
import type { Satellite } from '../../objects/Satellite';
import { ContactScheduler, ContactSelectionStrategy } from '../ContactScheduler';
import type { ScheduledContact } from '../ScheduledContact';

const t0 = new Date('2024-01-01T00:00:00Z').getTime();
const MIN = 60_000;
const stationA = { id: 1, name: 'A' } as unknown as GroundStation;
const stationB = { id: 2, name: 'B' } as unknown as GroundStation;
const stationC = { id: 3, name: 'C' } as unknown as GroundStation;
const sat = (id: number): Satellite => ({ id, name: `S${id}` }) as unknown as Satellite;

function win(station: GroundStation, s: Satellite, startMin: number, endMin: number, maxEl = 45): AccessWindow {
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
    target: s,
  } as unknown as AccessWindow;
}

function mockAccess(windows: AccessWindow[]): void {
  vi.spyOn(AccessCalculator, 'calculateAccess').mockImplementation(
    ((station: GroundStation, s: Satellite) =>
      windows.filter((w) => w.observer === station && w.target === s)) as unknown as typeof AccessCalculator.calculateAccess,
  );
}

const overlaps = (x: ScheduledContact, y: ScheduledContact): boolean =>
  x.scheduledStart < y.scheduledEnd && y.scheduledStart < x.scheduledEnd;

/** Maximum number of contacts active at the same instant at one station. */
function peakConcurrency(schedule: ScheduledContact[], stationId: number): number {
  const ev: [number, number][] = [];

  for (const c of schedule.filter((x) => x.station.id === stationId)) {
    ev.push([c.scheduledStart.getTime(), 1], [c.scheduledEnd.getTime(), -1]);
  }
  ev.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  let active = 0;
  let peak = 0;

  for (const [, d] of ev) {
    active += d;
    peak = Math.max(peak, active);
  }

  return peak;
}

const run = (stations: GroundStation[], sats: Satellite[], options = {}): ScheduledContact[] =>
  ContactScheduler.schedule(stations, sats, new Date(t0), new Date(t0 + 120 * MIN), options);

describe('ContactScheduler v8 invariants', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('one antenna, two satellites visible at once: never two contacts at the same time', () => {
    const s1 = sat(1);
    const s2 = sat(2);

    mockAccess([win(stationA, s1, 0, 20, 70), win(stationA, s2, 10, 30, 60), win(stationA, s2, 40, 50, 30)]);
    const result = run([stationA], [s1, s2]);

    expect(peakConcurrency(result, stationA.id)).toBe(1);
    expect(result.map((c) => c.satellite.id).sort()).toEqual([1, 2]);
  });

  it('satellite priority dominates every strategy quality measure', () => {
    const hi = sat(1);
    const lo = sat(2);

    for (const strategy of Object.values(ContactSelectionStrategy)) {
      vi.restoreAllMocks();
      mockAccess([win(stationA, hi, 50, 52, 5), win(stationA, lo, 0, 100, 89)]);
      const result = run([stationA], [hi, lo], { selectionStrategy: strategy, satellitePriority: (s: Satellite) => (s.id === 1 ? 2 : 1) });

      expect(result.map((c) => c.satellite.id)).toEqual([1]);
    }
  });

  it('station priority only breaks ties', () => {
    const s1 = sat(1);

    mockAccess([win(stationA, s1, 0, 10, 50), win(stationB, s1, 0, 10, 50)]);
    const result = run([stationA, stationB], [s1], { stationPriority: (st: GroundStation) => (st.id === 2 ? 1 : 0) });

    expect(result.map((c) => c.station.id)).toEqual([2]);

    vi.restoreAllMocks();
    mockAccess([win(stationA, s1, 0, 10, 60), win(stationB, s1, 0, 10, 50)]);
    const better = run([stationA, stationB], [s1], { stationPriority: (st: GroundStation) => (st.id === 2 ? 100 : 0) });

    expect(better.map((c) => c.station.id)).toEqual([1]);
  });

  it('peak concurrency never exceeds the limit, and the limit is reached when possible', () => {
    const sats = [sat(1), sat(2), sat(3), sat(4)];

    mockAccess([
      win(stationA, sats[0], 0, 10, 80),
      win(stationA, sats[1], 20, 30, 70),
      win(stationA, sats[2], 5, 25, 60),
      win(stationA, sats[3], 8, 22, 50),
    ]);
    const result = run([stationA], sats, { maxConcurrentPerStation: 2, selectionStrategy: ContactSelectionStrategy.MAX_ELEVATION });

    expect(peakConcurrency(result, stationA.id)).toBe(2);
    // Satellites 1, 2, 3 fit at peak 2; satellite 4 would make 3 simultaneous at t = 8..10
    expect(result.map((c) => c.satellite.id).sort()).toEqual([1, 2, 3]);
  });

  it('oneContactPerSatellite false allows the same satellite at two stations at once', () => {
    const s1 = sat(1);

    mockAccess([win(stationA, s1, 0, 10), win(stationB, s1, 0, 10)]);

    expect(run([stationA, stationB], [s1], { oneContactPerSatellite: false })).toHaveLength(2);
    expect(run([stationA, stationB], [s1])).toHaveLength(1);
  });

  it('handover splits a chain A -> B -> C into back-to-back, non-overlapping contacts', () => {
    const s1 = sat(1);

    mockAccess([win(stationA, s1, 0, 20), win(stationB, s1, 15, 40), win(stationC, s1, 35, 60)]);
    const result = run([stationA, stationB, stationC], [s1], { allowHandover: true });

    expect(result.map((c) => c.station.id)).toEqual([1, 2, 3]);
    for (let i = 0; i < result.length - 1; i++) {
      expect(overlaps(result[i], result[i + 1])).toBe(false);
      expect(result[i].scheduledEnd.getTime()).toBe(result[i + 1].scheduledStart.getTime());
    }
    // Total coverage is the union of the three windows: 0 to 60 min
    expect(result[0].scheduledStart.getTime()).toBe(t0);
    expect(result[2].scheduledEnd.getTime()).toBe(t0 + 60 * MIN);
  });

  it('a trimmed handover piece re-evaluates its max elevation at the edge nearest the original peak', () => {
    const s1 = sat(1);
    const raeCalls: Date[] = [];
    const stationWithRae = {
      id: 10,
      name: 'RAE',
      rae: (_s: Satellite, d: Date) => {
        raeCalls.push(d);

        return { rng: 1234, az: 0, el: 12 };
      },
    } as unknown as GroundStation;

    // Peak of the first window is at 10 min; handover at 17.5 min keeps it, so the second
    // window (peak at 27.5 min, trimmed to start at 17.5) also keeps its own peak.
    mockAccess([win(stationWithRae, s1, 0, 20, 80), win(stationB, s1, 15, 40, 70)]);
    const kept = run([stationWithRae, stationB], [s1], { allowHandover: true });

    expect(kept.map((c) => c.maxElevation)).toEqual([80, 70]);
    expect(raeCalls).toHaveLength(0);

    // Peak at 19.9 min lies beyond the 17.5 min handover: the first piece is evaluated at its end
    vi.restoreAllMocks();
    const late = win(stationWithRae, s1, 0, 20, 80);

    (late as unknown as { maxElevationTime: Date }).maxElevationTime = new Date(t0 + 19.9 * MIN);
    mockAccess([late, win(stationB, s1, 15, 40, 70)]);
    const trimmed = run([stationWithRae, stationB], [s1], { allowHandover: true });

    expect(trimmed[0].maxElevation).toBe(12);
    expect(raeCalls[0].getTime()).toBe(t0 + 17.5 * MIN);
  });

  it('MAX_TOTAL_TIME schedules at least as much time as LONGEST_DURATION, and more when greedy is suboptimal', () => {
    const sats = [sat(1), sat(2), sat(3)];
    const windows = [win(stationA, sats[0], 0, 30), win(stationA, sats[1], 0, 20), win(stationA, sats[2], 20, 45)];
    const total = (r: ScheduledContact[]): number => r.reduce((a, c) => a + c.scheduledDuration, 0);

    mockAccess(windows);
    const greedy = run([stationA], sats, { selectionStrategy: ContactSelectionStrategy.LONGEST_DURATION });
    const best = run([stationA], sats, { selectionStrategy: ContactSelectionStrategy.MAX_TOTAL_TIME });

    expect(total(greedy)).toBe(30 * MIN);
    expect(total(best)).toBe(45 * MIN);
    expect(peakConcurrency(best, stationA.id)).toBe(1);
  });
});
