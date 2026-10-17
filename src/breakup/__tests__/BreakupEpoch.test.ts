import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EpochUTC } from '../../time/EpochUTC';
import type { Seconds } from '../../types/types';
import { DEG2RAD, secondsPerDay } from '../../utils/constants';
import { estimateBreakupEpoch } from '../BreakupEpoch';
import type { BreakupFragmentElements, BreakupTleLines } from '../BreakupFragments';
import { SYNTH_T0, syntheticCloud } from './synthetic-cloud';

const errorDays = (epoch: EpochUTC | null): number => (epoch!.posix - SYNTH_T0.posix) / secondsPerDay;

/** Cosmos 1408 ASAT debris (1982-092, catalog numbers >= 49000) from the ootk full-catalog fixture (epochs to 2022-08). */
const loadCosmos1408Debris = (): BreakupTleLines[] => {
  const text = readFileSync(resolve(__dirname, '../../../test/sgp4/full-catalog/TLE.txt'), 'utf8');
  const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split(/\r?\n/u);
  const out: BreakupTleLines[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const line1 = lines[i];
    const line2 = lines[i + 1];

    if (line1.startsWith('1 ') && line2.startsWith('2 ') && line1.substring(9, 14) === '82092' && Number(line1.substring(2, 7)) >= 49000) {
      out.push({ line1, line2 });
    }
  }

  return out;
};

describe('estimateBreakupEpoch: synthetic known answer', () => {
  /*
   * 40 fragments, isotropic 50 m/s (1-sigma per axis) kicks at 2021-11-15T02:47Z from a 480 km,
   * 82.56 deg orbit at argument of latitude 30 deg, elements carried 399 to 401 days forward
   * with the secular J2 model.
   */
  const { fragments } = syntheticCloud({ count: 40, ageDays: 400, argLatDeg: 30, seed: 7 });

  it('recovers the event epoch to within an hour, inside the reported uncertainty, with the defaults', () => {
    const r = estimateBreakupEpoch(fragments, { lookbackDays: 450 });

    expect(r.metric).toBe('plane');
    // Default trimFraction 0.1 drops 4 of 40.
    expect(r.fragmentsUsed).toBe(36);
    expect(r.fragmentsTrimmed).toBe(4);
    // Known answer for this cloud: 13 minutes early (-0.0092 d), uncertainty 0.0094 d.
    expect(Math.abs(errorDays(r.epoch))).toBeLessThan(1 / 24);
    expect(Math.abs(errorDays(r.epoch))).toBeLessThanOrEqual(r.uncertaintySec / secondsPerDay);
    expect(r.spreadAtMinDeg).toBeLessThan(0.05);
    expect(r.spreadNowDeg).toBeGreaterThan(1);
    // 400-day-old elements are flagged, nothing else.
    expect(r.quality).toBe('weak');
    expect(r.reasons).toEqual(['old-elements']);
    expect(r.curve.posix.length).toBe(r.curve.spreadDeg.length);
    expect(r.curve.posix.length).toBeGreaterThan(1000);
  });

  it('the pure common-line metric is exact to the refinement tolerance in this model', () => {
    const r = estimateBreakupEpoch(fragments, { lookbackDays: 450, alongLineWeight: 0, bootstrapSamples: 0 });

    expect(Math.abs(errorDays(r.epoch) * secondsPerDay)).toBeLessThan(120);
    expect(r.spreadAtMinDeg).toBeLessThan(1e-3);
  });

  it('the RAAN metric is biased by days, and its uncertainty says so', () => {
    const r = estimateBreakupEpoch(fragments, { lookbackDays: 450, metric: 'raan' });

    // Known answer: 1.54 days early. The bootstrap alone (0.30 d) would not cover it; the
    // disagreement with the plane metric (1.52 d) does.
    expect(errorDays(r.epoch)).toBeCloseTo(-1.54, 1);
    expect(r.bootstrapStdSec / secondsPerDay).toBeLessThan(0.5);
    expect(Math.abs(errorDays(r.epoch))).toBeLessThanOrEqual(r.uncertaintySec / secondsPerDay);
    expect(r.spreadNowDeg).toBeGreaterThan(20);
  });

  it('rates a fresh event (20 days, default 30-day window) as good', () => {
    const fresh = syntheticCloud({ count: 40, ageDays: 20, epochJitterDays: 1, argLatDeg: 30, seed: 11 }).fragments;
    const r = estimateBreakupEpoch(fresh);

    expect(r.quality).toBe('good');
    expect(r.reasons).toEqual([]);
    // Known answer: 30 minutes early (-0.0207 d), uncertainty 0.0227 d.
    expect(Math.abs(errorDays(r.epoch))).toBeLessThanOrEqual(r.uncertaintySec / secondsPerDay);
    expect(r.uncertaintySec).toBeLessThan(0.1 * secondsPerDay);
  });

  it('is deterministic for a fixed seed', () => {
    const a = estimateBreakupEpoch(fragments, { lookbackDays: 450 });
    const b = estimateBreakupEpoch(fragments, { lookbackDays: 450 });

    expect(a.epoch!.posix).toBe(b.epoch!.posix);
    expect(a.bootstrapStdSec).toBe(b.bootstrapStdSec);
  });

  it('ends the default window at the earliest fragment epoch and caps the look-back', () => {
    const r = estimateBreakupEpoch(fragments, { lookbackDays: 5000, bootstrapSamples: 0 });
    const earliest = Math.min(...fragments.map((f) => f.epoch.posix));

    expect(r.searchEnd.posix).toBe(earliest);
    expect((r.searchEnd.posix - r.searchStart.posix) / secondsPerDay).toBeCloseTo(730, 9);
  });

  it('flags a minimum at the window edge when the window misses the event', () => {
    const r = estimateBreakupEpoch(fragments, { bootstrapSamples: 0 });

    expect(r.reasons).toContain('minimum-at-window-edge');
    expect(r.quality).toBe('weak');
  });

  it('drops a second, unrelated cloud with trimFraction', () => {
    const polluted: BreakupFragmentElements[] = [
      ...fragments,
      ...syntheticCloud({ count: 4, ageDays: 280, argLatDeg: 200, seed: 99, t0: SYNTH_T0.roll((120 * secondsPerDay) as Seconds) }).fragments,
    ];
    const r = estimateBreakupEpoch(polluted, { lookbackDays: 450, trimFraction: 0.1 });

    expect(r.fragmentsTrimmed).toBe(4);
    expect(Math.abs(errorDays(r.epoch))).toBeLessThan(0.5);
  });
});

describe('estimateBreakupEpoch: degenerate input', () => {
  it('returns none for fragments with identical a, e and i', () => {
    const epoch = EpochUTC.fromDateTimeString('2024-03-01T00:00:00.000Z');
    const same: BreakupFragmentElements[] = Array.from({ length: 20 }, (_, k) => ({
      epoch: epoch.roll((k * 3600) as Seconds),
      semimajorAxis: 7000,
      eccentricity: 0.001,
      inclination: 51.6 * DEG2RAD,
      rightAscension: (100 + 0.1 * k) * DEG2RAD,
      argPerigee: 0,
    }));
    const r = estimateBreakupEpoch(same, { trimFraction: 0 });

    expect(r.quality).toBe('none');
    expect(r.reasons).toEqual(['indistinguishable-drift-rates']);
    expect(r.epoch).toBeNull();
    expect(r.fragmentsUsed).toBe(20);
  });

  it('returns none for fewer than three usable fragments', () => {
    const { fragments } = syntheticCloud({ count: 2 });
    const r = estimateBreakupEpoch([...fragments, { line1: 'garbage', line2: 'garbage' }]);

    expect(r.quality).toBe('none');
    expect(r.reasons).toEqual(['too-few-fragments']);
    expect(r.fragmentsInvalid).toBe(1);
    expect(r.epoch).toBeNull();
  });

  it('flags few fragments', () => {
    const { fragments } = syntheticCloud({ count: 6, ageDays: 20, seed: 3 });
    const r = estimateBreakupEpoch(fragments);

    expect(r.reasons).toContain('few-fragments');
    expect(r.quality).toBe('weak');
  });
});

describe('estimateBreakupEpoch: Cosmos 1408 (real TLEs)', () => {
  it('puts the 2021-11-15 ASAT breakup in November 2021 from TLEs up to 9 months later', () => {
    const debris = loadCosmos1408Debris();

    expect(debris.length).toBeGreaterThan(1000);
    const r = estimateBreakupEpoch(debris, { lookbackDays: 365 });
    const iso = r.epoch!.toDateTime().toISOString();

    expect(iso.startsWith('2021-11')).toBe(true);
    // Measured: 2021-11-15T06:32Z (3.75 h after the 02:47Z intercept), 1-sigma 1.9 days.
    expect(Math.abs(r.epoch!.posix - EpochUTC.fromDateTimeString('2021-11-15T02:47:00.000Z').posix)).toBeLessThanOrEqual(r.uncertaintySec);
    // High-drag pieces are dropped by the default ndot filter; the old elements are flagged.
    expect(r.fragmentsDragFiltered).toBeGreaterThan(500);
    expect(r.quality).toBe('weak');
    expect(r.reasons).toContain('old-elements');
  });
});

describe('estimateBreakupEpoch: search window anchored on the launch', () => {
  /*
   * The 2024-140 (CZ-6A) case: the stage broke up on launch day, the elements are about 800 days
   * later. 730 days back from the earliest element set starts the window ~70 days after the event.
   */
  const { fragments } = syntheticCloud({ count: 40, ageDays: 800, argLatDeg: 30, seed: 5 });
  const launch = SYNTH_T0.roll((-0.25 * secondsPerDay) as Seconds);

  it('converges when launchEpoch is supplied, with no 730-day cap', () => {
    const r = estimateBreakupEpoch(fragments, { launchEpoch: launch });

    // Window starts one day (the default margin) before the launch.
    expect(r.searchStart.posix).toBe(launch.posix - secondsPerDay);
    expect((r.searchEnd.posix - r.searchStart.posix) / secondsPerDay).toBeGreaterThan(730);
    expect(r.windowFinal).toBe(true);
    // Known answer: 13 minutes early, 1-sigma 13 minutes.
    expect(Math.abs(errorDays(r.epoch))).toBeLessThan(1 / 24);
    expect(r.quality).toBe('weak');
    expect(r.reasons).toEqual(['old-elements']);
  });

  it('returns none (no bogus date) at the 730-day cap without launchEpoch', () => {
    const r = estimateBreakupEpoch(fragments, { lookbackDays: 730 });

    expect(r.windowFinal).toBe(true);
    expect(r.quality).toBe('none');
    expect(r.epoch).toBeNull();
    expect(r.reasons).toContain('minimum-at-window-edge');
  });

  it('a caller-supplied searchStart is not capped and is final', () => {
    const r = estimateBreakupEpoch(fragments, { searchStart: SYNTH_T0.roll((-5 * secondsPerDay) as Seconds), bootstrapSamples: 0 });

    expect(r.searchStart.posix).toBe(SYNTH_T0.posix - 5 * secondsPerDay);
    expect(r.windowFinal).toBe(true);
    expect(Math.abs(errorDays(r.epoch))).toBeLessThan(1 / 24);
  });

  it('keeps a widenable window weak, and floors a flat-valley sigma at the valley half-width', () => {
    // Default 30-day window, ~770 days after the event: the curve is flat and pinned to the start.
    const r = estimateBreakupEpoch(fragments);

    expect(r.windowFinal).toBe(false);
    expect(r.quality).toBe('weak');
    expect(r.epoch).not.toBeNull();
    expect(r.reasons).toEqual(expect.arrayContaining(['minimum-at-window-edge', 'flat-valley']));
    // Every bootstrap resample finds the same edge (std 0); without the floor this was 60 s.
    expect(r.bootstrapStdSec).toBeLessThan(60);
    expect(r.uncertaintySec).toBeGreaterThanOrEqual(r.valleyHalfWidthSec);
    expect(r.uncertaintySec).toBeGreaterThan(secondsPerDay);
  });
});
