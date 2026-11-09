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

import { ValidationError } from '../../errors';
import { Degrees } from '../../types/types';
import { Hertz } from '../CommTypes';

/** Lowest frequency covered by ITU-R P.838-3 (GHz). */
export const P838_MIN_GHZ = 1;
/** Highest frequency covered by ITU-R P.838-3 (GHz). */
export const P838_MAX_GHZ = 1000;

/** Coefficients of one Gaussian-sum fit (P.838-3 eq 2 or 3). */
interface GaussianFit {
  a: readonly number[];
  b: readonly number[];
  c: readonly number[];
  m: number;
  cc: number;
}

/** P.838-3 Table 1, k_H. */
const K_H: GaussianFit = {
  a: [-5.3398, -0.35351, -0.23789, -0.94158],
  b: [-0.10008, 1.2697, 0.86036, 0.64552],
  c: [1.13098, 0.454, 0.15354, 0.16817],
  m: -0.18961,
  cc: 0.71147,
};

/** P.838-3 Table 2, k_V. */
const K_V: GaussianFit = {
  a: [-3.80595, -3.44965, -0.39902, 0.50167],
  b: [0.56934, -0.22911, 0.73042, 1.07319],
  c: [0.81061, 0.51059, 0.11899, 0.27195],
  m: -0.16398,
  cc: 0.63297,
};

/** P.838-3 Table 3, alpha_H. */
const ALPHA_H: GaussianFit = {
  a: [-0.14318, 0.29591, 0.32177, -5.3761, 16.1721],
  b: [1.82442, 0.77564, 0.63773, -0.9623, -3.2998],
  c: [-0.55187, 0.19822, 0.13164, 1.47828, 3.4399],
  m: 0.67849,
  cc: -1.95537,
};

/** P.838-3 Table 4, alpha_V. */
const ALPHA_V: GaussianFit = {
  a: [-0.07771, 0.56727, -0.20238, -48.2991, 48.5833],
  b: [2.3384, 0.95545, 1.1452, 0.791669, 0.791459],
  c: [-0.76284, 0.54039, 0.26809, 0.116226, 0.116479],
  m: -0.053739,
  cc: 0.83433,
};

/**
 * Evaluates one Gaussian sum: sum(a_j exp(-((x - b_j) / c_j)^2)) + m x + c, with x = log10(f).
 * @param fit - Coefficient table
 * @param x - log10 of the frequency in GHz
 * @returns The fitted value (log10 k for the k fits, alpha for the alpha fits)
 */
const evalFit_ = (fit: GaussianFit, x: number): number => {
  let sum = fit.m * x + fit.cc;

  for (let j = 0; j < fit.a.length; j++) {
    const z = (x - fit.b[j]) / fit.c[j];

    sum += fit.a[j] * Math.exp(-z * z);
  }

  return sum;
};

/** Rain specific attenuation coefficients of ITU-R P.838-3. */
export interface RainCoefficients {
  /** k for horizontal polarisation (dimensionless, for dB/km with R in mm/h) */
  kH: number;
  /** k for vertical polarisation */
  kV: number;
  /** alpha for horizontal polarisation */
  alphaH: number;
  /** alpha for vertical polarisation */
  alphaV: number;
  /** k for the requested elevation and polarisation tilt (P.838-3 eq 4) */
  k: number;
  /** alpha for the requested elevation and polarisation tilt (P.838-3 eq 5) */
  alpha: number;
}

/**
 * Rain coefficients k and alpha of ITU-R P.838-3 (03/2005), so that the specific attenuation is
 * gamma_R = k R^alpha (dB/km, R in mm/h).
 *
 * kH, kV, alphaH, alphaV come from the four-Gaussian (k, eq 2, Tables 1 and 2) and five-Gaussian (alpha, eq 3,
 * Tables 3 and 4) fits in log10(f). They are combined for an arbitrary path with eq 4 and 5:
 * k = [kH + kV + (kH - kV) cos^2(theta) cos(2 tau)] / 2 and
 * alpha = [kH aH + kV aV + (kH aH - kV aV) cos^2(theta) cos(2 tau)] / (2 k).
 *
 * Validity: 1 to 1000 GHz, any elevation, linear or circular polarisation.
 * @param frequency - Carrier frequency (Hz), 1 GHz to 1000 GHz
 * @param elevation - Path elevation angle (deg), -90 to 90
 * @param polarizationTilt - Polarisation tilt angle relative to the horizontal (deg): 0 horizontal, 90 vertical,
 * 45 circular
 * @returns The coefficients
 * @throws {ValidationError} If an argument is non-finite or the frequency is outside 1 to 1000 GHz
 */
export const rainCoefficients = (frequency: Hertz, elevation: Degrees, polarizationTilt: Degrees): RainCoefficients => {
  const fGHz = frequency / 1e9;

  if (!Number.isFinite(fGHz) || fGHz < P838_MIN_GHZ || fGHz > P838_MAX_GHZ) {
    throw new ValidationError('ITU-R P.838-3 is valid from 1 to 1000 GHz', 'frequency', frequency);
  }
  if (!Number.isFinite(elevation) || Math.abs(elevation) > 90) {
    throw new ValidationError('Elevation must be between -90 and 90 degrees', 'elevation', elevation);
  }
  if (!Number.isFinite(polarizationTilt)) {
    throw new ValidationError('Polarisation tilt must be a finite number of degrees', 'polarizationTilt', polarizationTilt);
  }

  const x = Math.log10(fGHz);
  const kH = 10 ** evalFit_(K_H, x);
  const kV = 10 ** evalFit_(K_V, x);
  const alphaH = evalFit_(ALPHA_H, x);
  const alphaV = evalFit_(ALPHA_V, x);
  const cosEl = Math.cos((elevation * Math.PI) / 180);
  const c = cosEl * cosEl * Math.cos((2 * polarizationTilt * Math.PI) / 180);
  const k = (kH + kV + (kH - kV) * c) / 2;
  const alpha = (kH * alphaH + kV * alphaV + (kH * alphaH - kV * alphaV) * c) / (2 * k);

  return { kH, kV, alphaH, alphaV, k, alpha };
};

/**
 * Rain specific attenuation gamma_R = k R^alpha (ITU-R P.838-3 eq 1).
 * @param frequency - Carrier frequency (Hz), 1 GHz to 1000 GHz
 * @param elevation - Path elevation angle (deg)
 * @param polarizationTilt - Polarisation tilt angle (deg): 0 horizontal, 90 vertical, 45 circular
 * @param rainRate - Rain rate (mm/h), zero or more
 * @returns Specific attenuation (dB/km)
 * @throws {ValidationError} If the rain rate is negative or non-finite, or the other arguments are invalid
 */
export const rainSpecificAttenuation = (
  frequency: Hertz,
  elevation: Degrees,
  polarizationTilt: Degrees,
  rainRate: number,
): number => {
  if (!Number.isFinite(rainRate) || rainRate < 0) {
    throw new ValidationError('Rain rate must be zero or more (mm/h)', 'rainRate', rainRate);
  }
  const { k, alpha } = rainCoefficients(frequency, elevation, polarizationTilt);

  return rainRate === 0 ? 0 : k * rainRate ** alpha;
};
