import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../errors';
import { GroundStation } from '../../objects/GroundStation';
import type { Degrees, Kilometers } from '../../types/types';
import type { PositionSource } from '../PositionSource';
import { ServingSatelliteScheduler, ServingStrategy } from '../ServingSatelliteScheduler';

const T0 = new Date('2026-01-01T00:00:00Z');
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const terminal = new GroundStation({ id: 1, name: 'T', lat: 38.9 as Degrees, lon: -77.0 as Degrees, alt: 0.1 as Kilometers });

function placeEcf(az: number, el: number, rng: number): [number, number, number] {
  const g = terminal.ecef();
  const lat = (terminal.lat * Math.PI) / 180;
  const lon = (terminal.lon * Math.PI) / 180;
  const E = [-Math.sin(lon), Math.cos(lon), 0];
  const N = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)];
  const U = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  const d = [0, 1, 2].map((i) => rng * (Math.sin(a) * Math.cos(e) * E[i] + Math.cos(a) * Math.cos(e) * N[i] + Math.sin(e) * U[i]));

  return [g.x + d[0], g.y + d[1], g.z + d[2]];
}

/** Elevation (deg) per satellite id as a function of seconds since T0, azimuth/range fixed. */
function source(
  els: Record<number, (sec: number, viaSubset: boolean) => number>,
): PositionSource {
  const ids = Object.keys(els).map(Number);
  const write = (date: Date, i: number, out: Float64Array, o: number, viaSubset: boolean) => {
    const sec = (date.getTime() - T0.getTime()) / 1000;
    const [x, y, z] = placeEcf(90 + 40 * i, els[ids[i]](sec, viaSubset), 1500);

    out[o] = x;
    out[o + 1] = y;
    out[o + 2] = z;
  };

  return {
    ids,
    positionsEcf(date, out) {
      ids.forEach((_, i) => write(date, i, out, 3 * i, false));
    },
    positionsEcfSubset(date, indices, out) {
      for (let k = 0; k < indices.length; k++) {
        write(date, indices[k], out, 3 * k, true);
      }
    },
  };
}

describe('ServingSatelliteScheduler fixes', () => {
  it('samples on a global grid anchored at start (step 10, interval 15)', () => {
    // Sat 1 is usable until 18 s (minElevation 10), then drops to 5 deg. Grid samples are
    // 0, 10, 15 (tick), 20, so the loss is seen at 20 s. A grid restarting at the 15 s tick would
    // sample 25 s and report 25.
    const positions = source({ 1: (s) => (s < 18 ? 40 : 5), 2: () => 30 });
    const sch = ServingSatelliteScheduler.schedule({
      terminal, positions, start: at(0), end: at(60), reassignmentIntervalSec: 15, sampleStepSec: 10, minElevation: 10,
    });

    expect(sch.segments[0].satId).toBe(1);
    expect(sch.segments[0].end.getTime()).toBe(at(20).getTime());
    expect(sch.segments[1].handoverReason).toBe('SERVING_LOST');
  });

  it('rejects a sampleStepSec that rounds to 0 ms instead of looping forever', () => {
    const positions = source({ 1: () => 40 });
    const opts = { terminal, positions, start: at(0), end: at(10) };

    expect(() => ServingSatelliteScheduler.schedule({ ...opts, sampleStepSec: 0.0004 })).toThrow(ValidationError);
    expect(() => ServingSatelliteScheduler.schedule({ ...opts, reassignmentIntervalSec: 0.0004 })).toThrow(ValidationError);
    // 1 ms is the smallest accepted step
    expect(() => ServingSatelliteScheduler.schedule({ ...opts, end: at(0.01), sampleStepSec: 0.001 })).not.toThrow();
  });

  it('keeps a usable serving satellite that the full evaluation missed (fixed interval)', () => {
    // Sat 1 (serving, el 40 via the subset path) is reported at 5 deg (below the 10 deg mask) by
    // the full path from 15 s on. Sat 2 sits at 30 deg. Sat 1 is the higher usable satellite by its
    // own assessment, so it must be kept; before the fix cur = -1 forced a SCHEDULED handover.
    const positions = source({ 1: (s, sub) => (s >= 15 && !sub ? 5 : 40), 2: () => 30 });
    const sch = ServingSatelliteScheduler.schedule({
      terminal, positions, start: at(0), end: at(40), reassignmentIntervalSec: 15,
      strategy: ServingStrategy.HIGHEST_ELEVATION, minElevation: 10,
    });

    expect(sch.segments).toHaveLength(1);
    expect(sch.segments[0].satId).toBe(1);
    expect(sch.stats.handoverCount).toBe(0);
  });
});
