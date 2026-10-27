/**
 * Regression tests for the v8 comm fixes, pinned against closed-form references.
 */
import { Antenna, Beacon, calculateFspl, Decibels, Hertz, Receiver, Transmitter, Watts } from '../../main';

describe('calculateFspl (Friis)', () => {
  it('is 152.45 dB at 1 GHz over 1000 km: 20 log10(4 pi d f / c) = 20 log10(4 pi 1e6 1e9 / 299792458)', () => {
    const exact = 20 * Math.log10((4 * Math.PI * 1e6 * 1e9) / 299792458);

    expect(exact).toBeCloseTo(152.4478, 4);
    expect(calculateFspl(1000, 1e9 as Hertz)).toBeCloseTo(exact, 2);
  });

  it('rises 6.02 dB per doubling of distance or of frequency (inverse-square law)', () => {
    const base = calculateFspl(500, 2e9 as Hertz);

    expect(calculateFspl(1000, 2e9 as Hertz) - base).toBeCloseTo(20 * Math.log10(2), 10);
    expect(calculateFspl(500, 4e9 as Hertz) - base).toBeCloseTo(20 * Math.log10(2), 10);
  });
});

describe('Antenna.getOffAxisLoss', () => {
  const dish = new Antenna({ gain: 40 as Decibels, beamwidth: 1.5 });

  it('is -3 dB at the half-power half-width', () => {
    expect(dish.getOffAxisLoss(0.75)).toBeCloseTo(-3, 12);
  });

  it('floors the effective gain at the -10 dBi far-sidelobe level (ITU-R S.465)', () => {
    // Without the floor, 90 deg off a 1.5 deg beam would be -3 * 120^2 = -43200 dB
    expect(dish.getOffAxisLoss(90)).toBe(-50);
    expect(dish.getEffectiveGain(90)).toBe(-10);
  });
});

describe('Receiver frequency compatibility', () => {
  const at = (id: number) => ({ id, name: `p${id}`, toJ2000: () => null }) as never;
  const tx = (f: number): Transmitter => new Transmitter({
    id: 1, name: 'tx', frequency: f as Hertz, power: 10 as Watts, bandwidth: 1e6 as Hertz,
    antenna: new Antenna({ gain: 0 as Decibels }),
  });
  const rx = new Receiver({
    id: 2, name: 'rx', frequency: 2e9 as Hertz, bandwidth: 1e6 as Hertz,
    noiseFigure: 1 as Decibels, minimumSnr: 3 as Decibels, antenna: new Antenna({ gain: 0 as Decibels }),
  });

  it('accepts a carrier inside the passband edge (|df| <= B/2) and rejects one just outside', () => {
    expect(rx.isFrequencyCompatible(tx(2e9 + 0.5e6))).toBe(true);
    expect(rx.isFrequencyCompatible(tx(2e9 + 0.5e6 + 1))).toBe(false);
  });

  it('canReceive is false for an out-of-band transmitter before any geometry is evaluated', () => {
    const t = tx(14e9);

    t.setParent(at(1));
    rx.setParent(at(2));
    // toJ2000 returns null: reaching the geometry would throw, so a false here proves the early exit
    expect(rx.canReceive(t, new Date())).toBe(false);
  });
});

describe('Beacon windows on a schedule with known boundaries', () => {
  // Interval 100 s, duration 20 s, epoch T0: windows [0, 20), [100, 120), [200, 220), ... seconds
  const t0 = Date.UTC(2025, 5, 1);
  const s = (sec: number): Date => new Date(t0 + sec * 1000);
  const beacon = new Beacon({
    id: 9, name: 'b', frequency: 437e6 as Hertz, power: 1 as Watts, bandwidth: 25e3 as Hertz,
    antenna: new Antenna({ gain: 0 as Decibels }), transmitInterval: 100, transmitDuration: 20, epoch: s(0),
  });

  it('getNextTransmission is strictly after the query, including exactly at a window start', () => {
    expect(beacon.getNextTransmission(s(-50)).start).toEqual(s(0));
    expect(beacon.getNextTransmission(s(0)).start).toEqual(s(100));
    expect(beacon.getNextTransmission(s(19.999)).start).toEqual(s(100));
    expect(beacon.getNextTransmission(s(150)).start).toEqual(s(200));
  });

  it('getCurrentTransmission returns the window containing the time, half-open at the end', () => {
    expect(beacon.getCurrentTransmission(s(100))).toEqual({ start: s(100), end: s(120) });
    expect(beacon.getCurrentTransmission(s(119.999))).toEqual({ start: s(100), end: s(120) });
    expect(beacon.getCurrentTransmission(s(120))).toBeNull();
    expect(beacon.getCurrentTransmission(s(-1))).toBeNull();
  });

  it('getTransmissionsInRange clips both ends the same way and agrees with getTransmissionCount', () => {
    // [110, 310): in-progress [100,120) clipped to [110,120), then [200,220), then [300,310) clipped
    const wins = beacon.getTransmissionsInRange(s(110), s(310));

    expect(wins).toEqual([
      { start: s(110), end: s(120) },
      { start: s(200), end: s(220) },
      { start: s(300), end: s(310) },
    ]);
    expect(beacon.getTransmissionCount(s(110), s(310))).toBe(3);
  });

  it('counts 0 between windows, and is additive over adjacent ranges', () => {
    expect(beacon.getTransmissionCount(s(20), s(100))).toBe(0);
    expect(beacon.getTransmissionsInRange(s(20), s(100))).toEqual([]);
    // Total over [0, 1000) is 10; split at 450 (a silent instant) it is 5 + 5
    expect(beacon.getTransmissionCount(s(0), s(1000))).toBe(10);
    expect(beacon.getTransmissionCount(s(0), s(450)) + beacon.getTransmissionCount(s(450), s(1000))).toBe(10);
  });
});
