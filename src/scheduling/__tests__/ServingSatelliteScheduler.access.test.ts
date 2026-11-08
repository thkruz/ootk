import { describe, expect, it } from 'vitest';
import { ConstellationGenerator } from '../../constellation/ConstellationGenerator';
import { AccessCalculator } from '../../objects/AccessCalculator';
import { GroundStation } from '../../objects/GroundStation';
import type { Degrees, Kilometers } from '../../types/types';
import { PositionSource } from '../PositionSource';
import { ServingSatelliteScheduler } from '../ServingSatelliteScheduler';

const t0 = new Date('2026-03-01T00:00:00Z');
const hours = 3;
const t1 = new Date(t0.getTime() + hours * 3600 * 1000);
const site = new GroundStation({ id: 5, name: 'X', lat: 38.9 as Degrees, lon: -77 as Degrees, alt: 0.1 as Kilometers });
const sats = ConstellationGenerator.walker(1200 as Kilometers, 55 as Degrees, 24, 6, 1, t0);
const MIN_EL = 15 as Degrees;
const STEP_SEC = 1;

// Independent reference: AccessCalculator per satellite (bisected edges, 1 ms), same constraints.
const windows = sats.map((s) => AccessCalculator.calculateAccess(site, s, t0, t1, { minElevation: MIN_EL }, 2000));
// Walker satellites all share sccNum 1, so ids are given explicitly as indices.
const ids = sats.map((_, i) => i);
const byId = new Map(ids.map((id) => [id, windows[id]]));

function unionSeconds(): { total: number; components: number } {
  const iv = windows
    .flat()
    .map((w) => [w.start.getTime(), w.end.getTime()] as const)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let components = 0;
  let curEnd = -Infinity;
  let curStart = 0;

  for (const [s, e] of iv) {
    if (s > curEnd) {
      if (curEnd > -Infinity) {
        total += curEnd - curStart;
      }
      curStart = s;
      curEnd = e;
      components++;
    } else {
      curEnd = Math.max(curEnd, e);
    }
  }
  if (curEnd > -Infinity) {
    total += curEnd - curStart;
  }

  return { total: total / 1000, components };
}

describe('ServingSatelliteScheduler vs AccessCalculator', () => {
  const schedule = ServingSatelliteScheduler.schedule({
    terminal: site,
    positions: PositionSource.fromSatellites(sats, ids),
    start: t0,
    end: t1,
    minElevation: MIN_EL,
    sampleStepSec: STEP_SEC,
  });

  it('has real service and real handovers in the test geometry', () => {
    expect(schedule.segments.length).toBeGreaterThan(3);
    expect(schedule.stats.servedFraction).toBeGreaterThan(0.2);
  });

  it('every served instant lies inside an access window of the serving satellite', () => {
    let checked = 0;

    for (const seg of schedule.segments) {
      const wins = byId.get(seg.satId)!;
      const a = seg.start.getTime();
      const b = seg.end.getTime();

      for (let t = a; t < b; t += 5000) {
        // one sample step of slack at each window edge (edges are detected on the sample grid)
        const ok = wins.some((w) => t >= w.start.getTime() - STEP_SEC * 1000 && t <= w.end.getTime() + STEP_SEC * 1000);

        expect(ok, `sat ${seg.satId} at +${(t - t0.getTime()) / 1000}s`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('continuous HIGHEST_ELEVATION serves exactly the union of access windows (within one step per edge)', () => {
    const { total, components } = unionSeconds();
    const served = schedule.stats.servedFraction * hours * 3600;

    // Each union component has two edges, each resolved to one sample step.
    expect(Math.abs(served - total)).toBeLessThanOrEqual(components * 2 * STEP_SEC);
    expect(components).toBeGreaterThan(2);
  });
});
