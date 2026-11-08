/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

import { calculateFspl, type Hertz } from '../comm/CommTypes';
import { ValidationError } from '../errors';
import type { GroundObject } from '../objects/GroundObject';
import { ecef2rae, lla2ecef } from '../transforms/transforms';
import type { Degrees, Kilometers, LlaVec3 } from '../types/types';
import type { GnssAntenna } from './GnssAntenna';
import type { GnssSignal } from './GnssSignal';

/** Boltzmann constant in J/K (CODATA 2018 exact value, SI 2019). */
export const BOLTZMANN_J_PER_K = 1.380649e-23;

/** Boltzmann constant in dBW/K/Hz, 10 log10(k), about -228.6. */
export const BOLTZMANN_DBW_PER_K_HZ = 10 * Math.log10(BOLTZMANN_J_PER_K);

/** Reference noise temperature T0 = 290 K at which noise figure is defined. */
export const NOISE_REFERENCE_TEMPERATURE_K = 290;

/** Jammer spectral shapes, in the sense of Kaplan and Hegarty (2006, Section 6.2, pp. 259 to 261). */
export type InterfererSpectralType =
  /** A single tone (Case 1, Eq. 6.13). Bandwidth is ignored. */
  | 'narrowband'
  /** A spectrum identical to the desired signal's (Case 2, Eq. 6.14). Centered on the signal. */
  | 'matched'
  /** Flat bandlimited noise centered on `centerFrequencyHz` (Case 3, Eq. 6.17). */
  | 'bandlimited-noise';

/** A radio-frequency interference source on or near the ground. */
export interface GnssInterferer {
  /** Where the emitter is: a ground object, or latitude and longitude in degrees and altitude in km. */
  position: GroundObject | LlaVec3<Degrees, Kilometers>;
  /** Effective isotropic radiated power in dBW, toward the receiver. */
  eirpDbw: number;
  /** Center frequency in Hz. */
  centerFrequencyHz: number;
  /** Emitted bandwidth in Hz (null to null for bandlimited noise). Ignored for `narrowband`. */
  bandwidthHz: number;
  /** Spectral shape; selects how the jamming resistance factor Q is derived. */
  spectralType: InterfererSpectralType;
  /** Extra path loss in dB beyond free space (terrain, clutter, buildings). Default 0. */
  extraLossDb?: number;
  /**
   * Polarization mismatch in dB between the emitter and the RHCP receive antenna. Kaplan and
   * Hegarty (2006, p. 263) note a linearly polarized jammer adds 3 dB or more. Default 0.
   */
  polarizationLossDb?: number;
  /** Overrides the derived jamming resistance factor Q (dimensionless, > 0). */
  qOverride?: number;
}

/** Receiver system noise given directly or built from a noise figure and antenna temperature. */
export type GnssNoiseSpec =
  | { systemTemperatureK: number }
  | { noiseFigureDb: number; antennaTemperatureK: number };

/**
 * System noise temperature in kelvin.
 *
 * Given directly it is returned unchanged. From a noise figure it is
 * `Tsys = Tant + Tamp`, `Tamp = 290 (10^(NF/10) - 1)` (Kaplan and Hegarty 2006, Eq. 6.23, p. 262),
 * with NF the amplifier noise figure at 290 K. Feed-line loss ahead of the amplifier is not
 * modelled; fold it into the noise figure.
 *
 * @param spec - Noise specification.
 * @returns System noise temperature in K.
 * @throws ValidationError if the temperature is not positive or the inputs are not finite.
 */
export function systemNoiseTemperatureK(spec: GnssNoiseSpec): number {
  let tsys: number;

  if ('systemTemperatureK' in spec) {
    tsys = spec.systemTemperatureK;
  } else {
    if (!Number.isFinite(spec.noiseFigureDb) || !Number.isFinite(spec.antennaTemperatureK)) {
      throw new ValidationError('Noise figure and antenna temperature must be finite', 'noise', spec);
    }
    tsys = spec.antennaTemperatureK + NOISE_REFERENCE_TEMPERATURE_K * (10 ** (spec.noiseFigureDb / 10) - 1);
  }

  if (!Number.isFinite(tsys) || tsys <= 0) {
    throw new ValidationError('System noise temperature must be positive', 'systemTemperatureK', tsys);
  }

  return tsys;
}

/**
 * Thermal noise power density N0 = k Tsys in dBW/Hz (Kaplan and Hegarty 2006, Eq. 6.23, p. 262).
 * @param systemTemperatureK - System noise temperature in K, > 0.
 * @returns N0 in dBW/Hz.
 */
export function noiseDensityDbwHz(systemTemperatureK: number): number {
  if (!(systemTemperatureK > 0)) {
    throw new ValidationError('System noise temperature must be positive', 'systemTemperatureK', systemTemperatureK);
  }

  return BOLTZMANN_DBW_PER_K_HZ + 10 * Math.log10(systemTemperatureK);
}

/** Inputs for {@link calculateSignalPower}. */
export interface SignalPowerInput {
  /** Signal definition (supplies the minimum power and its reference antenna). */
  signal: GnssSignal;
  /** Receive antenna gain toward the satellite in dBic. */
  rxGainDbic: number;
  /** Receiver implementation loss in dB (positive = loss), default 0. Kaplan's example uses 2 dB. */
  implementationLossDb?: number;
  /**
   * Caller power offset in dB added to the received power: positive for a satellite stronger than
   * the end-of-life minimum, negative for extra losses (foliage, atmosphere beyond the ICD
   * allowance). Default 0.
   */
  powerOffsetDb?: number;
}

/**
 * Recovered signal power C in dBW:
 * `C = Pmin - Gref + Grx - L + offset`, where Pmin is the interface document's minimum received
 * power measured with a reference antenna of gain Gref (dBic), Grx the receive antenna gain toward
 * the satellite (dBic), and L the implementation loss. With Gref = 0 dBic this is Kaplan and
 * Hegarty (2006, Eq. 6.23, p. 262), `Cs = CRi + GSV - L`.
 * @param input - See {@link SignalPowerInput}.
 * @returns Signal power in dBW.
 */
export function calculateSignalPower(input: SignalPowerInput): number {
  const { signal, rxGainDbic } = input;

  return (
    signal.minimumReceivedPowerDbw -
    signal.referenceAntennaGainDbic +
    rxGainDbic -
    (input.implementationLossDb ?? 0) +
    (input.powerOffsetDb ?? 0)
  );
}

/**
 * Unjammed carrier-to-noise-density ratio in dB-Hz, `C/N0 = C - 10 log10(k Tsys)` with
 * C from {@link calculateSignalPower}.
 * @param input - Signal power inputs.
 * @param systemTemperatureK - System noise temperature in K.
 * @returns C/N0 in dB-Hz.
 */
export function calculateCn0(input: SignalPowerInput, systemTemperatureK: number): number {
  return calculateSignalPower(input) - noiseDensityDbwHz(systemTemperatureK);
}

/**
 * Effective carrier-to-noise-density ratio under interference in dB-Hz:
 * `(C/N0)eff = [1/(C/N0) + (J/C) / (Q Rc)]^-1` (Kaplan and Hegarty 2006, Eq. 6.8, p. 257; in dB-Hz
 * Eq. 6.21, p. 261). `J/C` is the interference-to-signal power ratio inside the receiver, `Q` the
 * dimensionless jamming resistance factor and `Rc` the code chipping rate in chips per second.
 * Several interferers add their `(J/C)/Q` terms, which is the same as summing J when their Q agree.
 *
 * @param cn0DbHz - Unjammed C/N0 in dB-Hz.
 * @param terms - One entry per interferer: J/C in dB and Q (dimensionless).
 * @param chipRateHz - Spreading code chipping rate Rc in chips per second.
 * @returns Effective C/N0 in dB-Hz.
 */
export function calculateEffectiveCn0(
  cn0DbHz: number,
  terms: readonly { jOverCDb: number; q: number }[],
  chipRateHz: number,
): number {
  let inv = 10 ** (-cn0DbHz / 10);

  for (const t of terms) {
    if (!(t.q > 0)) {
      throw new ValidationError('Jamming resistance factor Q must be positive', 'q', t.q);
    }
    inv += 10 ** (t.jOverCDb / 10) / (t.q * chipRateHz);
  }

  return -10 * Math.log10(inv);
}

/**
 * Interference-to-signal ratio J/C in dB that brings an unjammed C/N0 down to a target effective
 * C/N0, the inverse of {@link calculateEffectiveCn0} for one interferer (Kaplan and Hegarty 2006,
 * Eq. 6.22, p. 262): `J/C = 10 log10[Q Rc (10^(-eff/10) - 10^(-cn0/10))]`.
 * @param cn0DbHz - Unjammed C/N0 in dB-Hz.
 * @param effectiveCn0DbHz - Target effective C/N0 in dB-Hz, must be below `cn0DbHz`.
 * @param q - Jamming resistance factor, dimensionless.
 * @param chipRateHz - Chipping rate Rc in chips per second.
 * @returns J/C in dB.
 */
export function calculateJammingToSignalForCn0(cn0DbHz: number, effectiveCn0DbHz: number, q: number, chipRateHz: number): number {
  if (!(effectiveCn0DbHz < cn0DbHz)) {
    throw new ValidationError('Target effective C/N0 must be below the unjammed C/N0', 'effectiveCn0DbHz', effectiveCn0DbHz);
  }

  return 10 * Math.log10(q * chipRateHz * (10 ** (-effectiveCn0DbHz / 10) - 10 ** (-cn0DbHz / 10)));
}

/**
 * Integral of sinc^2(x) = (sin(pi x) / (pi x))^2 from a to b, composite Simpson's rule.
 * About 200 panels per unit of x keeps the error below 1e-9 for the spans used here.
 */
function sincSquaredIntegral_(a: number, b: number): number {
  if (b <= a) {
    return 0;
  }

  const f = (x: number): number => {
    if (Math.abs(x) < 1e-9) {
      return 1;
    }
    const s = Math.sin(Math.PI * x) / (Math.PI * x);

    return s * s;
  };
  let n = Math.max(200, Math.ceil((b - a) * 200));

  if (n % 2 === 1) {
    n++;
  }
  const h = (b - a) / n;
  let sum = f(a) + f(b);

  for (let i = 1; i < n; i++) {
    sum += f(a + i * h) * (i % 2 === 1 ? 4 : 2);
  }

  return (sum * h) / 3;
}

/** Result of {@link calculateJammingResistanceFactor}. */
export interface JammingResistance {
  /** Jamming resistance quality factor Q, dimensionless. `Infinity` when the interferer sits in a spectral null. */
  q: number;
  /** Fraction (0 to 1) of the interferer's emitted power that falls inside the receiver bandwidth. */
  inBandFraction: number;
}

/**
 * Jamming resistance factor Q and in-band power fraction for an interferer against a signal.
 *
 * BPSK-R signals (PSD `S(f) = Tc sinc^2(f Tc)`, Kaplan and Hegarty 2006 Eq. 4.14) use the
 * receiver-filter-limited form of Eq. 6.12 with a unit-area interferer spectrum:
 * - narrowband: `Q = 1 / (Rc S(df))`, Eq. 6.13 (Q = 1 at the spectral peak);
 * - matched spectrum: `Q = 1.5`, Eq. 6.15;
 * - bandlimited noise: `Q = Bov / (Rc * integral of sinc^2 over the overlap)`, Eq. 6.17, with
 *   `Bov` the part of the interferer band inside the receiver band (the in-band spectrum is
 *   renormalized to unit area). This gives Q = 2.22 for a band centered on the signal and 2 Rc wide
 *   (Eq. 6.20) and `Q Rc = Bov` for a band much wider than the signal (Eq. 6.18).
 *
 * BOC signals use the fixed Q values stored on the signal (no spectrum model).
 *
 * The in-band fraction is `overlap / bandwidth` of the interferer band with the receiver band;
 * a narrowband or matched interferer is wholly in band when its center is inside the receiver band
 * and wholly out of band otherwise. Out-of-band leakage through the receiver filter skirts is not
 * modelled.
 *
 * @param signal - Desired signal.
 * @param interferer - Interferer spectrum fields (center frequency, bandwidth, type, optional Q).
 * @param receiverBandwidthHz - Receiver front-end bandwidth in Hz, centered on the signal carrier.
 * @returns Q and the in-band power fraction.
 * @throws ValidationError for non-positive bandwidths where required.
 */
export function calculateJammingResistanceFactor(
  signal: GnssSignal,
  interferer: Pick<GnssInterferer, 'centerFrequencyHz' | 'bandwidthHz' | 'spectralType' | 'qOverride'>,
  receiverBandwidthHz: number,
): JammingResistance {
  if (!(receiverBandwidthHz > 0)) {
    throw new ValidationError('Receiver bandwidth must be positive', 'receiverBandwidthHz', receiverBandwidthHz);
  }
  if (interferer.qOverride !== undefined && !(interferer.qOverride > 0)) {
    throw new ValidationError('qOverride must be positive', 'qOverride', interferer.qOverride);
  }

  const fs = signal.carrierFrequencyHz;
  const rc = signal.chipRateHz;
  const offset = interferer.centerFrequencyHz - fs;
  const halfRx = receiverBandwidthHz / 2;
  const type = interferer.spectralType;
  const withOverride = (q: number): number => interferer.qOverride ?? q;

  if (type === 'narrowband' || type === 'matched') {
    const inBand = Math.abs(offset) <= halfRx ? 1 : 0;
    let q: number;

    if (signal.modulation.kind === 'boc') {
      q = type === 'narrowband' ? signal.modulation.q.narrowband : signal.modulation.q.matched;
    } else if (type === 'matched') {
      q = 1.5;
    } else {
      const x = offset / rc;
      const sinc2 = Math.abs(x) < 1e-12 ? 1 : (Math.sin(Math.PI * x) / (Math.PI * x)) ** 2;

      q = sinc2 > 1e-12 ? 1 / sinc2 : Infinity;
    }

    return { q: withOverride(q), inBandFraction: inBand };
  }

  // Bandlimited noise.
  if (!(interferer.bandwidthHz > 0)) {
    throw new ValidationError('Bandlimited-noise interferer needs a positive bandwidth', 'bandwidthHz', interferer.bandwidthHz);
  }
  const lo = Math.max(offset - interferer.bandwidthHz / 2, -halfRx);
  const hi = Math.min(offset + interferer.bandwidthHz / 2, halfRx);
  const overlap = Math.max(0, hi - lo);

  if (overlap === 0) {
    return { q: withOverride(Infinity), inBandFraction: 0 };
  }

  const inBandFraction = overlap / interferer.bandwidthHz;

  if (signal.modulation.kind === 'boc') {
    return { q: withOverride(signal.modulation.q.bandlimitedNoise), inBandFraction };
  }

  const integral = sincSquaredIntegral_(lo / rc, hi / rc);

  return { q: withOverride(overlap / (rc * integral)), inBandFraction };
}

/** Interference at a receiver from one emitter. */
export interface InterfererReceived {
  /** Slant distance from the emitter to the receiver in km. */
  rangeKm: number;
  /** Azimuth from the receiver to the emitter in degrees. */
  az: number;
  /** Elevation of the emitter above the receiver's horizon in degrees (slightly negative for a ground emitter). */
  el: number;
  /** Free-space path loss in dB at the emitter's center frequency. */
  fsplDb: number;
  /** Receive antenna gain toward the emitter in dBic. */
  rxGainDbic: number;
  /** In-band power fraction (0 to 1). */
  inBandFraction: number;
  /** Jamming resistance factor Q. */
  q: number;
  /**
   * In-band interference power at the receive antenna output in dBW:
   * `EIRP - FSPL - extraLoss - polarizationLoss + Grx(toward emitter) + 10 log10(inBandFraction)`.
   * `-Infinity` when nothing is in band.
   */
  jammerPowerDbw: number;
}

/** Minimum emitter-to-receiver distance used in path loss, 1 m, so a collocated emitter is finite. */
export const MIN_INTERFERER_RANGE_KM = 0.001;

/**
 * Interference power from one emitter at a receiver's antenna output.
 *
 * Path loss is free space over the straight-line (ECEF) ground-to-ground slant distance plus the
 * caller's extra loss; Kaplan and Hegarty (2006, Eq. 6.24, p. 263) account for the antenna gain
 * toward the jammer, `GJ`, the same way. Distances under {@link MIN_INTERFERER_RANGE_KM} are
 * clamped (free space is not valid in the near field).
 *
 * @param interferer - The emitter.
 * @param receiverLla - Receiver position (degrees, degrees, km).
 * @param antenna - Receive antenna.
 * @param signal - Desired signal (for Q).
 * @param receiverBandwidthHz - Receiver front-end bandwidth in Hz.
 * @param date - Time at which a moving ground object's position is evaluated.
 * @returns The geometry, gain, Q and power. See {@link InterfererReceived}.
 * @throws ValidationError if the emitter has no position at `date` or invalid parameters.
 */
export function calculateInterfererAtReceiver(
  interferer: GnssInterferer,
  receiverLla: LlaVec3<Degrees, Kilometers>,
  antenna: GnssAntenna,
  signal: GnssSignal,
  receiverBandwidthHz: number,
  date: Date,
): InterfererReceived {
  if (!(interferer.centerFrequencyHz > 0)) {
    throw new ValidationError('Interferer center frequency must be positive', 'centerFrequencyHz', interferer.centerFrequencyHz);
  }
  if (!Number.isFinite(interferer.eirpDbw)) {
    throw new ValidationError('Interferer EIRP must be finite', 'eirpDbw', interferer.eirpDbw);
  }

  const pos = 'llaAt' in interferer.position ? interferer.position.llaAt(date) : interferer.position;

  if (!pos) {
    throw new ValidationError('Interferer has no position at this time', 'position', interferer.position);
  }

  const rxEcef = lla2ecef(receiverLla);
  const jEcef = lla2ecef(pos);
  const rangeKm = Math.hypot(jEcef.x - rxEcef.x, jEcef.y - rxEcef.y, jEcef.z - rxEcef.z);
  // A collocated emitter has no defined direction; use the horizon (a ground emitter) instead of NaN.
  const rae = rangeKm < MIN_INTERFERER_RANGE_KM ? { az: 0 as Degrees, el: 0 as Degrees } : ecef2rae(receiverLla, jEcef);
  const fsplDb = calculateFspl(Math.max(rangeKm, MIN_INTERFERER_RANGE_KM), interferer.centerFrequencyHz as Hertz);
  const rxGainDbic = antenna.getGainToward(rae.az, rae.el);
  const { q, inBandFraction } = calculateJammingResistanceFactor(signal, interferer, receiverBandwidthHz);
  const jammerPowerDbw =
    inBandFraction > 0
      ? interferer.eirpDbw -
        fsplDb -
        (interferer.extraLossDb ?? 0) -
        (interferer.polarizationLossDb ?? 0) +
        rxGainDbic +
        10 * Math.log10(inBandFraction)
      : -Infinity;

  return { rangeKm, az: rae.az, el: rae.el, fsplDb, rxGainDbic, inBandFraction, q, jammerPowerDbw };
}
