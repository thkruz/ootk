/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

import { ValidationError } from '../../errors';
import { GroundStation } from '../../objects/GroundStation';
import type { Degrees, Kilometers } from '../../types/types';
import { GnssAntenna } from '../GnssAntenna';
import { GPS_L1C, GPS_L1_CA } from '../GnssSignal';
import {
  BOLTZMANN_DBW_PER_K_HZ,
  calculateCn0,
  calculateEffectiveCn0,
  calculateInterfererAtReceiver,
  calculateJammingResistanceFactor,
  calculateJammingToSignalForCn0,
  calculateSignalPower,
  noiseDensityDbwHz,
  systemNoiseTemperatureK,
} from '../link';

const C_M_S = 299792458;

describe('noise', () => {
  it('Boltzmann constant is -228.5992 dBW/K/Hz (CODATA 2018 k = 1.380649e-23 J/K)', () => {
    // 10 log10(1.380649e-23) = -228.5992 (hand: log10(1.380649) = 0.14009, minus 23 -> -22.85991, times 10).
    expect(BOLTZMANN_DBW_PER_K_HZ).toBeCloseTo(-228.5992, 3);
  });

  it('builds Tsys from noise figure and antenna temperature', () => {
    // Kaplan and Hegarty 2006 p. 262 example: NF 4.3 dB, Tant 100 K.
    // Tamp = 290 (10^0.43 - 1) = 290 (2.6915 - 1) = 490.5 K; Tsys = 590.5 K. 0.5 K tolerance covers rounding of the 2.6915.
    expect(systemNoiseTemperatureK({ noiseFigureDb: 4.3, antennaTemperatureK: 100 })).toBeCloseTo(590.5, 0);
    expect(systemNoiseTemperatureK({ systemTemperatureK: 290 })).toBe(290);
    // A 0 dB noise figure adds nothing.
    expect(systemNoiseTemperatureK({ noiseFigureDb: 0, antennaTemperatureK: 50 })).toBeCloseTo(50, 12);
  });

  it('rejects non-physical noise', () => {
    expect(() => systemNoiseTemperatureK({ systemTemperatureK: 0 })).toThrow(ValidationError);
    expect(() => systemNoiseTemperatureK({ noiseFigureDb: NaN, antennaTemperatureK: 100 })).toThrow(ValidationError);
    expect(() => noiseDensityDbwHz(-1)).toThrow(ValidationError);
  });
});

describe('received C/N0', () => {
  // IS-GPS-200N Table 3-Va: -158.5 dBW at a 0 dBic-equivalent reference antenna. N0 at 290 K:
  // -228.5992 + 24.6240 = -203.9752 dBW/Hz, so C/N0 = -158.5 + 203.9752 = 45.475 dB-Hz. 0.005 covers rounding.
  it('L1 C/A at the ICD minimum, 0 dBic antenna, Tsys 290 K gives 45.475 dB-Hz', () => {
    const cn0 = calculateCn0({ signal: GPS_L1_CA, rxGainDbic: 0 }, 290);

    expect(cn0).toBeCloseTo(45.475, 2);
  });

  // Kaplan and Hegarty 2006 p. 262: CRi = -158.5 dBW, antenna gain toward the SV 1.5 dB, implementation loss 2 dB,
  // NF 4.3 dB (Tant 100 K): C/N0 = 41.9 dB-Hz. Computed 41.885, published to one decimal, so 0.05.
  it('reproduces the Kaplan and Hegarty 41.9 dB-Hz example', () => {
    const tsys = systemNoiseTemperatureK({ noiseFigureDb: 4.3, antennaTemperatureK: 100 });
    const cn0 = calculateCn0({ signal: GPS_L1_CA, rxGainDbic: 1.5, implementationLossDb: 2 }, tsys);

    expect(cn0).toBeGreaterThan(41.85);
    expect(cn0).toBeLessThan(41.95);
    expect(calculateSignalPower({ signal: GPS_L1_CA, rxGainDbic: 1.5, implementationLossDb: 2 })).toBeCloseTo(-159, 12);
  });

  it('adds the power offset and referenced antenna gain linearly in dB', () => {
    const base = calculateSignalPower({ signal: GPS_L1_CA, rxGainDbic: 0 });

    expect(calculateSignalPower({ signal: GPS_L1_CA, rxGainDbic: 3, powerOffsetDb: -2 })).toBeCloseTo(base + 1, 12);
  });
});

describe('effective C/N0 (Kaplan and Hegarty 2006 Eq. 6.8 / 6.22)', () => {
  const rc = GPS_L1_CA.chipRateHz;

  // Hand check: 45 dB-Hz -> 28 dB-Hz with Q = 1: J/S = 10 log10(Q Rc (10^-2.8 - 10^-4.5))
  //   10^-2.8 = 1.58489e-3; 10^-4.5 = 3.16228e-5; difference 1.55327e-3; times 1.023e6 = 1588.99;
  //   10 log10(1588.99) = 32.01 dB. Verify to 0.01 dB.
  it('45 -> 28 dB-Hz needs J/S of 32.0 dB for Q = 1', () => {
    expect(calculateJammingToSignalForCn0(45, 28, 1, rc)).toBeCloseTo(32.01, 2);
  });

  it('inverts exactly: that J/S applied forward gives 28 dB-Hz', () => {
    const js = calculateJammingToSignalForCn0(45, 28, 1.5, rc);

    expect(calculateEffectiveCn0(45, [{ jOverCDb: js, q: 1.5 }], rc)).toBeCloseTo(28, 9);
  });

  // Kaplan and Hegarty 2006 Table 6.4 (28 dB-Hz threshold, C/A code): J/S at the antenna input
  // = Gsv - Gj + 10 log10[Q Rc (10^-2.8 - 10^(-CN0/10))], with Gsv = 1.5, Gj = -3 (so +4.5 dB), unjammed CN0 = 41.9.
  // Published to 0.1 dB, so 0.05.
  it.each([
    [2.22, 39.9], // BLWN, p. 264 worked example and Table 6.4
    [1.5, 38.2], // matched spectrum
    [1, 36.4], // narrowband
  ])('Table 6.4: Q = %s gives J/S %s dB', (q, expected) => {
    const js = 4.5 + calculateJammingToSignalForCn0(41.9, 28, q, rc);

    expect(Math.abs(js - expected)).toBeLessThan(0.05);
  });

  // Direct evaluation: 1/CN0 = 10^-4.5 = 3.1623e-5; J/C term = 10^3 / (1 * 1.023e6) = 9.7752e-4;
  // sum 1.00914e-3 -> -10 log10 = 29.961 dB-Hz.
  it('J/S 30 dB at Q = 1 takes 45 dB-Hz to 29.96 dB-Hz', () => {
    expect(calculateEffectiveCn0(45, [{ jOverCDb: 30, q: 1 }], rc)).toBeCloseTo(29.961, 2);
  });

  it('with no interference the effective C/N0 equals the unjammed value', () => {
    expect(calculateEffectiveCn0(41.9, [], rc)).toBeCloseTo(41.9, 12);
  });

  it('sums two equal interferers as 3.01 dB more J', () => {
    const one = calculateEffectiveCn0(45, [{ jOverCDb: 33.0103, q: 1.5 }], rc);
    const two = calculateEffectiveCn0(
      45,
      [
        { jOverCDb: 30, q: 1.5 },
        { jOverCDb: 30, q: 1.5 },
      ],
      rc,
    );

    // 10 log10(2) = 3.0103 dB.
    expect(two).toBeCloseTo(one, 4);
  });

  it('validates inputs', () => {
    expect(() => calculateEffectiveCn0(45, [{ jOverCDb: 0, q: 0 }], rc)).toThrow(ValidationError);
    expect(() => calculateJammingToSignalForCn0(30, 40, 1, rc)).toThrow(ValidationError);
  });
});

describe('jamming resistance factor Q', () => {
  const fs = GPS_L1_CA.carrierFrequencyHz;
  const bw = GPS_L1_CA.defaultReceiverBandwidthHz;

  it('narrowband jammer at the spectral peak: Q = 1 (Kaplan Table 6.2 / Eq. 6.13)', () => {
    const r = calculateJammingResistanceFactor(GPS_L1_CA, { centerFrequencyHz: fs, bandwidthHz: 0, spectralType: 'narrowband' }, bw);

    expect(r.q).toBeCloseTo(1, 12);
    expect(r.inBandFraction).toBe(1);
  });

  it('matched-spectrum jammer: Q = 1.5 (Kaplan Eq. 6.15)', () => {
    const r = calculateJammingResistanceFactor(GPS_L1_CA, { centerFrequencyHz: fs, bandwidthHz: 2.046e6, spectralType: 'matched' }, bw);

    expect(r.q).toBe(1.5);
  });

  // Kaplan and Hegarty p. 264 quote Q = 2.22 for BLWN 2 MHz (null to null) centred on C/A. Numerical integral
  // of sinc^2 over +-1 Rc gives Q = 2 / 0.9028 = 2.215; Kaplan rounds to 2.22, so tolerance 0.01.
  it('bandlimited noise 2.046 MHz centred on C/A gives Q = 2.22', () => {
    const r = calculateJammingResistanceFactor(GPS_L1_CA, { centerFrequencyHz: fs, bandwidthHz: 2.046e6, spectralType: 'bandlimited-noise' }, bw);

    expect(Math.abs(r.q - 2.22)).toBeLessThan(0.01);
    expect(r.inBandFraction).toBe(1);
  });

  // Kaplan Eq. 6.18: for a jammer much wider than the signal, Q Rc approaches the jammer bandwidth in the band.
  it('wide bandlimited noise: Q Rc is close to the in-band bandwidth', () => {
    const r = calculateJammingResistanceFactor(GPS_L1_CA, { centerFrequencyHz: fs, bandwidthHz: 20.46e6, spectralType: 'bandlimited-noise' }, bw);

    expect(r.q * GPS_L1_CA.chipRateHz).toBeGreaterThan(20.46e6);
    expect(r.q * GPS_L1_CA.chipRateHz).toBeLessThan(20.46e6 * 1.03);
  });

  it('a narrowband jammer on a sinc^2 null has infinite Q', () => {
    const r = calculateJammingResistanceFactor(
      GPS_L1_CA,
      { centerFrequencyHz: fs + GPS_L1_CA.chipRateHz, bandwidthHz: 0, spectralType: 'narrowband' },
      bw,
    );

    expect(r.q).toBe(Infinity);
  });

  it('out-of-band jammers contribute nothing; half-overlapping bands give half the power', () => {
    const out = calculateJammingResistanceFactor(GPS_L1_CA, { centerFrequencyHz: fs + 50e6, bandwidthHz: 1e6, spectralType: 'bandlimited-noise' }, bw);
    const outTone = calculateJammingResistanceFactor(GPS_L1_CA, { centerFrequencyHz: fs + 50e6, bandwidthHz: 0, spectralType: 'narrowband' }, bw);
    // Band centred on the receiver band edge: exactly half inside. 10.23 MHz = bw / 2.
    const half = calculateJammingResistanceFactor(GPS_L1_CA, { centerFrequencyHz: fs + bw / 2, bandwidthHz: 10e6, spectralType: 'bandlimited-noise' }, bw);

    expect(out.inBandFraction).toBe(0);
    expect(outTone.inBandFraction).toBe(0);
    expect(half.inBandFraction).toBeCloseTo(0.5, 12);
  });

  it('BOC signals use the stored Q values (Kaplan lower bounds 1.9 / 3 / 4.6) and qOverride wins', () => {
    const bwL1c = GPS_L1C.defaultReceiverBandwidthHz;
    const f = GPS_L1C.carrierFrequencyHz;

    expect(calculateJammingResistanceFactor(GPS_L1C, { centerFrequencyHz: f, bandwidthHz: 0, spectralType: 'narrowband' }, bwL1c).q).toBe(1.9);
    expect(calculateJammingResistanceFactor(GPS_L1C, { centerFrequencyHz: f, bandwidthHz: 1e6, spectralType: 'matched' }, bwL1c).q).toBe(3);
    expect(calculateJammingResistanceFactor(GPS_L1C, { centerFrequencyHz: f, bandwidthHz: 2e6, spectralType: 'bandlimited-noise' }, bwL1c).q).toBe(4.6);
    expect(calculateJammingResistanceFactor(GPS_L1C, { centerFrequencyHz: f, bandwidthHz: 2e6, spectralType: 'bandlimited-noise', qOverride: 7 }, bwL1c).q).toBe(7);
  });

  it('validates inputs', () => {
    const j = { centerFrequencyHz: fs, bandwidthHz: 1e6, spectralType: 'bandlimited-noise' as const };

    expect(() => calculateJammingResistanceFactor(GPS_L1_CA, j, 0)).toThrow(ValidationError);
    expect(() => calculateJammingResistanceFactor(GPS_L1_CA, { ...j, bandwidthHz: 0 }, bw)).toThrow(ValidationError);
    expect(() => calculateJammingResistanceFactor(GPS_L1_CA, { ...j, qOverride: -1 }, bw)).toThrow(ValidationError);
  });
});

describe('interferer at the receiver', () => {
  const rx = new GroundStation({ lat: 0 as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers, name: 'rx' });
  const lla = rx.lla();
  const antenna = GnssAntenna.typicalFrpa();
  const fs = GPS_L1_CA.carrierFrequencyHz;
  const bw = GPS_L1_CA.defaultReceiverBandwidthHz;
  const date = new Date('2026-03-09T12:00:00Z');

  // Emitter directly overhead at 10 km: slant range 10 km, elevation 90 degrees, antenna gain 1.5 dBic.
  // FSPL = 20 log10(4 pi d f / c) with d = 10 000 m, f = 1.57542 GHz = 20 log10(6.6192e5... ) computed independently below.
  it('uses free-space loss and the antenna gain toward the jammer', () => {
    const jammer = { position: { lat: 0 as Degrees, lon: 0 as Degrees, alt: 10 as Kilometers }, eirpDbw: 0, centerFrequencyHz: fs, bandwidthHz: 0, spectralType: 'narrowband' as const };
    const r = calculateInterfererAtReceiver(jammer, lla, antenna, GPS_L1_CA, bw, date);
    const fspl = 20 * Math.log10((4 * Math.PI * 10000 * fs) / C_M_S); // 116.4 dB

    expect(r.rangeKm).toBeCloseTo(10, 6);
    expect(r.el).toBeCloseTo(90, 4);
    // calculateFspl uses the rounded constant 87.55 (exact 87.5522), so 0.005 dB.
    expect(Math.abs(r.fsplDb - fspl)).toBeLessThan(0.005);
    expect(r.rxGainDbic).toBe(1.5);
    expect(r.jammerPowerDbw).toBeCloseTo(0 - fspl + 1.5, 2);
  });

  it('subtracts extra and polarization loss, adds EIRP, and applies the in-band fraction', () => {
    const base = { position: { lat: 0 as Degrees, lon: 0 as Degrees, alt: 10 as Kilometers }, eirpDbw: 0, centerFrequencyHz: fs, bandwidthHz: 0, spectralType: 'narrowband' as const };
    const p0 = calculateInterfererAtReceiver(base, lla, antenna, GPS_L1_CA, bw, date).jammerPowerDbw;
    const p1 = calculateInterfererAtReceiver({ ...base, eirpDbw: 10, extraLossDb: 4, polarizationLossDb: 3 }, lla, antenna, GPS_L1_CA, bw, date).jammerPowerDbw;
    const half = calculateInterfererAtReceiver(
      { ...base, centerFrequencyHz: fs + bw / 2, bandwidthHz: 10e6, spectralType: 'bandlimited-noise' },
      lla,
      antenna,
      GPS_L1_CA,
      bw,
      date,
    );

    expect(p1 - p0).toBeCloseTo(10 - 4 - 3, 9);
    // Same range and gain, but the band is half in-band (-3.0103 dB) and the carrier offset changes FSPL slightly.
    expect(half.jammerPowerDbw).toBeLessThan(p0 - 3);
  });

  it('accepts a ground object as the position and gives -Infinity power when out of band', () => {
    const gs = new GroundStation({ lat: 0 as Degrees, lon: 0 as Degrees, alt: 5 as Kilometers, name: 'j' });
    const inBand = calculateInterfererAtReceiver({ position: gs, eirpDbw: 0, centerFrequencyHz: fs, bandwidthHz: 0, spectralType: 'narrowband' }, lla, antenna, GPS_L1_CA, bw, date);
    const out = calculateInterfererAtReceiver({ position: gs, eirpDbw: 0, centerFrequencyHz: fs + 100e6, bandwidthHz: 0, spectralType: 'narrowband' }, lla, antenna, GPS_L1_CA, bw, date);

    expect(inBand.rangeKm).toBeCloseTo(5, 6);
    expect(out.jammerPowerDbw).toBe(-Infinity);
  });

  it('clamps a collocated emitter to a finite power and validates inputs', () => {
    const same = calculateInterfererAtReceiver(
      { position: lla, eirpDbw: 0, centerFrequencyHz: fs, bandwidthHz: 0, spectralType: 'narrowband' },
      lla,
      antenna,
      GPS_L1_CA,
      bw,
      date,
    );

    expect(Number.isFinite(same.jammerPowerDbw)).toBe(true);
    expect(() =>
      calculateInterfererAtReceiver({ position: lla, eirpDbw: NaN, centerFrequencyHz: fs, bandwidthHz: 0, spectralType: 'narrowband' }, lla, antenna, GPS_L1_CA, bw, date),
    ).toThrow(ValidationError);
    expect(() =>
      calculateInterfererAtReceiver({ position: lla, eirpDbw: 0, centerFrequencyHz: 0, bandwidthHz: 0, spectralType: 'narrowband' }, lla, antenna, GPS_L1_CA, bw, date),
    ).toThrow(ValidationError);
  });
});
