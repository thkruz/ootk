import { describe, expect, it } from 'vitest';
import { ConstellationGenerator } from '../../constellation/ConstellationGenerator';
import { GroundStation } from '../../objects/GroundStation';
import type { Degrees, Kilometers } from '../../types/types';
import { PositionSource } from '../PositionSource';
import { ServingSatelliteScheduler } from '../ServingSatelliteScheduler';

const t0 = new Date('2026-03-01T00:00:00Z');
const site = new GroundStation({ id: 5, name: 'X', lat: 38.9 as Degrees, lon: -77 as Degrees, alt: 0.1 as Kilometers });

describe('ServingSatelliteScheduler timing', () => {
  it('smoke: 200 satellites over 20 minutes runs and logs its time (no timing assertion)', () => {
    const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 200, 20, 1, t0);
    const started = performance.now();
    const r = ServingSatelliteScheduler.schedule({
      terminal: site,
      positions: PositionSource.fromSatellites(sats, sats.map((_, i) => i)),
      start: t0,
      end: new Date(t0.getTime() + 20 * 60 * 1000),
      reassignmentIntervalSec: 15,
      reassignmentPhaseSec: 12,
      minElevation: 25,
    });
    const ms = performance.now() - started;

    console.info(`[serving-scheduler smoke] 200 sats, 20 min, 15 s ticks: ${ms.toFixed(0)} ms, ${r.segments.length} segments`);
    expect(r.segments.length + r.gaps.length).toBeGreaterThan(0);
  });

  // Run with OOTK_BENCH=1. 5,000-satellite Walker shell, 6 h, 15 s reassignment ticks.
  // eslint-disable-next-line no-process-env
  it.skipIf(!process.env.OOTK_BENCH)('benchmark: 5000 sats, 6 h, 15 s ticks', () => {
    const sats = ConstellationGenerator.walker(550 as Kilometers, 53 as Degrees, 5000, 50, 1, t0);
    const started = performance.now();
    const r = ServingSatelliteScheduler.schedule({
      terminal: site,
      positions: PositionSource.fromSatellites(sats, sats.map((_, i) => i)),
      start: t0,
      end: new Date(t0.getTime() + 6 * 3600 * 1000),
      reassignmentIntervalSec: 15,
      reassignmentPhaseSec: 12,
      minElevation: 25,
    });
    const s = (performance.now() - started) / 1000;

    console.info(`[serving-scheduler bench] 5000 sats, 6 h, 15 s ticks: ${s.toFixed(1)} s, ${r.segments.length} segments, served ${(100 * r.stats.servedFraction).toFixed(1)} %`);
    expect(r.segments.length).toBeGreaterThan(0);
  });
});
