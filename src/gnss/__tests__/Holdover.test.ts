/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../errors';
import { GroundStation } from '../../objects/GroundStation';
import { Satellite } from '../../objects/Satellite';
import type { Degrees, Kilometers, TleLine1, TleLine2 } from '../../types/types';
import { GnssAntenna } from '../GnssAntenna';
import { GnssReceiver, type GnssSatellite } from '../GnssReceiver';
import { GPS_L1_CA } from '../GnssSignal';
import { ClockModel } from '../Holdover';
import { HoldoverTracker } from '../HoldoverTracker';
import { GPS_TLES } from './gps-tles.fixture';

const DAY = 86400;

describe('deterministic quadratic x(t) = x0 + y0 t + 0.5 D t^2', () => {
  const clock = new ClockModel({ initialTimeOffsetSec: 1e-6, initialFrequencyOffset: 1e-9, agingPerSec: 1e-12 });

  it('matches the hand-computed value at t = 1000 s', () => {
    // 1e-6 + 1e-9 * 1000 + 0.5 * 1e-12 * 1000^2 = 1e-6 + 1e-6 + 5e-7 = 2.5e-6 s
    expect(clock.timeErrorAt(1000)).toBeCloseTo(2.5e-6, 15);
  });

  it('equals x0 at t = 0 and has no sigma term without noise', () => {
    expect(clock.timeErrorAt(0)).toBe(1e-6);
    expect(clock.sigmaAt(1e5)).toBe(0);
  });

  it('timeToExceed is the closed-form positive root', () => {
    // 5e-13 t^2 + 1e-9 t + (1e-6 - 1e-5) = 0 -> disc = 1e-18 + 4 * 5e-13 * 9e-6 = 1.9e-17
    // t = (-1e-9 + sqrt(1.9e-17)) / (2 * 5e-13) = (-1e-9 + 4.358899e-9) / 1e-12 = 3358.899 s
    expect(clock.timeToExceed(1e-5)).toBeCloseTo(3358.899, 2);
    expect(clock.timeErrorAt(clock.timeToExceed(1e-5))).toBeCloseTo(1e-5, 12);
  });

  it('uses the negative branch for a negative drift (crossing -threshold)', () => {
    // x(t) = -1e-9 t, threshold 1e-6 -> exactly 1000 s
    expect(new ClockModel({ initialFrequencyOffset: -1e-9 }).timeToExceed(1e-6)).toBeCloseTo(1000, 6);
  });

  it('finds the -threshold crossing after a decelerating peak', () => {
    // x(t) = 1e-9 t - 1e-12 t^2 peaks at 2.5e-7 s (t = 500 s), then falls to -1e-6 s where
    // t^2 - 1000 t - 1e6 = 0 -> t = (1000 + sqrt(5e6)) / 2 = 1618.034 s
    expect(new ClockModel({ initialFrequencyOffset: 1e-9, agingPerSec: -2e-12 }).timeToExceed(1e-6)).toBeCloseTo(1618.034, 3);
  });

  it('returns Infinity for a perfect clock and 0 when already above the threshold', () => {
    expect(new ClockModel().timeToExceed(1e-6)).toBe(Infinity);
    expect(new ClockModel({ initialTimeOffsetSec: 2e-6 }).timeToExceed(1e-6)).toBe(0);
  });
});

describe('stochastic growth against the textbook formulas', () => {
  // Kaplan and Hegarty 2006 Sec. 11.1.5.1: GLONASS Gem cesium, Allan deviation 5e-11 at 1 s.
  // White FM: sigma_y^2(tau) = h0 / (2 tau) -> h0 = 2 * (5e-11)^2 = 5e-21.
  // Brown and Hwang: q1 = h0 / 2 = 2.5e-21, sigma_x(t) = sqrt(q1 t); t = 100 s -> sqrt(2.5e-19) = 5e-10 s.
  const white = new ClockModel({ noise: ClockModel.noiseFromAllan(5e-11) });

  it('white FM: h0 and q1 from the published Allan deviation', () => {
    expect(white.noise!.h0).toBeCloseTo(5e-21, 30);
    expect(white.sigmaAt(100)).toBeCloseTo(5e-10, 16);
  });

  it('random-walk FM: q2 = 2 pi^2 h-2 gives sigma_x = sqrt(q2 t^3 / 3)', () => {
    // 1 day Allan deviation 5e-13: h-2 = 3 sigma^2 / (2 pi^2 tau) = 3 * 2.5e-25 / (19.7392 * 86400) = 4.3976e-31
    // q2 = 2 pi^2 h-2 = 3 sigma^2 / tau = 7.5e-25 / 86400 = 8.6806e-30; t = 1e4: sqrt(8.6806e-30 * 1e12 / 3) = 1.7010e-9 s
    const rw = new ClockModel({ noise: ClockModel.noiseFromAllan(0, 5e-13, DAY) });

    expect(rw.noise!.hMinus2).toBeCloseTo(4.3976e-31, 35);
    expect(rw.sigmaAt(1e4)).toBeCloseTo(1.701e-9, 12);
  });

  // NIST SP 1065 (Riley 2008) Eq. 65: sigma_y^2(tau) = 2 integral_0^inf S_y(f) sin^4(pi f tau) / (pi f tau)^2 df.
  // Integrated numerically with u = pi f tau, df = du / (pi tau), to check the h-to-Allan constants.
  function allanFromPsd(exponent: 0 | -2, h: number, tau: number): number {
    const du = 0.01;
    const uMax = 2e4;
    let sum = 0;

    for (let u = du / 2; u < uMax; u += du) {
      const f = u / (Math.PI * tau);
      const s = h * f ** exponent;

      sum += (((s * Math.sin(u) ** 4) / (u * u)) * du) / (Math.PI * tau);
    }

    return 2 * sum;
  }

  it('white FM constant h0 / (2 tau) reproduces Eq. 65 (tolerance 1e-3; the u = 2e4 tail is about 2e-5 relative)', () => {
    expect(allanFromPsd(0, 5e-21, 10) / (5e-21 / (2 * 10))).toBeCloseTo(1, 3);
  });

  it('random-walk FM constant (2 pi^2 / 3) h-2 tau reproduces Eq. 65', () => {
    const h = 4.3976e-31;
    const tau = 1000;

    expect(allanFromPsd(-2, h, tau) / (((2 * Math.PI ** 2) / 3) * h * tau)).toBeCloseTo(1, 3);
  });

  it('time-error variance q2 t^3 / 3 equals the integral of (t - s)^2 q2 ds', () => {
    // x(t) = integral_0^t (t - s) dw(s), dw variance rate q2 -> Var = q2 integral_0^t (t - s)^2 ds
    const q2 = 2 * Math.PI ** 2 * 1e-30;
    const t = 5000;
    const n = 100000;
    let v = 0;

    for (let i = 0; i < n; i++) {
      const s = ((i + 0.5) / n) * t;

      v += q2 * (t - s) ** 2 * (t / n);
    }
    const m = new ClockModel({ noise: { h0: 0, hMinus2: 1e-30 } });

    expect(m.sigmaAt(t) ** 2 / v).toBeCloseTo(1, 6);
  });

  it('CESIUM preset reproduces its two fitted Allan points and documents the 100 s misfit', () => {
    const { h0, hMinus2 } = ClockModel.CESIUM.noise!;
    const adev = (tau: number): number => Math.sqrt(h0 / (2 * tau) + ((2 * Math.PI ** 2) / 3) * hMinus2 * tau);

    expect(adev(1)).toBeCloseTo(5e-11, 13); // Kaplan Sec. 11.1.5.1: 5e-11 at 1 s
    expect(adev(DAY)).toBeCloseTo(5e-13, 15); // 5e-13 at 1 day
    // Published 1e-11 at 100 s; white FM alone gives 5e-12 (flicker FM is not modelled): stated, not hidden.
    expect(adev(100)).toBeCloseTo(5e-12, 13);
  });

  it('timeToExceed solves numerically when noise is present and agrees with timeErrorAt', () => {
    // white FM only: bound = 3 * 5e-11 * sqrt(t) = 1e-7 s -> sqrt(t) = 666.67 -> t = 4.4444e5 s
    const t = white.timeToExceed(1e-7);

    expect(t).toBeCloseTo(444444.4, -1);
    expect(white.timeErrorAt(t)).toBeCloseTo(1e-7, 14);
  });
});

describe('preset values and the ITU-T G.8262 Option 2 holdover mask', () => {
  // ITU-T G.8262 (10/2024) cl. 11.2.2 eq. 11-3 and Table 15 (Option 2): T(S) <= (a1 + a2) S + 0.5 b S^2 + c [ns],
  // a1 = 50 ns/s, a2 = 300 ns/s, b = 4.63e-4 ns/s^2, c = 1000 ns. (a1 + a2 = 350 ns/s; confirmed by derivative eq. 11-4: (a1 + a2) + bS).
  // 24 h: 350 * 86400 = 3.024e7 ns; 0.5 * 4.63e-4 * 86400^2 = 1.72814e6 ns; + 1000 -> 3.19694e7 ns (31.97 ms).
  const maskNs = (s: number): number => 350 * s + 0.5 * 4.63e-4 * s * s + 1000;

  it('mask arithmetic', () => {
    expect(maskNs(DAY)).toBeCloseTo(3.19694e7, -3);
  });

  it('OCXO preset (mask without its temperature term) reproduces Table 15 and meets the full mask at 24 h', () => {
    // a1 S = 4.32e6 ns; + 1.72814e6 + 1000 = 6.04914e6 ns = 6.049 ms (hand arithmetic, float rounding only).
    const err = ClockModel.OCXO.timeErrorAt(DAY);

    expect(err).toBeCloseTo(6.04914e-3, 6);
    expect(err * 1e9).toBeLessThanOrEqual(maskNs(DAY));
    // Table 15 a1, b, c; G.812 (06/2004) Table A.18 Type IV has the same numbers.
    expect(ClockModel.OCXO.initialFrequencyOffset).toBeCloseTo(50e-9, 20);
    expect(ClockModel.OCXO.initialTimeOffsetSec).toBeCloseTo(1000e-9, 20);
    expect(ClockModel.OCXO.agingPerSec).toBeCloseTo(4.63e-13, 22);
  });

  it('TCXO preset (0.5 ppm, Kaplan Sec. 9.4.4) does not meet the EEC mask at 24 h', () => {
    // 0.5e-6 * 86400 = 0.0432 s = 43.2 ms > 31.97 ms
    expect(ClockModel.TCXO.timeErrorAt(DAY)).toBeCloseTo(0.0432, 9);
    expect(ClockModel.TCXO.timeErrorAt(DAY) * 1e9).toBeGreaterThan(maskNs(DAY));
  });
});

describe('primary ITU-T holdover masks', () => {
  // ITU-T G.8262.1 (11/2025) cl. 11.2, constant temperature: T(t) <= a1 t + 0.5 b t^2 + c [ns],
  // a1 = 10 ns/s, b = 1.16e-4 ns/s^2, c = 10 ns.
  const esecNs = (t: number): number => 10 * t + 0.5 * 1.16e-4 * t * t + 10;
  // ITU-T G.812 (06/2004) Table A.18 Types V and VI (= Table 1/G.812, 11/1988): x(S) = a1 S + 0.5 b S^2 + c [ns], S > 100 s.
  const transitNs = (s: number): number => 0.5 * s + 0.5 * 1.16e-5 * s * s + 1000;
  const localNs = (s: number): number => 10 * s + 0.5 * 2.3e-4 * s * s + 1000;

  it('eSEC preset reproduces the G.8262.1 cl. 11.2 constant-temperature mask', () => {
    // Hand values: t = 100 s -> 1000 + 0.58 + 10 = 1010.58 ns; t = 86400 s -> 8.64e5 + 4.329e5 + 10 (see below).
    expect(esecNs(100)).toBeCloseTo(1010.58, 9);
    for (const t of [100, 1000, 3600, DAY]) {
      // Tolerance 1e-9 relative: float rounding only (ns <-> s conversion).
      expect(ClockModel.ESEC_G8262_1.timeErrorAt(t) * 1e9).toBeCloseTo(esecNs(t), 3);
    }
    // 1.16e-4 ns/s^2 equals 1e-8/day (G.8262.1 Note 3): 1e-8 / 86400 s = 1.1574e-13 /s = 1.1574e-4 ns/s^2.
    expect(1e-8 / DAY * 1e9).toBeCloseTo(1.16e-4, 6);
  });

  it('G.812 (2004) Type V transit node preset reproduces Table A.18', () => {
    for (const s of [100, 1000, 3600, DAY]) {
      expect(ClockModel.TRANSIT_NODE_G812_TYPE_V.timeErrorAt(s) * 1e9).toBeCloseTo(transitNs(s), 3);
    }
    // At S = 100 s: 50 + 0.058 + 1000 = 1050.058 ns.
    expect(transitNs(100)).toBeCloseTo(1050.058, 9);
    // Table A.18 Type V: 0.5 ns/s = 5e-10; 1.16e-5 ns/s^2 = 1e-9/day (1e-9/86400 s = 1.157e-14 /s).
    expect(ClockModel.TRANSIT_NODE_G812_TYPE_V.initialFrequencyOffset).toBeCloseTo(5e-10, 20);
    expect(1e-9 / DAY * 1e9).toBeCloseTo(1.16e-5, 7);
  });

  it('G.812 (2004) Type VI local node preset reproduces Table A.18', () => {
    for (const s of [100, 1000, 3600, DAY]) {
      expect(ClockModel.LOCAL_NODE_G812_TYPE_VI.timeErrorAt(s) * 1e9).toBeCloseTo(localNs(s), 3);
    }
    // Table A.18 Type VI: 10 ns/s = 1e-8; 2.3e-4 ns/s^2 = 2e-8/day (2e-8/86400 s = 2.315e-13 /s).
    expect(ClockModel.LOCAL_NODE_G812_TYPE_VI.initialFrequencyOffset).toBeCloseTo(1e-8, 20);
    expect(2e-8 / DAY * 1e9).toBeCloseTo(2.3e-4, 5); // table rounds 2.315e-4 to 2 digits
  });

  it('G.8262 (10/2024) Option 1 EEC preset reproduces cl. 11.2.1 at constant temperature', () => {
    // eq. 11-2: T(S) <= a1 S + 0.5 b S^2 + c, a1 = 50, b = 1.16e-4, c = 120 ns. S = 100 s: 5000 + 0.58 + 120 = 5120.58 ns.
    // S = 86400 s: 4.32e6 + 0.5 * 1.16e-4 * 86400^2 (= 4.32968e5) + 120 = 4.753088e6 ns.
    expect(ClockModel.EEC_OPTION1_G8262.timeErrorAt(100) * 1e9).toBeCloseTo(5120.58, 3);
    expect(ClockModel.EEC_OPTION1_G8262.timeErrorAt(DAY) * 1e9).toBeCloseTo(4.753088e6, -1);
  });

  it('G.812 (06/2004) Type I and Type III presets reproduce Table 24 at constant temperature', () => {
    // Type I: a1 0.5, b 2.3e-6, c 60. S = 100 s: 50 + 0.0115 + 60 = 110.0115 ns.
    // S = 86400: 43200 + 0.5 * 2.3e-6 * 86400^2 (= 8584.704) + 60 = 51844.704 ns.
    expect(ClockModel.G812_TYPE_I.timeErrorAt(100) * 1e9).toBeCloseTo(110.0115, 4);
    expect(ClockModel.G812_TYPE_I.timeErrorAt(DAY) * 1e9).toBeCloseTo(51844.704, 2);
    // Type III: a1 1.0, b 1.16e-5, c 150. S = 100 s: 100 + 0.058 + 150 = 250.058 ns.
    // S = 86400: 86400 + 0.5 * 1.16e-5 * 86400^2 (= 43296.768) + 150 = 129846.768 ns.
    expect(ClockModel.G812_TYPE_III.timeErrorAt(100) * 1e9).toBeCloseTo(250.058, 4);
    expect(ClockModel.G812_TYPE_III.timeErrorAt(DAY) * 1e9).toBeCloseTo(129846.768, 2);
  });

  it('is ordered: transit node < eSEC < local node at one day', () => {
    const t = DAY;

    expect(ClockModel.TRANSIT_NODE_G812_TYPE_V.timeErrorAt(t)).toBeLessThan(ClockModel.ESEC_G8262_1.timeErrorAt(t));
    expect(ClockModel.ESEC_G8262_1.timeErrorAt(t)).toBeLessThan(ClockModel.LOCAL_NODE_G812_TYPE_VI.timeErrorAt(t));
  });
});

describe('validation and serialization', () => {
  it('rejects bad inputs', () => {
    expect(() => new ClockModel({ initialFrequencyOffset: Number.NaN })).toThrow(ValidationError);
    expect(() => new ClockModel({ sigmaMultiplier: -1 })).toThrow(ValidationError);
    expect(() => new ClockModel({ noise: { h0: -1, hMinus2: 0 } })).toThrow(ValidationError);
    expect(() => ClockModel.noiseFromAllan(-1)).toThrow(ValidationError);
    expect(() => new ClockModel().timeErrorAt(-1)).toThrow(ValidationError);
    expect(() => new ClockModel().timeToExceed(0)).toThrow(ValidationError);
    expect(() => new HoldoverTracker(new ClockModel(), 0)).toThrow(ValidationError);
  });

  it('round-trips through serialize and deserialize', () => {
    const c = new ClockModel({ initialTimeOffsetSec: 1e-6, agingPerSec: 2e-12, noise: { h0: 1e-20, hMinus2: 1e-30 }, sigmaMultiplier: 2 });
    const back = ClockModel.deserialize(c.serialize());

    expect(back.timeErrorAt(1234)).toBe(c.timeErrorAt(1234));
    expect(ClockModel.deserialize(new ClockModel().serialize()).noise).toBeNull();
  });
});

describe('HoldoverTracker with a jammed GnssReceiver', () => {
  const T0 = new Date('2026-03-09T12:00:00Z');
  const at = (sec: number): Date => new Date(T0.getTime() + sec * 1000);
  const site = new GroundStation({ lat: 41.754785 as Degrees, lon: -70.539151 as Degrees, alt: 0.060966 as Kilometers, name: 'site' });
  const sats: GnssSatellite[] = GPS_TLES.map((t) => ({
    id: t.name,
    object: new Satellite({ tle1: t.tle1 as TleLine1, tle2: t.tle2 as TleLine2, name: t.name }),
  }));
  const jam = {
    position: { lat: site.lat, lon: site.lon, alt: (site.alt + 1) as Kilometers },
    eirpDbw: 30,
    centerFrequencyHz: GPS_L1_CA.carrierFrequencyHz,
    bandwidthHz: 20.46e6,
    spectralType: 'bandlimited-noise' as const,
  };

  it('error is 0 with a fix, grows from loss of fix, and exceeds the threshold at timeToExceed', () => {
    const rx = new GnssReceiver({
      signal: GPS_L1_CA,
      antenna: GnssAntenna.typicalFrpa(),
      noise: { noiseFigureDb: 2, antennaTemperatureK: 100 },
      acquisitionThresholdDbHz: 32,
    });
    // y0 = 1e-6, no aging: x(t) = 1e-6 t; threshold 1e-4 s is reached at exactly 100 s.
    const tracker = new HoldoverTracker(new ClockModel({ initialFrequencyOffset: 1e-6 }), 1e-4);

    const locked = tracker.evaluate(rx.step(T0, site, sats));

    expect(locked.inHoldover).toBe(false);
    expect(locked.timeErrorSec).toBe(0);
    expect(locked.secondsUntilThreshold).toBeCloseTo(100, 6);

    const s60 = tracker.evaluate(rx.step(at(60), site, sats, [jam]));
    const s90 = tracker.evaluate(rx.step(at(90), site, sats, [jam]));
    const s120 = tracker.evaluate(rx.step(at(120), site, sats, [jam]));

    expect(s60.inHoldover).toBe(true);
    expect(s60.timeErrorSec).toBeCloseTo(6e-5, 12);
    expect(s90.timeErrorSec).toBeCloseTo(9e-5, 12);
    expect(s60.timeErrorSec!).toBeLessThan(s90.timeErrorSec!);
    expect(s90.thresholdExceeded).toBe(false);
    expect(s90.secondsUntilThreshold).toBeCloseTo(10, 6);
    expect(s120.thresholdExceeded).toBe(true);
    expect(s120.secondsUntilThreshold).toBe(0);

    const back = tracker.evaluate(rx.step(at(130), site, sats));

    expect(back.timeErrorSec).toBe(0);
    expect(back.inHoldover).toBe(false);
  });

  it('a receiver that never had a fix reports no holdover reference', () => {
    const tracker = new HoldoverTracker(ClockModel.TCXO, 1e-3);
    const status = tracker.evaluate({ hasFix: false, timeSinceLastFixSec: null });

    expect(status.timeErrorSec).toBeNull();
    expect(status.inHoldover).toBe(false);
  });
});

describe('non-monotonic bound: offset and drift of opposite sign', () => {
  // x(t) = 2e-6 - 1e-9 t: |x| is 2 us at 0, 1 us at 1000 s, 0 at 2000 s and 1 us again at 3000 s.
  const clock = new ClockModel({ initialTimeOffsetSec: 2e-6, initialFrequencyOffset: -1e-9 });

  it('timeToExceed finds the next crossing at or after fromSec', () => {
    expect(clock.timeToExceed(1e-6)).toBe(0);
    expect(clock.timeToExceed(1e-6, 500)).toBe(500);
    expect(clock.timeToExceed(1e-6, 1500)).toBeCloseTo(3000, 6);
    expect(() => clock.timeToExceed(1e-6, -1)).toThrow(ValidationError);
  });

  it('the tracker reports time until the next crossing, not 0, while under the threshold', () => {
    const status = new HoldoverTracker(clock, 1e-6).evaluate({ hasFix: false, timeSinceLastFixSec: 1500 });

    expect(status.thresholdExceeded).toBe(false);
    expect(status.secondsUntilThreshold).toBeCloseTo(1500, 6);
  });

  it('the numeric search (with noise) also starts at fromSec', () => {
    const noisy = new ClockModel({
      initialTimeOffsetSec: 2e-6, initialFrequencyOffset: -1e-9, noise: { h0: 1e-30, hMinus2: 1e-40 }, sigmaMultiplier: 1,
    });
    const next = noisy.timeToExceed(1e-6, 1500);

    expect(next).toBeGreaterThan(1500);
    expect(noisy.timeErrorAt(next)).toBeGreaterThanOrEqual(1e-6);
    expect(noisy.timeErrorAt(next - 1)).toBeLessThan(1e-6);
  });
});
