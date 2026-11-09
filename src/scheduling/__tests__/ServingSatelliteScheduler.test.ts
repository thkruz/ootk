import { describe, expect, it } from 'vitest';
import { PhasedArrayAntenna } from '../../comm/PhasedArrayAntenna';
import { Antenna } from '../../comm/Antenna';
import { calculateFspl, type Decibels, type Hertz } from '../../comm/CommTypes';
import { ValidationError } from '../../errors';
import { GroundStation } from '../../objects/GroundStation';
import { HorizonProfile } from '../../objects/HorizonProfile';
import { SkyUsageGrid } from '../../objects/SkyUsageGrid';
import { ecef2rae } from '../../transforms/transforms';
import type { Degrees, Kilometers } from '../../types/types';
import type { PositionSource } from '../PositionSource';
import { ServingSatelliteScheduler, ServingStrategy, type ServingSchedulerOptions } from '../ServingSatelliteScheduler';

// Epoch seconds of T0 is a multiple of 60, so interval 15 / phase 12 ticks fall on :12, :27, :42, :57.
const T0 = new Date('2026-01-01T00:00:00Z');
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);

const terminal = new GroundStation({ id: 1, name: 'T', lat: 38.9 as Degrees, lon: -77.0 as Degrees, alt: 0.1 as Kilometers });

interface Pose {
  az: number;
  el: number;
  rng: number;
}

/**
 * Places a satellite at an exact azimuth/elevation/range from the terminal. The ENU basis is
 * written out here from the textbook definition (East = (-sin lon, cos lon, 0), etc., Vallado 4th
 * ed. Sec. 4.4) and verified against ootk's own ecef2rae in the first test.
 */
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

/** Synthetic source: each satellite is a function of seconds since T0. */
function synthetic(sats: Record<number, (sec: number) => Pose>, withSubset = true): PositionSource {
  const ids = Object.keys(sats).map(Number);
  const write = (date: Date, i: number, out: Float64Array, o: number) => {
    const p = sats[ids[i]]((date.getTime() - T0.getTime()) / 1000);
    const [x, y, z] = placeEcf(p.az, p.el, p.rng);

    out[o] = x;
    out[o + 1] = y;
    out[o + 2] = z;
  };
  const src: PositionSource = {
    ids,
    positionsEcf(date, out) {
      ids.forEach((_, i) => write(date, i, out, 3 * i));
    },
  };

  if (withSubset) {
    src.positionsEcfSubset = (date, indices, out) => {
      for (let k = 0; k < indices.length; k++) {
        write(date, indices[k], out, 3 * k);
      }
    };
  }

  return src;
}

const fixed = (az: number, el: number, rng = 1000) => () => ({ az, el, rng });
const base = (positions: PositionSource, endSec: number, extra: Partial<ServingSchedulerOptions> = {}): ServingSchedulerOptions => ({
  terminal,
  positions,
  start: at(0),
  end: at(endSec),
  ...extra,
});
const sec = (d: Date) => (d.getTime() - T0.getTime()) / 1000;

describe('ServingSatelliteScheduler', () => {
  describe('synthetic geometry helper', () => {
    it('places satellites at the requested az/el/range (checked with ootk ecef2rae)', () => {
      const [x, y, z] = placeEcf(123.4, 37.5, 1500);
      const rae = ecef2rae(terminal.lla(), { x: x as Kilometers, y: y as Kilometers, z: z as Kilometers });

      expect(rae.az).toBeCloseTo(123.4, 6);
      expect(rae.el).toBeCloseTo(37.5, 6);
      expect(rae.rng).toBeCloseTo(1500, 6);
    });
  });

  describe('fixed-interval mode with phase offset', () => {
    // A: constant 40 deg. B rises 10 + t deg. Highest elevation switches to B at the first tick
    // after B exceeds 40: B(t) = 10 + t > 40 for t > 30, ticks at 12, 27, 42 -> switch at 42.
    const src = () =>
      synthetic({
        100: fixed(100, 40),
        200: (t) => ({ az: 200, el: Math.min(70, 10 + t), rng: 1000 }),
      });

    it('hands over exactly on the phase-shifted tick', () => {
      const r = ServingSatelliteScheduler.schedule(base(src(), 90, { reassignmentIntervalSec: 15, reassignmentPhaseSec: 12 }));

      expect(r.segments.map((s) => [s.satId, sec(s.start), sec(s.end), s.handoverReason])).toEqual([
        [100, 0, 42, 'INITIAL'],
        [200, 42, 90, 'SCHEDULED'],
      ]);
      expect(r.segments[0].startEl).toBeCloseTo(40, 6);
      expect(r.segments[0].startAz).toBeCloseTo(100, 6);
      expect(r.segments[0].endEl).toBeCloseTo(40, 6);
      expect(r.segments[1].startEl).toBeCloseTo(52, 6);
      expect(r.segments[1].startAz).toBeCloseTo(200, 6);
      expect(r.gaps).toEqual([]);
      expect(r.stats.servedFraction).toBe(1);
      expect(r.stats.handoverCount).toBe(1);
      expect(r.stats.meanSegmentSec).toBe(45);
    });

    it('a different phase moves the handover to a different tick', () => {
      // phase 0: ticks 0, 15, 30, 45: B(45) = 55 > 40 first exceeded at 45 (B(30) = 40 is not greater).
      const r = ServingSatelliteScheduler.schedule(base(src(), 90, { reassignmentIntervalSec: 15, reassignmentPhaseSec: 0 }));

      expect(sec(r.segments[1].start)).toBe(45);
    });

    it('does not hand over between ticks even when the other satellite is higher', () => {
      // interval 60: only ticks at 0 and 60. B beats A from t=31 but the handover waits for t=60.
      const r = ServingSatelliteScheduler.schedule(base(src(), 90, { reassignmentIntervalSec: 60 }));

      expect(r.segments.map((s) => [s.satId, sec(s.start)])).toEqual([[100, 0], [200, 60]]);
    });
  });

  describe('early handover when the serving satellite drops mid-interval', () => {
    it('re-selects at the first sample where it is unusable and marks SERVING_LOST', () => {
      const r = ServingSatelliteScheduler.schedule(
        base(
          synthetic({
            1: (t) => ({ az: 10, el: t < 20 ? 50 : -5, rng: 1000 }),
            2: fixed(250, 20),
          }),
          60,
          { reassignmentIntervalSec: 15, reassignmentPhaseSec: 12, minElevation: 10 },
        ),
      );

      expect(r.segments.map((s) => [s.satId, sec(s.start), sec(s.end), s.handoverReason])).toEqual([
        [1, 0, 20, 'INITIAL'],
        [2, 20, 60, 'SERVING_LOST'],
      ]);
      expect(r.segments[0].endEl).toBeCloseTo(-5, 6);
      expect(r.stats.handoverCount).toBe(1);
    });

    it('a coarser sample step delays the early handover to the sample grid', () => {
      const r = ServingSatelliteScheduler.schedule(
        base(
          synthetic({
            1: (t) => ({ az: 10, el: t < 21 ? 50 : -5, rng: 1000 }),
            2: fixed(250, 20),
          }),
          60,
          { sampleStepSec: 5, minElevation: 10 },
        ),
      );

      // continuous mode: samples at 0, 5, ..., first unusable sample is 25
      expect(sec(r.segments[1].start)).toBe(25);
    });
  });

  describe('gaps and reasons', () => {
    it('NOTHING_IN_VIEW then GAP_RECOVERY at the first usable sample (not the next tick)', () => {
      const r = ServingSatelliteScheduler.schedule(
        base(synthetic({ 7: (t) => ({ az: 0, el: t < 30 ? -10 : 40, rng: 1000 }) }), 60, {
          reassignmentIntervalSec: 15,
          reassignmentPhaseSec: 12,
        }),
      );

      expect(r.gaps.map((g) => [sec(g.start), sec(g.end), g.reason])).toEqual([[0, 30, 'NOTHING_IN_VIEW']]);
      expect(r.segments.map((s) => [s.satId, sec(s.start), s.handoverReason])).toEqual([[7, 30, 'GAP_RECOVERY']]);
      expect(r.stats.servedFraction).toBeCloseTo(0.5, 12);
      expect(r.stats.longestGapSec).toBe(30);
      expect(r.stats.handoverCount).toBe(0);
    });

    it('BELOW_MASK when the satellite is above the horizon but under minElevation', () => {
      const r = ServingSatelliteScheduler.schedule(base(synthetic({ 1: fixed(0, 5) }), 10, { minElevation: 10 }));

      expect(r.segments).toEqual([]);
      expect(r.gaps.map((g) => g.reason)).toEqual(['BELOW_MASK']);
      expect(r.stats.servedFraction).toBe(0);
    });

    it('BELOW_MASK from an azimuth-dependent horizon', () => {
      const horizon = HorizonProfile.fromPoints([
        { az: 0, el: 5 },
        { az: 90, el: 30 },
        { az: 180, el: 5 },
      ]);
      const r = ServingSatelliteScheduler.schedule(base(synthetic({ 1: fixed(90, 20) }), 10, { horizon }));

      expect(r.gaps.map((g) => g.reason)).toEqual(['BELOW_MASK']);
      const clear = ServingSatelliteScheduler.schedule(base(synthetic({ 1: fixed(0, 20) }), 10, { horizon }));

      expect(clear.gaps).toEqual([]);
    });

    it('OUTSIDE_SCAN when a phased array cannot steer to the satellite', () => {
      const antenna = new PhasedArrayAntenna({ gain: 30 as Decibels, maxScanAngle: 30 });
      // zenith-pointing panel: el 20 is 70 deg off boresight (> 30), el 80 is 10 deg
      const out = ServingSatelliteScheduler.schedule(base(synthetic({ 1: fixed(0, 20) }), 10, { antenna, minElevation: 10 }));

      expect(out.gaps.map((g) => g.reason)).toEqual(['OUTSIDE_SCAN']);
      const inside = ServingSatelliteScheduler.schedule(base(synthetic({ 1: fixed(0, 80) }), 10, { antenna, minElevation: 10 }));

      expect(inside.gaps).toEqual([]);
      expect(inside.segments).toHaveLength(1);
    });

    it('antennas without isWithinScan use the gain floor', () => {
      const dish = new Antenna({ gain: 5 as Decibels, efficiency: 0.6 });
      const low = ServingSatelliteScheduler.schedule(base(synthetic({ 1: fixed(0, 40) }), 10, { antenna: dish, antennaGainFloorDbi: 10 }));

      expect(low.gaps.map((g) => g.reason)).toEqual(['OUTSIDE_SCAN']);
      const ok = ServingSatelliteScheduler.schedule(base(synthetic({ 1: fixed(0, 40) }), 10, { antenna: dish, antennaGainFloorDbi: 0 }));

      expect(ok.gaps).toEqual([]);
    });

    it('OUT_OF_RANGE when only maxRange rejects an in-view satellite', () => {
      const r = ServingSatelliteScheduler.schedule(base(synthetic({ 1: fixed(0, 45, 1500) }), 10, { maxRange: 1000 as Kilometers }));

      expect(r.gaps.map((g) => g.reason)).toEqual(['OUT_OF_RANGE']);
      const ok = ServingSatelliteScheduler.schedule(base(synthetic({ 1: fixed(0, 45, 900) }), 10, { maxRange: 1000 as Kilometers }));

      expect(ok.gaps).toEqual([]);
    });

    it('precedence: the most permissive single rule wins, mask first when nothing is exclusive', () => {
      // Satellite fails mask AND range: no exclusive failure, highest-el satellite fails mask first.
      const both = ServingSatelliteScheduler.schedule(
        base(synthetic({ 1: fixed(0, 5, 2000) }), 10, { minElevation: 10, maxRange: 1000 as Kilometers }),
      );

      expect(both.gaps.map((g) => g.reason)).toEqual(['BELOW_MASK']);
      // Adding a satellite that fails range only: relaxing range would let it serve -> OUT_OF_RANGE... but
      // a satellite failing mask only (sat 3) also exists, and BELOW_MASK ranks first.
      const mixed = ServingSatelliteScheduler.schedule(
        base(synthetic({ 1: fixed(0, 5, 2000), 2: fixed(90, 45, 2000), 3: fixed(180, 6, 900) }), 10, {
          minElevation: 10,
          maxRange: 1000 as Kilometers,
        }),
      );

      expect(mixed.gaps.map((g) => g.reason)).toEqual(['BELOW_MASK']);
      // Without sat 3: sat 2 is exclusive range failure, sat 1 fails both -> OUT_OF_RANGE.
      const rangeOnly = ServingSatelliteScheduler.schedule(
        base(synthetic({ 1: fixed(0, 5, 2000), 2: fixed(90, 45, 2000) }), 10, { minElevation: 10, maxRange: 1000 as Kilometers }),
      );

      expect(rangeOnly.gaps.map((g) => g.reason)).toEqual(['OUT_OF_RANGE']);
    });

    it('gap reason changes split the gap', () => {
      const r = ServingSatelliteScheduler.schedule(
        base(synthetic({ 1: (t) => ({ az: 0, el: t < 5 ? -20 : 5, rng: 1000 }) }), 10, { minElevation: 10 }),
      );

      expect(r.gaps.map((g) => [sec(g.start), sec(g.end), g.reason])).toEqual([
        [0, 5, 'NOTHING_IN_VIEW'],
        [5, 10, 'BELOW_MASK'],
      ]);
    });
  });

  describe('strategies', () => {
    it('HIGHEST_ELEVATION picks the higher satellite regardless of order', () => {
      const r = ServingSatelliteScheduler.schedule(base(synthetic({ 1: fixed(0, 30), 2: fixed(90, 62), 3: fixed(180, 45) }), 10));

      expect(r.segments.map((s) => s.satId)).toEqual([2]);
    });

    it('LONGEST_REMAINING_VISIBILITY picks the later-setting satellite', () => {
      const sats = {
        1: (t: number) => ({ az: 0, el: t < 100 ? 60 : -5, rng: 1000 }),
        2: (t: number) => ({ az: 90, el: t < 300 ? 30 : -5, rng: 1000 }),
      };
      const longest = ServingSatelliteScheduler.schedule(
        base(synthetic(sats), 50, { strategy: ServingStrategy.LONGEST_REMAINING_VISIBILITY, sampleStepSec: 2 }),
      );

      expect(longest.segments.map((s) => s.satId)).toEqual([2]);
      const highest = ServingSatelliteScheduler.schedule(base(synthetic(sats), 50, { sampleStepSec: 2 }));

      expect(highest.segments.map((s) => s.satId)).toEqual([1]);
    });

    it('lookahead is limited to the top-K by elevation and capped by the horizon', () => {
      const sats = {
        1: (t: number) => ({ az: 0, el: t < 100 ? 60 : -5, rng: 1000 }),
        2: (t: number) => ({ az: 90, el: t < 300 ? 30 : -5, rng: 1000 }),
      };
      const k1 = ServingSatelliteScheduler.schedule(
        base(synthetic(sats), 50, { strategy: ServingStrategy.LONGEST_REMAINING_VISIBILITY, lookaheadTopK: 1, sampleStepSec: 2 }),
      );

      expect(k1.segments.map((s) => s.satId)).toEqual([1]); // sat 2 is never examined
      // horizon 60 s: both survive the horizon (sat 1 sets at t=100) -> tie, higher elevation wins
      const capped = ServingSatelliteScheduler.schedule(
        base(synthetic(sats), 50, {
          strategy: ServingStrategy.LONGEST_REMAINING_VISIBILITY,
          lookaheadHorizonSec: 60,
          sampleStepSec: 2,
        }),
      );

      expect(capped.segments.map((s) => s.satId)).toEqual([1]);
    });

    it('BEST_LINK_MARGIN ranks by antenna gain minus FSPL', () => {
      const sats = { 1: fixed(0, 60, 1200), 2: fixed(90, 30, 700) };
      const f = 12e9 as Hertz;
      const r = ServingSatelliteScheduler.schedule(base(synthetic(sats), 10, { strategy: ServingStrategy.BEST_LINK_MARGIN, frequencyHz: f }));

      // omni terminal (gain 0): margin proxy is -FSPL, so the nearer satellite wins even at lower elevation
      expect(calculateFspl(700, f)).toBeLessThan(calculateFspl(1200, f));
      expect(r.segments.map((s) => s.satId)).toEqual([2]);
    });

    it('BEST_LINK_MARGIN includes antenna gain: scan loss can outweigh range', () => {
      const antenna = new PhasedArrayAntenna({ gain: 35 as Decibels, maxScanAngle: 70 });
      // sat 1: zenith (no scan loss) at 1200 km; sat 2: el 25 (scan angle 65 deg) at 700 km
      const sats = { 1: fixed(0, 90, 1200), 2: fixed(90, 25, 700) };
      const f = 12e9 as Hertz;
      const g1 = antenna.getGainToward(0 as Degrees, 90 as Degrees);
      const g2 = antenna.getGainToward(90 as Degrees, 25 as Degrees);
      const m1 = g1 - calculateFspl(1200, f);
      const m2 = g2 - calculateFspl(700, f);
      const r = ServingSatelliteScheduler.schedule(
        base(synthetic(sats), 10, { strategy: ServingStrategy.BEST_LINK_MARGIN, frequencyHz: f, antenna }),
      );

      expect(r.segments.map((s) => s.satId)).toEqual([m1 > m2 ? 1 : 2]);
      expect(g1).toBeGreaterThan(g2);
    });

    it('user callback chooses; null declines and yields NO_SELECTION', () => {
      const sats = synthetic({ 1: fixed(0, 30), 2: fixed(90, 62) });
      let seen = 0;
      const lowest = ServingSatelliteScheduler.schedule(
        base(sats, 10, {
          strategy: (cands, ctx) => {
            seen++;
            expect(ctx.time).toBeInstanceOf(Date);
            expect(cands[0].rangeKm).toBeCloseTo(1000, 6);

            return cands.reduce((a, b) => (a.el <= b.el ? a : b)).id;
          },
        }),
      );

      expect(lowest.segments.map((s) => s.satId)).toEqual([1]);
      expect(seen).toBeGreaterThan(0);
      const decline = ServingSatelliteScheduler.schedule(base(sats, 10, { strategy: () => null }));

      expect(decline.segments).toEqual([]);
      expect(decline.gaps.map((g) => g.reason)).toEqual(['NO_SELECTION']);
    });
  });

  describe('continuous mode', () => {
    const sats = () => synthetic({ 1: fixed(0, 40), 2: (t) => ({ az: 90, el: 10 + t, rng: 1000 }) });

    it('without hysteresis stays on the serving satellite until it is lost', () => {
      const r = ServingSatelliteScheduler.schedule(base(sats(), 100));

      expect(r.segments.map((s) => s.satId)).toEqual([1]);
    });

    it('with hysteresis switches when a candidate exceeds the margin (strictly)', () => {
      // sat 2 = 10 + t; exceeds 40 + 10.5 = 50.5 first at t = 41 (a margin of exactly 10 would sit on a float tie at t = 40)
      const r = ServingSatelliteScheduler.schedule(base(sats(), 100, { hysteresis: 10.5 }));

      expect(r.segments.map((s) => [s.satId, sec(s.start), s.handoverReason])).toEqual([
        [1, 0, 'INITIAL'],
        [2, 41, 'BETTER_CANDIDATE'],
      ]);
    });
  });

  describe('sampling and fallback', () => {
    it('works with a source that has no subset method', () => {
      const sats = {
        1: (t: number) => ({ az: 10, el: t < 20 ? 50 : -5, rng: 1000 }),
        2: fixed(250, 20),
      };
      const a = ServingSatelliteScheduler.schedule(base(synthetic(sats, true), 40, { reassignmentIntervalSec: 15 }));
      const b = ServingSatelliteScheduler.schedule(base(synthetic(sats, false), 40, { reassignmentIntervalSec: 15 }));

      expect(b.segments.map((s) => [s.satId, sec(s.start), sec(s.end)])).toEqual(a.segments.map((s) => [s.satId, sec(s.start), sec(s.end)]));
    });

    it('treats NaN (failed propagation) as unusable', () => {
      const src: PositionSource = {
        ids: [1],
        positionsEcf(_d, out) {
          out[0] = Number.NaN;
          out[1] = Number.NaN;
          out[2] = Number.NaN;
        },
      };
      const r = ServingSatelliteScheduler.schedule(base(src, 5));

      expect(r.segments).toEqual([]);
      expect(r.gaps.map((g) => g.reason)).toEqual(['NOTHING_IN_VIEW']);
    });
  });

  describe('sky usage grid helper', () => {
    it('accumulates served time at the serving az/el and blocked time for horizon-rejected samples', () => {
      const horizon = HorizonProfile.constant(15);
      const src = synthetic({ 1: (t) => ({ az: 45, el: t < 10 ? 8 : 40, rng: 1000 }) });
      const r = ServingSatelliteScheduler.schedule(base(src, 20, { horizon, recordSkyTrace: true }));
      const grid = new SkyUsageGrid({ azBinDeg: 10, elBinDeg: 10 });

      ServingSatelliteScheduler.addToSkyUsageGrid(r, grid);
      expect(grid.blockedSeconds).toBeCloseTo(10, 9);
      expect(grid.servedSeconds).toBeCloseTo(10, 9);
      // blocked at az 45 / el 8 -> cell (azIdx 4, elIdx 0); served at el 40 -> elIdx 4
      expect(grid.cellSeconds(4, 0).blocked).toBeCloseTo(10, 9);
      expect(grid.cellSeconds(4, 4).served).toBeCloseTo(10, 9);
    });

    it('throws without a trace', () => {
      const r = ServingSatelliteScheduler.schedule(base(synthetic({ 1: fixed(0, 40) }), 5));

      expect(() => ServingSatelliteScheduler.addToSkyUsageGrid(r, new SkyUsageGrid({ azBinDeg: 10, elBinDeg: 10 }))).toThrow(ValidationError);
    });
  });

  describe('validation', () => {
    const s = synthetic({ 1: fixed(0, 40) });

    it.each([
      ['end before start', { end: at(-5) }],
      ['non-positive step', { sampleStepSec: 0 }],
      ['non-positive interval', { reassignmentIntervalSec: -1 }],
      ['link margin without frequency', { strategy: ServingStrategy.BEST_LINK_MARGIN }],
      ['topK below 1', { lookaheadTopK: 0 }],
      ['negative hysteresis', { hysteresis: -1 }],
    ])('rejects %s', (_name, extra) => {
      expect(() => ServingSatelliteScheduler.schedule(base(s, 10, extra as Partial<ServingSchedulerOptions>))).toThrow(ValidationError);
    });

    it('rejects duplicate satellite ids', () => {
      const dup: PositionSource = { ids: [7, 7], positionsEcf: (_d, out) => out.fill(Number.NaN) };

      expect(() => ServingSatelliteScheduler.schedule(base(dup, 10))).toThrow(ValidationError);
    });
  });
});
