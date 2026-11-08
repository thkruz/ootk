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
  // G.8262 Option 2 holdover mask as quoted in TI SNAA345 Table 7-1 (secondary source for "Table 15 in G.8262"):
  //   x(S) = (a1 + a2) S + 0.5 b S^2 + c  [ns], a1 = 50 ns/s, a2 = 300 ns/s, b = 4.63e-4 ns/s^2, c = 1000 ns.
  // The quadratic form of the mask is the standard G.812 holdover form, not verified against the ITU text.
  // 24 h: 350 * 86400 = 3.024e7 ns; 0.5 * 4.63e-4 * 86400^2 = 1.72814e6 ns; + 1000 -> 3.19694e7 ns (31.97 ms).
  const maskNs = (s: number): number => 350 * s + 0.5 * 4.63e-4 * s * s + 1000;

  it('mask arithmetic', () => {
    expect(maskNs(DAY)).toBeCloseTo(3.19694e7, -3);
  });

  it('OCXO preset (mask without its temperature term) meets the mask at 24 h', () => {
    // a1 S = 4.32e6 ns; + 1.72814e6 + 1000 = 6.04914e6 ns = 6.049 ms. Meeting the limit is a fair check only because
    // the preset is the mask minus the 300 ns/s temperature allowance, so it must lie below it; the test guards the
    // ns -> s conversion and the aging term.
    const err = ClockModel.OCXO.timeErrorAt(DAY);

    expect(err).toBeCloseTo(6.04914e-3, 6);
    expect(err * 1e9).toBeLessThanOrEqual(maskNs(DAY));
  });

  it('TCXO preset (0.5 ppm, Kaplan Sec. 9.4.4) does not meet the EEC mask at 24 h', () => {
    // 0.5e-6 * 86400 = 0.0432 s = 43.2 ms > 31.97 ms
    expect(ClockModel.TCXO.timeErrorAt(DAY)).toBeCloseTo(0.0432, 9);
    expect(ClockModel.TCXO.timeErrorAt(DAY) * 1e9).toBeGreaterThan(maskNs(DAY));
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
