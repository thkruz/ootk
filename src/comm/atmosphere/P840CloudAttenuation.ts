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
import { Decibels, Hertz } from '../CommTypes';

/** Lowest frequency of ITU-R P.840-9 (GHz). */
export const P840_MIN_GHZ = 1;
/** Highest frequency of ITU-R P.840-9 (GHz). */
export const P840_MAX_GHZ = 200;
/** Lowest elevation for which P.840-9 states the slant-path method (deg). */
export const P840_MIN_ELEVATION_DEG = 5;

/** Reference cloud liquid water temperature of the slant-path coefficient K_L, P.840-9 eq 12 (K). */
const KL_REFERENCE_TEMPERATURE_K = 273.75;

/** Complex relative permittivity of liquid water from the double-Debye model. */
export interface WaterPermittivity {
  /** Real part eps' */
  real: number;
  /** Imaginary part eps'' */
  imaginary: number;
}

/**
 * Complex permittivity of liquid water by the double-Debye model of ITU-R P.840-9 (08/2023) section 2, equations 4 to
 * 10: eps0 = 77.66 + 103.3 (theta - 1), eps1 = 0.0671 eps0, eps2 = 3.52, fp = 20.20 - 146 (theta - 1) +
 * 316 (theta - 1)^2 GHz, fs = 39.8 fp, with theta = 300 / T.
 * @param frequency - Frequency (Hz), 1 GHz to 200 GHz
 * @param temperature - Liquid water temperature T (K), greater than 0
 * @returns The real and imaginary permittivity
 * @throws {ValidationError} If an argument is non-finite or outside its range
 */
export const waterPermittivity = (frequency: Hertz, temperature: number): WaterPermittivity => {
  const f = frequency / 1e9;

  if (!Number.isFinite(f) || f < P840_MIN_GHZ || f > P840_MAX_GHZ) {
    throw new ValidationError('ITU-R P.840-9 cloud attenuation is valid from 1 to 200 GHz', 'frequency', frequency);
  }
  if (!Number.isFinite(temperature) || temperature <= 0) {
    throw new ValidationError('Temperature must be a positive number of kelvin', 'temperature', temperature);
  }

  const th = 300 / temperature - 1;
  const eps0 = 77.66 + 103.3 * th;
  const eps1 = 0.0671 * eps0;
  const eps2 = 3.52;
  const fp = 20.2 - 146 * th + 316 * th * th;
  const fs = 39.8 * fp;

  return {
    real: (eps0 - eps1) / (1 + (f / fp) ** 2) + (eps1 - eps2) / (1 + (f / fs) ** 2) + eps2,
    imaginary: (f * (eps0 - eps1)) / (fp * (1 + (f / fp) ** 2)) + (f * (eps1 - eps2)) / (fs * (1 + (f / fs) ** 2)),
  };
};

/**
 * Specific attenuation coefficient of cloud liquid water K_l, ITU-R P.840-9 eq 2 and 3:
 * K_l = 0.819 f / (eps'' (1 + eta^2)), eta = (2 + eps') / eps''. Cloud specific attenuation is gamma_c = K_l M with
 * M the liquid water density (g/m^3).
 * @param frequency - Frequency (Hz), 1 GHz to 200 GHz
 * @param temperature - Liquid water temperature T (K), greater than 0
 * @returns K_l ((dB/km)/(g/m^3))
 * @throws {ValidationError} If an argument is non-finite or outside its range
 */
export const cloudSpecificAttenuationCoefficient = (frequency: Hertz, temperature: number): number => {
  const { real, imaginary } = waterPermittivity(frequency, temperature);
  const eta = (2 + real) / imaginary;

  return (0.819 * (frequency / 1e9)) / (imaginary * (1 + eta * eta));
};

/**
 * Mass absorption coefficient K_L of integrated cloud liquid water, ITU-R P.840-9 eq 12:
 * K_L = K_l(f, 273.75 K) [a1 exp(-(f - b1)^2 / c1) + a2 exp(-(f - b2)^2 / c2) + a3], with a1 = 0.1522, a2 = 11.51,
 * a3 = -10.4912, b1 = -23.9589, b2 = 219.2096, c1 = 3.2991e3, c2 = 2.7595e6 (f in GHz). The bracket is the correction
 * of the -9 edition that accounts for the temperature spread of real clouds.
 * @param frequency - Frequency (Hz), 1 GHz to 200 GHz
 * @returns K_L ((dB/km)/(g/m^3), equivalently dB per kg/m^2 of column)
 * @throws {ValidationError} If the frequency is non-finite or outside 1 to 200 GHz
 */
export const cloudMassAbsorptionCoefficient = (frequency: Hertz): number => {
  const f = frequency / 1e9;
  const kl = cloudSpecificAttenuationCoefficient(frequency, KL_REFERENCE_TEMPERATURE_K);

  return kl * (0.1522 * Math.exp(-((f + 23.9589) ** 2) / 3.2991e3) + 11.51 * Math.exp(-((f - 219.2096) ** 2) / 2.7595e6) - 10.4912);
};

/** Inputs of {@link cloudAttenuation}. */
export interface CloudAttenuationParams {
  /** Frequency (Hz), 1 GHz to 200 GHz */
  frequency: Hertz;
  /** Elevation angle (deg), 5 to 90 */
  elevation: Degrees;
  /** Integrated (columnar) cloud liquid water content L (kg/m^2, equal to mm of water), 0 or more */
  cloudLiquidWater: number;
}

/**
 * Cloud attenuation along an Earth-space path, ITU-R P.840-9 section 3.1 (eq 11): A_c = L K_L(f) / sin(theta).
 *
 * The Recommendation obtains L for a chosen exceedance probability from digital maps; this function takes L directly
 * (the caller picks a value), as the maps are not bundled. Using the same L for any p gives the instantaneous form.
 * Valid for 1 to 200 GHz and elevations of 5 to 90 degrees.
 * @param params - Frequency, elevation and liquid water column
 * @returns Cloud attenuation (dB)
 * @throws {ValidationError} If an argument is non-finite or outside its range
 */
export const cloudAttenuation = (params: CloudAttenuationParams): Decibels => {
  const { elevation, cloudLiquidWater: L } = params;

  if (!Number.isFinite(elevation) || elevation < P840_MIN_ELEVATION_DEG || elevation > 90) {
    throw new ValidationError('ITU-R P.840-9 slant-path cloud attenuation is valid for elevations of 5 to 90 degrees', 'elevation', elevation);
  }
  if (!Number.isFinite(L) || L < 0) {
    throw new ValidationError('Cloud liquid water must be zero or more kg/m^2', 'cloudLiquidWater', L);
  }

  return ((L * cloudMassAbsorptionCoefficient(params.frequency)) / Math.sin((elevation * Math.PI) / 180)) as Decibels;
};
