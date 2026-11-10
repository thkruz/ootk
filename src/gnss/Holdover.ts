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

import { ValidationError } from '../errors';

/** Power-law noise coefficients of the fractional-frequency PSD S_y(f) = sum h_a f^a (one-sided). */
export interface ClockNoiseCoefficients {
  /** White frequency modulation coefficient h0 (1/Hz, f^0 term). */
  h0: number;
  /** Random-walk frequency modulation coefficient h-2 (Hz, f^-2 term). */
  hMinus2: number;
}

/** Parameters of a {@link ClockModel}. */
export interface ClockModelParams {
  /** Time offset at the start of holdover, seconds. Default 0. */
  initialTimeOffsetSec?: number;
  /** Fractional frequency offset at the start of holdover, dimensionless (s/s). Default 0. */
  initialFrequencyOffset?: number;
  /** Aging (linear frequency drift) rate, 1/s (fractional frequency per second). Default 0. */
  agingPerSec?: number;
  /** Optional stochastic noise coefficients. Omit for a deterministic-only model. */
  noise?: ClockNoiseCoefficients;
  /** Sigma multiplier k in the bound |deterministic| + k*sigma. Default 3. */
  sigmaMultiplier?: number;
}

/** Plain-object form of {@link ClockModel}. */
export interface SerializedClockModel {
  initialTimeOffsetSec: number;
  initialFrequencyOffset: number;
  agingPerSec: number;
  noise: ClockNoiseCoefficients | null;
  sigmaMultiplier: number;
}

const SECONDS_PER_DAY = 86400;

/**
 * Receiver clock error model for GNSS holdover (time error after loss of fix).
 *
 * Deterministic part: x(t) = x0 + y0 t + 0.5 D t^2, with x0 the time offset (s), y0 the fractional
 * frequency offset (s/s) and D the aging rate (1/s). This is the standard quadratic clock-error
 * model (Kaplan and Hegarty 2006 App. B.1 names frequency offset, aging and random errors as the
 * clock error sources). The same quadratic form is stated in primary ITU-T texts: ITU-T G.810
 * (08/1996) Appendix I, clauses I.2 and I.3 (x(t) = x0 + (y0 - y_ref) t + D t^2 / 2 + random term, D
 * the linear fractional frequency drift rate); ITU-T G.812 (11/1988, superseded) Annex A.1 (y_bias t +
 * D t^2 / 2 + noise) and clause 2.2.3 (MRTIE(S) = a S + b S^2 / 2 + c); ITU-T G.8262.1 (11/2025)
 * clause 11.2 (T(t) <= a1 t + 0.5 b t^2 + c at constant temperature).
 *
 * Stochastic part (optional): the two-state clock model of Brown and Hwang (Introduction to Random
 * Signals and Applied Kalman Filtering), with process-noise densities q1 = h0 / 2 (s^2/s, white FM
 * driving phase) and q2 = 2 pi^2 h-2 (s^2/s^3, random-walk FM driving frequency). With a known
 * start state the time-error variance is
 *
 *   sigma_x^2(t) = q1 t + q2 t^3 / 3
 *
 * The h coefficients relate to the Allan variance by sigma_y^2(tau) = h0 / (2 tau) + (2 pi^2 / 3) h-2 tau
 * (flicker terms are not modelled), obtained from sigma_y^2(tau) = 2 integral S_y(f) sin^4(pi f tau)
 * / (pi f tau)^2 df (NIST SP 1065, Riley 2008, Eq. 65 and the Sec. 7.1 conversion table; Kaplan and
 * Hegarty 2006 App. B.2 defines the same power-law S_y(f)).
 *
 * The holdover bound is |x(t)| + k sigma_x(t), with k = {@link ClockModelParams.sigmaMultiplier}.
 */
export class ClockModel {
  readonly initialTimeOffsetSec: number;
  readonly initialFrequencyOffset: number;
  readonly agingPerSec: number;
  readonly noise: ClockNoiseCoefficients | null;
  readonly sigmaMultiplier: number;

  /**
   * @param params - Clock parameters, see {@link ClockModelParams}.
   * @throws ValidationError if a value is not finite, a noise coefficient is negative, or k is negative.
   */
  constructor(params: ClockModelParams = {}) {
    const x0 = params.initialTimeOffsetSec ?? 0;
    const y0 = params.initialFrequencyOffset ?? 0;
    const d = params.agingPerSec ?? 0;
    const k = params.sigmaMultiplier ?? 3;

    for (const [name, v] of [['initialTimeOffsetSec', x0], ['initialFrequencyOffset', y0], ['agingPerSec', d]] as const) {
      if (!Number.isFinite(v)) {
        throw new ValidationError(`${name} must be finite`, name, v);
      }
    }
    if (!Number.isFinite(k) || k < 0) {
      throw new ValidationError('sigmaMultiplier must be a finite number >= 0', 'sigmaMultiplier', k);
    }
    if (params.noise) {
      const { h0, hMinus2 } = params.noise;

      if (!Number.isFinite(h0) || h0 < 0 || !Number.isFinite(hMinus2) || hMinus2 < 0) {
        throw new ValidationError('Noise coefficients must be finite and >= 0', 'noise', params.noise);
      }
    }
    this.initialTimeOffsetSec = x0;
    this.initialFrequencyOffset = y0;
    this.agingPerSec = d;
    this.noise = params.noise ? { ...params.noise } : null;
    this.sigmaMultiplier = k;
  }

  /**
   * Builds noise coefficients from Allan deviations.
   * @param whiteFmSigma1s - Allan deviation at tau = 1 s attributed to white FM (dimensionless).
   * @param randomWalkSigma - Allan deviation attributed to random-walk FM at `randomWalkTauSec` (dimensionless).
   * @param randomWalkTauSec - tau for `randomWalkSigma`, seconds.
   * @returns Coefficients with h0 = 2 sigma1^2 and h-2 = 3 sigma_rw^2 / (2 pi^2 tau).
   * @throws ValidationError if a deviation is negative or tau is not positive.
   */
  static noiseFromAllan(whiteFmSigma1s: number, randomWalkSigma = 0, randomWalkTauSec = SECONDS_PER_DAY): ClockNoiseCoefficients {
    if (whiteFmSigma1s < 0 || randomWalkSigma < 0 || !(randomWalkTauSec > 0)) {
      throw new ValidationError('Allan deviations must be >= 0 and tau > 0', 'allan', { whiteFmSigma1s, randomWalkSigma, randomWalkTauSec });
    }

    return {
      h0: 2 * whiteFmSigma1s * whiteFmSigma1s,
      hMinus2: (3 * randomWalkSigma * randomWalkSigma) / (2 * Math.PI * Math.PI * randomWalkTauSec),
    };
  }

  /**
   * TCXO-class reference: only the initial frequency uncertainty is sourced. Kaplan and Hegarty 2006
   * Sec. 9.4.4: typical low-cost GNSS reference oscillators are in the 0.5 to 1 ppm range; the lower
   * bound 0.5 ppm is used. Aging and noise are NOT sourced and are left at zero, so the result is a
   * lower bound on error growth. Non-primary: the TCXO label is an interpretation of "low-cost
   * reference oscillator"; the textbook does not name TCXO.
   */
  static get TCXO(): ClockModel {
    return new ClockModel({ initialFrequencyOffset: 0.5e-6 });
  }

  /**
   * OCXO-class preset, PRIMARY source: ITU-T G.8262 (10/2024) clause 11.2.2 Table 15 (Option 2 EEC)
   * and, with identical numbers, ITU-T G.812 (06/2004) Table A.18 (Type IV): a1 = 50 ns/s initial
   * frequency offset, b = 4.63e-4 ns/s^2 aging (equation 11-3: T(S) <= (a1 + a2) S + 0.5 b S^2 + c),
   * c = 1000 ns phase offset at holdover entry. The temperature term a2 = 300 ns/s is excluded
   * (constant-temperature case, Note 2: "the term a2 S should not contribute"). This is the mask minus
   * its temperature allowance, i.e. a worst-case-compliant OCXO-based EEC, not a measured OCXO; the
   * "OCXO" label is an interpretation, the Recommendation does not name the oscillator technology.
   * Table 15 marks the applicable S as TBD. For the Option 1 mask (a1 = 50, b = 1.16e-4, c = 120 ns)
   * see {@link ClockModel.EEC_OPTION1_G8262}. Not the same as {@link ClockModel.ESEC_G8262_1}.
   */
  static get OCXO(): ClockModel {
    return new ClockModel({ initialTimeOffsetSec: 1000e-9, initialFrequencyOffset: 50e-9, agingPerSec: 4.63e-13 });
  }

  /**
   * Cesium preset from the GLONASS "Gem" standard Allan deviations (Kaplan and Hegarty 2006 Sec.
   * 11.1.5.1): 5e-11 at 1 s, 1e-11 at 100 s, 2.5e-12 at 1 h, 5e-13 at 1 day. h0 is fitted to the 1 s
   * point (2 sigma^2 = 5e-21) and h-2 to the residual variance at 1 day after subtracting the
   * white-FM share. The fit is NOT a published value; it under-predicts the 100 s point (5e-12 vs
   * 1e-11) because flicker FM is not modelled. The source gives no offset or aging (zero).
   */
  static get CESIUM(): ClockModel {
    const sigma1 = 5e-11;
    const tau = SECONDS_PER_DAY;
    const sigmaDay = 5e-13;
    const residual = sigmaDay * sigmaDay - (2 * sigma1 * sigma1) / (2 * tau);

    return new ClockModel({ noise: { h0: 2 * sigma1 * sigma1, hMinus2: (3 * residual) / (2 * Math.PI * Math.PI * tau) } });
  }

  /**
   * Enhanced Ethernet equipment clock (eSEC) holdover at constant temperature, PRIMARY source:
   * ITU-T G.8262.1 (11/2025) clause 11.2 "Long-term phase transient response (holdover)": a1 = 10 ns/s
   * (initial frequency offset, Note 1), b = 1.16e-4 ns/s^2 (aging, 1e-8/day, Note 3), c = 10 ns
   * (phase offset at holdover entry, Note 4). The temperature term a2 = 300 ns/s is excluded; per
   * Note 2 it "should not contribute" without temperature variation, and the clause gives the
   * constant-temperature limit T(t) <= a1 t + 0.5 b t^2 + c [ns]. The clause also bounds the
   * frequency offset to +-4.6 ppm, which this class does not enforce. This is the mask itself (a
   * worst-case limit), not a measured clock. The clause applies for t > S, S = 15 s (clause 11.1).
   */
  static get ESEC_G8262_1(): ClockModel {
    return new ClockModel({ initialTimeOffsetSec: 10e-9, initialFrequencyOffset: 10e-9, agingPerSec: 1.16e-13 });
  }

  /**
   * ITU-T G.8262 (10/2024) clause 11.2.1 Option 1 EEC holdover limit at constant temperature, PRIMARY:
   * a1 = 50 ns/s (Note 1: 5e-8), b = 1.16e-4 ns/s^2 (Note 3: 1e-8/day), c = 120 ns (Note 4), from
   * equation 11-1 T(S) <= (a1 + a2) S + 0.5 b S^2 + c with the temperature term a2 = 2000 ns/s
   * excluded (Note 2). Applies for S > 15 s; the clause also caps the frequency offset at +-4.6 ppm,
   * which this class does not enforce. A limit, not a measured clock.
   */
  static get EEC_OPTION1_G8262(): ClockModel {
    return new ClockModel({ initialTimeOffsetSec: 120e-9, initialFrequencyOffset: 50e-9, agingPerSec: 1.16e-13 });
  }

  /**
   * G.812 Type I holdover limit at constant temperature, PRIMARY: ITU-T G.812 (06/2004) clause 11.2.1
   * Table 24: a1 = 0.5 ns/s, b = 2.3e-6 ns/s^2, c = 60 ns; temperature term a2 = 2 ns/s excluded.
   * Form: dx(S) <= (a1 + a2) S + 0.5 b S^2 + c. A limit, not a measured clock.
   */
  static get G812_TYPE_I(): ClockModel {
    return new ClockModel({ initialTimeOffsetSec: 60e-9, initialFrequencyOffset: 0.5e-9, agingPerSec: 2.3e-15 });
  }

  /**
   * G.812 Type III holdover limit at constant temperature, PRIMARY: ITU-T G.812 (06/2004) clause 11.2.1
   * Table 24: a1 = 1.0 ns/s, b = 1.16e-5 ns/s^2, c = 150 ns; temperature term a2 = 10 ns/s excluded.
   * A limit, not a measured clock.
   */
  static get G812_TYPE_III(): ClockModel {
    return new ClockModel({ initialTimeOffsetSec: 150e-9, initialFrequencyOffset: 1e-9, agingPerSec: 1.16e-14 });
  }

  /**
   * Transit node clock holdover limit, PRIMARY: ITU-T G.812 (06/2004) Annex A, Type V ("the transit
   * node clock from the 1988 version"), Table A.18 (equals Table 1/G.812 of 11/1988): a1 = 0.5 ns/s,
   * b = 1.16e-5 ns/s^2, c = 1000 ns, applies for S > 100 s; a2 and d not applicable. A limit, not a
   * measured clock. The Recommendation does not name rubidium for any Type, so there is no RUBIDIUM label.
   */
  static get TRANSIT_NODE_G812_TYPE_V(): ClockModel {
    return new ClockModel({ initialTimeOffsetSec: 1000e-9, initialFrequencyOffset: 0.5e-9, agingPerSec: 1.16e-14 });
  }

  /**
   * Local node clock holdover limit, PRIMARY: ITU-T G.812 (06/2004) Annex A, Type VI, Table A.18:
   * a1 = 10 ns/s, b = 2.3e-4 ns/s^2, c = 1000 ns, applies for S > 100 s. See
   * {@link ClockModel.TRANSIT_NODE_G812_TYPE_V}.
   */
  static get LOCAL_NODE_G812_TYPE_VI(): ClockModel {
    return new ClockModel({ initialTimeOffsetSec: 1000e-9, initialFrequencyOffset: 10e-9, agingPerSec: 2.3e-13 });
  }

  /** Deterministic time error x0 + y0 t + 0.5 D t^2, seconds, at `t` seconds after holdover entry. */
  deterministicErrorAt(t: number): number {
    return this.initialTimeOffsetSec + this.initialFrequencyOffset * t + 0.5 * this.agingPerSec * t * t;
  }

  /** 1-sigma stochastic time error sqrt(q1 t + q2 t^3 / 3), seconds; 0 without noise coefficients. */
  sigmaAt(t: number): number {
    if (!this.noise || t <= 0) {
      return 0;
    }
    const q1 = this.noise.h0 / 2;
    const q2 = 2 * Math.PI * Math.PI * this.noise.hMinus2;

    return Math.sqrt(q1 * t + (q2 * t * t * t) / 3);
  }

  /**
   * Holdover time-error bound |x(t)| + k sigma(t), seconds.
   * @param secondsSinceLossOfFix - Time since holdover began, s (>= 0).
   * @throws ValidationError if the time is negative or not finite.
   */
  timeErrorAt(secondsSinceLossOfFix: number): number {
    if (!Number.isFinite(secondsSinceLossOfFix) || secondsSinceLossOfFix < 0) {
      throw new ValidationError('secondsSinceLossOfFix must be finite and >= 0', 'secondsSinceLossOfFix', secondsSinceLossOfFix);
    }

    return Math.abs(this.deterministicErrorAt(secondsSinceLossOfFix)) + this.sigmaMultiplier * this.sigmaAt(secondsSinceLossOfFix);
  }

  /**
   * First time, at or after `fromSec`, at which the holdover bound reaches a threshold.
   * The bound need not be monotonic: a signed offset and an opposing drift can start above the
   * threshold, fall below it and cross it again later, so the search starts at `fromSec` rather
   * than at loss of fix. Closed form (smallest root of x(t) = +-threshold after `fromSec`) without
   * a stochastic term, otherwise a geometric scan with bisection on the bracketing step.
   * @param thresholdSeconds - Time-error threshold, s (> 0).
   * @param fromSec - Earliest time to consider, s since loss of fix (>= 0, default 0).
   * @returns Seconds since loss of fix, `fromSec` if already at or above it then, Infinity if never reached.
   * @throws ValidationError if the threshold is not positive or `fromSec` is negative or not finite.
   */
  timeToExceed(thresholdSeconds: number, fromSec = 0): number {
    if (!(thresholdSeconds > 0)) {
      throw new ValidationError('thresholdSeconds must be > 0', 'thresholdSeconds', thresholdSeconds);
    }
    if (this.timeErrorAt(fromSec) >= thresholdSeconds) {
      return fromSec;
    }
    if (!this.noise || this.sigmaMultiplier === 0) {
      return this.deterministicRoot_(thresholdSeconds, fromSec);
    }

    return this.numericRoot_(thresholdSeconds, fromSec);
  }

  /** Plain-object form for storage. */
  serialize(): SerializedClockModel {
    return {
      initialTimeOffsetSec: this.initialTimeOffsetSec,
      initialFrequencyOffset: this.initialFrequencyOffset,
      agingPerSec: this.agingPerSec,
      noise: this.noise ? { ...this.noise } : null,
      sigmaMultiplier: this.sigmaMultiplier,
    };
  }

  /** Recreates a model from {@link ClockModel.serialize} output. */
  static deserialize(data: SerializedClockModel): ClockModel {
    return new ClockModel({ ...data, noise: data.noise ?? undefined });
  }

  private deterministicRoot_(threshold: number, fromSec: number): number {
    const a = 0.5 * this.agingPerSec;
    const b = this.initialFrequencyOffset;
    let best = Infinity;

    for (const target of [threshold, -threshold]) {
      const c = this.initialTimeOffsetSec - target;
      let roots: number[];

      if (a === 0) {
        roots = b === 0 ? [] : [-c / b];
      } else {
        const disc = b * b - 4 * a * c;

        roots = disc < 0 ? [] : [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)];
      }
      for (const r of roots) {
        if (r > fromSec && r < best) {
          best = r;
        }
      }
    }

    return best;
  }

  private numericRoot_(threshold: number, fromSec: number): number {
    const tMax = fromSec + 1e12;
    let lo = fromSec;
    let hi = fromSec + 1e-3;

    while (hi <= tMax) {
      if (this.timeErrorAt(hi) >= threshold) {
        for (let i = 0; i < 200; i++) {
          const mid = 0.5 * (lo + hi);

          if (this.timeErrorAt(mid) >= threshold) {
            hi = mid;
          } else {
            lo = mid;
          }
        }

        return hi;
      }
      lo = hi;
      hi = fromSec + (hi - fromSec) * 1.05;
    }

    return Infinity;
  }
}
