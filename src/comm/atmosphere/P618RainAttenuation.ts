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
import { Degrees, Kilometers } from '../../types/types';
import { Decibels, Hertz } from '../CommTypes';
import { rainCoefficients } from './P838RainCoefficients';
import { rainHeightFromLatitude } from './P839RainHeight';

/** Effective Earth radius used by P.618-14 eq 2 (km). */
const P618_EARTH_RADIUS_KM = 8500;

/** Highest frequency for which P.618-14 section 2.2.1.1 is stated (GHz). */
export const P618_MAX_GHZ = 55;
/** Lowest frequency accepted by the rain model (GHz), the lower limit of P.838-3. */
export const P618_MIN_GHZ = 1;

/** Inputs of the P.618-14 section 2.2.1.1 rain attenuation method. */
export interface RainAttenuationParams {
  /** Carrier frequency (Hz), 1 GHz to 55 GHz */
  frequency: Hertz;
  /** Path elevation angle (deg), 0 to 90 (the method has its own branch below 5 degrees) */
  elevation: Degrees;
  /** Polarisation tilt angle relative to the horizontal (deg): 0 horizontal, 90 vertical, 45 circular */
  polarizationTilt: Degrees;
  /**
   * Rain rate (mm/h). In P.618 this is R_0.01, the 1-minute rain rate exceeded for 0.01 percent of an average year.
   * A simulation may instead pass the rain rate of a chosen scenario; see the note on {@link rainAttenuation}.
   */
  rainRate: number;
  /** Station latitude (deg), -90 to 90; selects the vertical adjustment and the percentage correction */
  latitude: Degrees;
  /** Station height above mean sea level, h_s (km). Default 0. */
  stationAltitude?: Kilometers;
  /**
   * Rain height above mean sea level, h_R (km). Use {@link rainHeightFromIsotherm} with a P.839-4 map value for best
   * results. When omitted the rough P.839-2 latitude formula is used ({@link rainHeightFromLatitude}).
   */
  rainHeight?: Kilometers;
  /** Percentage of an average year the attenuation is exceeded, p (percent), 0.001 to 5. Default 0.01. */
  exceedancePercent?: number;
}

/** Intermediate values and result of the P.618-14 rain attenuation method (step numbers refer to section 2.2.1.1). */
export interface RainAttenuationResult {
  /** Rain height used, h_R (km above mean sea level), step 1 */
  rainHeight: Kilometers;
  /** Slant path length below the rain height, L_s (km), step 2 (eq 1 or 2) */
  slantLength: number;
  /** Horizontal projection of the slant length, L_G (km), step 3 (eq 3) */
  horizontalLength: number;
  /** Specific attenuation gamma_R (dB/km), step 5 (eq 4) */
  specificAttenuation: number;
  /** Horizontal reduction factor r_0.01, step 6 (eq 5) */
  horizontalReduction: number;
  /** Angle zeta (deg), step 7 */
  zeta: number;
  /** Slant path length through rain after reduction, L_R (km), step 7 */
  reducedLength: number;
  /** Vertical adjustment factor v_0.01, step 7 */
  verticalAdjustment: number;
  /** Effective path length L_E = L_R v_0.01 (km), step 8 (eq 6) */
  effectiveLength: number;
  /** Attenuation exceeded for 0.01 percent, A_0.01 = gamma_R L_E (dB), step 9 (eq 7) */
  attenuation001: Decibels;
  /** Exponent adjustment beta of the percentage conversion, step 10 */
  beta: number;
  /** Attenuation exceeded for the requested percentage, A_p (dB), step 10 (eq 8) */
  attenuation: Decibels;
}

const zeroResult_ = (rainHeight: Kilometers): RainAttenuationResult => ({
  rainHeight,
  slantLength: 0,
  horizontalLength: 0,
  specificAttenuation: 0,
  horizontalReduction: 0,
  zeta: 0,
  reducedLength: 0,
  verticalAdjustment: 0,
  effectiveLength: 0,
  attenuation001: 0 as Decibels,
  beta: 0,
  attenuation: 0 as Decibels,
});

/**
 * Rain attenuation on an Earth-space path, ITU-R P.618-14 (08/2023) section 2.2.1.1, steps 1 to 10, with the specific
 * attenuation from ITU-R P.838-3 and the rain height from ITU-R P.839 (see {@link rainHeightFromIsotherm}).
 *
 * Returns zero when the rain rate is zero or the rain height is not above the station.
 *
 * NOTE ON USE IN A SIMULATION. P.618 is a statistical method: R_0.01 is the rain rate exceeded for 0.01 percent of an
 * average year and A_p is the attenuation exceeded for p percent of the year. Passing an instantaneous scenario rain
 * rate (a "heavy shower" value, or a time series) as `rainRate` treats it as R_0.01 and returns the attenuation the
 * method predicts for that rate. That is a teaching and simulation simplification, not a prediction of the fade on a
 * particular day: the method's path-reduction factors are tuned to the statistics of rain cells. With the default
 * `exceedancePercent` (0.01) the result is A_0.01 for that rate.
 *
 * Validity: 1 to 55 GHz (P.618-14 states the method up to 55 GHz); eq 2 handles elevations below 5 degrees;
 * 0.001 <= p <= 5 percent.
 * @param params - Frequency, geometry, polarisation, rain rate and station data
 * @returns Intermediate values and A_p
 * @throws {ValidationError} If an input is non-finite or outside its range
 */
export const rainAttenuation = (params: RainAttenuationParams): RainAttenuationResult => {
  const fGHz = params.frequency / 1e9;
  const theta = params.elevation;
  const p = params.exceedancePercent ?? 0.01;
  const hs = params.stationAltitude ?? 0;

  if (!Number.isFinite(fGHz) || fGHz < P618_MIN_GHZ || fGHz > P618_MAX_GHZ) {
    throw new ValidationError('ITU-R P.618-14 rain attenuation is valid from 1 to 55 GHz', 'frequency', params.frequency);
  }
  if (!Number.isFinite(theta) || theta < 0 || theta > 90) {
    throw new ValidationError('Elevation must be between 0 and 90 degrees', 'elevation', theta);
  }
  if (!Number.isFinite(params.polarizationTilt)) {
    throw new ValidationError('Polarisation tilt must be a finite number of degrees', 'polarizationTilt', params.polarizationTilt);
  }
  if (!Number.isFinite(params.rainRate) || params.rainRate < 0) {
    throw new ValidationError('Rain rate must be zero or more (mm/h)', 'rainRate', params.rainRate);
  }
  if (!Number.isFinite(params.latitude) || Math.abs(params.latitude) > 90) {
    throw new ValidationError('Latitude must be between -90 and 90 degrees', 'latitude', params.latitude);
  }
  if (!Number.isFinite(hs)) {
    throw new ValidationError('Station altitude must be a finite number of km', 'stationAltitude', hs);
  }
  if (!Number.isFinite(p) || p < 0.001 || p > 5) {
    throw new ValidationError('Exceedance percentage must be between 0.001 and 5', 'exceedancePercent', p);
  }
  if (params.rainHeight !== undefined && (!Number.isFinite(params.rainHeight) || params.rainHeight < 0)) {
    throw new ValidationError('Rain height must be a non-negative number of km', 'rainHeight', params.rainHeight);
  }

  // Step 1
  const hR = params.rainHeight ?? rainHeightFromLatitude(params.latitude);
  const depth = hR - hs;

  if (depth <= 0 || params.rainRate === 0) {
    return zeroResult_(hR);
  }

  const thetaRad = (theta * Math.PI) / 180;
  const sinTheta = Math.sin(thetaRad);
  const cosTheta = Math.cos(thetaRad);

  // Step 2 (eq 1 or 2)
  const Ls = theta >= 5
    ? depth / sinTheta
    : (2 * depth) / (Math.sqrt(sinTheta * sinTheta + (2 * depth) / P618_EARTH_RADIUS_KM) + sinTheta);

  // Step 3 (eq 3)
  const LG = Ls * cosTheta;

  // Steps 4 and 5 (eq 4)
  const { k, alpha } = rainCoefficients(params.frequency, theta, params.polarizationTilt);
  const gammaR = k * params.rainRate ** alpha;

  // Step 6 (eq 5)
  const r001 = 1 / (1 + 0.78 * Math.sqrt((LG * gammaR) / fGHz) - 0.38 * (1 - Math.exp(-2 * LG)));

  // Step 7
  const zeta = (Math.atan(depth / (LG * r001)) * 180) / Math.PI;
  const LR = zeta > theta ? (LG * r001) / cosTheta : depth / sinTheta;
  const absLat = Math.abs(params.latitude);
  const chi = absLat < 36 ? 36 - absLat : 0;
  const v001 = 1 / (1 + Math.sqrt(sinTheta) * (31 * (1 - Math.exp(-(theta / (1 + chi)))) * (Math.sqrt(LR * gammaR) / (fGHz * fGHz)) - 0.45));

  // Steps 8 and 9 (eq 6, 7)
  const LE = LR * v001;
  const A001 = gammaR * LE;

  // Step 10 (eq 8)
  let beta = 0;

  if (p < 1 && absLat < 36) {
    beta = theta >= 25 ? -0.005 * (absLat - 36) : -0.005 * (absLat - 36) + 1.8 - 4.25 * sinTheta;
  }
  const Ap = A001 > 0
    ? A001 * (p / 0.01) ** -(0.655 + 0.033 * Math.log(p) - 0.045 * Math.log(A001) - beta * (1 - p) * sinTheta)
    : 0;

  return {
    rainHeight: hR,
    slantLength: Ls,
    horizontalLength: LG,
    specificAttenuation: gammaR,
    horizontalReduction: r001,
    zeta,
    reducedLength: LR,
    verticalAdjustment: v001,
    effectiveLength: LE,
    attenuation001: A001 as Decibels,
    beta,
    attenuation: Ap as Decibels,
  };
};

/** Inputs of the P.618-14 section 2.5 total attenuation combination. */
export interface TotalAttenuationParams {
  /** Rain attenuation A_R(p) (dB) */
  rain: Decibels;
  /** Cloud attenuation A_C(p) (dB) */
  cloud: Decibels;
  /** Gaseous attenuation A_G(p) (dB) */
  gas: Decibels;
  /** Tropospheric scintillation attenuation A_S(p) (dB), from P.618-14 eq 49. Default 0. */
  scintillation?: Decibels;
  /** Exceedance probability p (percent), 0.001 to 50 */
  exceedancePercent: number;
}

/**
 * Total attenuation from simultaneous sources, ITU-R P.618-14 section 2.5 (eq 65 and 66):
 * A_T = A_G + sqrt((A_R + A_C)^2 + A_S^2) for 0.001 <= p <= 5 percent, and
 * A_T = A_G + sqrt(A_C^2 + A_S^2) for 5 < p <= 50 percent (no rain term).
 *
 * The Recommendation says to hold A_C and A_G at their 5 percent values for p < 5; the caller supplies those.
 * This is the statistical combination rule. Because it adds rain and cloud linearly and only scintillation in
 * quadrature, it equals the plain sum A_G + A_R + A_C when A_S = 0, which is why an instantaneous scenario in
 * {@link atmosphericLossModel} reports each term and their sum instead.
 * @param params - Component attenuations and probability
 * @returns Total attenuation A_T (dB)
 * @throws {ValidationError} If a component is negative or non-finite, or p is outside 0.001 to 50 percent
 */
export const totalAttenuation = (params: TotalAttenuationParams): Decibels => {
  const { rain, cloud, gas, exceedancePercent: p } = params;
  const scint = params.scintillation ?? 0;

  for (const [name, v] of [['rain', rain], ['cloud', cloud], ['gas', gas], ['scintillation', scint]] as const) {
    if (!Number.isFinite(v) || v < 0) {
      throw new ValidationError(`${name} attenuation must be a non-negative number of dB`, name, v);
    }
  }
  if (!Number.isFinite(p) || p < 0.001 || p > 50) {
    throw new ValidationError('Exceedance percentage must be between 0.001 and 50', 'exceedancePercent', p);
  }

  const wet = p <= 5 ? rain + cloud : cloud;

  return (gas + Math.sqrt(wet * wet + scint * scint)) as Decibels;
};
