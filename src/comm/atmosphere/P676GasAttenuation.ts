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
import { P676_ANNEX2_OXYGEN_TABLE } from './P676Annex2Data';
import { P676_OXYGEN_LINES, P676_WATER_VAPOR_LINES } from './P676Lines';
import { P835_TOP_KM, referenceAtmosphere } from './P835ReferenceAtmosphere';

/** Lowest frequency of the P.676-13 Annex 1 line-by-line method (GHz). */
export const P676_MIN_GHZ = 1;
/** Highest frequency of the P.676-13 Annex 1 line-by-line method (GHz). */
export const P676_MAX_GHZ = 1000;
/** Highest frequency of the P.676-13 Annex 2 approximate method (GHz). */
export const P676_ANNEX2_MAX_GHZ = 350;

/** Specific attenuation of dry air and water vapour (dB/km). */
export interface GasSpecificAttenuation {
  /** Dry air (oxygen) specific attenuation gamma_o (dB/km) */
  oxygen: number;
  /** Water vapour specific attenuation gamma_w (dB/km) */
  waterVapour: number;
  /** gamma_o + gamma_w (dB/km) */
  total: number;
}

const checkFrequency_ = (fGHz: number, max: number, frequency: number): void => {
  if (!Number.isFinite(fGHz) || fGHz < P676_MIN_GHZ || fGHz > max) {
    throw new ValidationError(`ITU-R P.676-13 gaseous attenuation is valid from 1 to ${max} GHz here`, 'frequency', frequency);
  }
};

/**
 * Specific attenuation of dry air and water vapour by the line-by-line summation of ITU-R P.676-13 (08/2022)
 * Annex 1, equations 1 to 9: 44 oxygen lines (Table 1) with the Zeeman and interference corrections and the
 * non-resonant Debye spectrum, plus 35 water vapour lines (Table 2, the last is the 1780 GHz pseudo-line).
 * gamma = 0.182 f (N''_oxygen + N''_water).
 *
 * @param frequency - Frequency (Hz), 1 GHz to 1000 GHz
 * @param dryPressure - Dry air pressure p (hPa), excluding water vapour; must be greater than 0
 * @param vapourPressure - Water vapour partial pressure e (hPa), 0 or more
 * @param temperature - Temperature T (K), greater than 0
 * @returns Oxygen, water vapour and total specific attenuation (dB/km)
 * @throws {ValidationError} If an argument is non-finite or outside its range
 */
export const gasSpecificAttenuation = (
  frequency: Hertz,
  dryPressure: number,
  vapourPressure: number,
  temperature: number,
): GasSpecificAttenuation => {
  const f = frequency / 1e9;

  checkFrequency_(f, P676_MAX_GHZ, frequency);
  if (!Number.isFinite(dryPressure) || dryPressure <= 0) {
    throw new ValidationError('Dry pressure must be a positive number of hPa', 'dryPressure', dryPressure);
  }
  if (!Number.isFinite(vapourPressure) || vapourPressure < 0) {
    throw new ValidationError('Vapour pressure must be zero or more hPa', 'vapourPressure', vapourPressure);
  }
  if (!Number.isFinite(temperature) || temperature <= 0) {
    throw new ValidationError('Temperature must be a positive number of kelvin', 'temperature', temperature);
  }

  const p = dryPressure;
  const e = vapourPressure;
  const th = 300 / temperature;
  let No = 0;
  let Nw = 0;

  for (const [fi, a1, a2, a3, a4, a5, a6] of P676_OXYGEN_LINES) {
    const S = a1 * 1e-7 * p * th ** 3 * Math.exp(a2 * (1 - th));
    let df = a3 * 1e-4 * (p * th ** (0.8 - a4) + 1.1 * e * th);

    df = Math.sqrt(df * df + 2.25e-6);
    const d = (a5 + a6 * th) * 1e-4 * (p + e) * th ** 0.8;
    const F = (f / fi) * ((df - d * (fi - f)) / ((fi - f) ** 2 + df * df) + (df - d * (fi + f)) / ((fi + f) ** 2 + df * df));

    No += S * F;
  }
  const dd = 5.6e-4 * (p + e) * th ** 0.8;

  No += f * p * th * th * (6.14e-5 / (dd * (1 + (f / dd) ** 2)) + (1.4e-12 * p * th ** 1.5) / (1 + 1.9e-5 * f ** 1.5));

  for (const [fi, b1, b2, b3, b4, b5, b6] of P676_WATER_VAPOR_LINES) {
    const S = b1 * 1e-1 * e * th ** 3.5 * Math.exp(b2 * (1 - th));
    let df = b3 * 1e-4 * (p * th ** b4 + b5 * e * th ** b6);

    df = 0.535 * df + Math.sqrt(0.217 * df * df + (2.1316e-12 * fi * fi) / th);
    const F = (f / fi) * (df / ((fi - f) ** 2 + df * df) + df / ((fi + f) ** 2 + df * df));

    Nw += S * F;
  }

  const oxygen = 0.182 * f * No;
  const waterVapour = 0.182 * f * Nw;

  return { oxygen, waterVapour, total: oxygen + waterVapour };
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Annex 1 slant path                                                                                                  */
/* ------------------------------------------------------------------------------------------------------------------ */

const EARTH_RADIUS_KM = 6371;
const N_OXYGEN = P676_OXYGEN_LINES.length;
const N_WATER = P676_WATER_VAPOR_LINES.length;

/** Frequency-independent data of one atmosphere layer table, built once per (h1, h2). */
interface LayerTable {
  count: number;
  /** Layer thickness delta_i (km) */
  delta: Float64Array;
  /** Radius of the layer bottom, 6371 + h_i (km) */
  radius: Float64Array;
  /** Refractive index of each layer, eq 14 / P.453 */
  index: Float64Array;
  /** Dry pressure p, vapour pressure e, theta = 300/T at the layer mid height */
  pDry: Float64Array;
  e: Float64Array;
  theta: Float64Array;
  /** Oxygen line strength S, width df (after Zeeman) and interference d, count x 44 */
  oS: Float64Array;
  oDf: Float64Array;
  oD: Float64Array;
  /** Non-resonant dry-air terms: width dd and p theta^2, p theta^2.5 style factors */
  ndDd: Float64Array;
  ndP: Float64Array;
  ndQ: Float64Array;
  /** Water line strength S and width df, count x 35 */
  wS: Float64Array;
  wDf: Float64Array;
}

const TABLE_CACHE_LIMIT = 6;
const tableCache_ = new Map<string, LayerTable>();

const buildTable_ = (h1: number, h2: number): LayerTable => {
  const k = Math.exp(0.01);
  const standard = h1 === 0 && h2 === P835_TOP_KM;
  const imin = standard ? 1 : Math.floor(100 * Math.log(1e4 * h1 * (k - 1) + 1) + 1);
  const imax = standard ? 923 : Math.ceil(100 * Math.log(1e4 * h2 * (k - 1) + 1) + 1);
  const d0 = standard ? 0.0001 : ((h2 - h1) * (k - 1)) / (Math.exp((imax - 1) / 100) - Math.exp((imin - 1) / 100));
  const count = imax - imin;

  const t: LayerTable = {
    count,
    delta: new Float64Array(count),
    radius: new Float64Array(count),
    index: new Float64Array(count),
    pDry: new Float64Array(count),
    e: new Float64Array(count),
    theta: new Float64Array(count),
    oS: new Float64Array(count * N_OXYGEN),
    oDf: new Float64Array(count * N_OXYGEN),
    oD: new Float64Array(count * N_OXYGEN),
    ndDd: new Float64Array(count),
    ndP: new Float64Array(count),
    ndQ: new Float64Array(count),
    wS: new Float64Array(count * N_WATER),
    wDf: new Float64Array(count * N_WATER),
  };

  for (let j = 0; j < count; j++) {
    const i = imin + j;
    const delta = d0 * Math.exp((i - 1) / 100);
    const hi = standard
      ? (0.0001 * (Math.exp((i - 1) / 100) - 1)) / (k - 1)
      : h1 + (d0 * (Math.exp((i - 1) / 100) - Math.exp((imin - 1) / 100))) / (k - 1);
    const mid = Math.min(P835_TOP_KM, hi + delta / 2);
    const atm = referenceAtmosphere(mid as Kilometers);
    const p = atm.dryPressure;
    const e = atm.vapourPressure;
    const T = atm.temperature;
    const th = 300 / T;

    t.delta[j] = delta;
    t.radius[j] = EARTH_RADIUS_KM + hi;
    t.index[j] = 1 + (77.6 * p / T + 72 * e / T + (3.75e5 * e) / (T * T)) * 1e-6;
    t.pDry[j] = p;
    t.e[j] = e;
    t.theta[j] = th;

    for (let m = 0; m < N_OXYGEN; m++) {
      const [, a1, a2, a3, a4, a5, a6] = P676_OXYGEN_LINES[m];
      const df = a3 * 1e-4 * (p * th ** (0.8 - a4) + 1.1 * e * th);

      t.oS[j * N_OXYGEN + m] = a1 * 1e-7 * p * th ** 3 * Math.exp(a2 * (1 - th));
      t.oDf[j * N_OXYGEN + m] = Math.sqrt(df * df + 2.25e-6);
      t.oD[j * N_OXYGEN + m] = (a5 + a6 * th) * 1e-4 * (p + e) * th ** 0.8;
    }
    t.ndDd[j] = 5.6e-4 * (p + e) * th ** 0.8;
    t.ndP[j] = p * th * th;
    t.ndQ[j] = 1.4e-12 * p * th ** 1.5;

    for (let m = 0; m < N_WATER; m++) {
      const [fi, b1, b2, b3, b4, b5, b6] = P676_WATER_VAPOR_LINES[m];
      const df = b3 * 1e-4 * (p * th ** b4 + b5 * e * th ** b6);

      t.wS[j * N_WATER + m] = b1 * 1e-1 * e * th ** 3.5 * Math.exp(b2 * (1 - th));
      t.wDf[j * N_WATER + m] = 0.535 * df + Math.sqrt(0.217 * df * df + (2.1316e-12 * fi * fi) / th);
    }
  }

  return t;
};

const getTable_ = (h1: number, h2: number): LayerTable => {
  const key = `${h1}|${h2}`;
  const hit = tableCache_.get(key);

  if (hit) {
    tableCache_.delete(key);
    tableCache_.set(key, hit);

    return hit;
  }
  const built = buildTable_(h1, h2);

  tableCache_.set(key, built);
  if (tableCache_.size > TABLE_CACHE_LIMIT) {
    const oldest = tableCache_.keys().next().value;

    if (oldest !== undefined) {
      tableCache_.delete(oldest);
    }
  }

  return built;
};

/** Options for {@link gasSlantAttenuation}. */
export interface GasSlantOptions {
  /** Station height above mean sea level, h_1 (km), 0 or more and below the top. Default 0. */
  stationAltitude?: Kilometers;
  /** Top of the integrated atmosphere, h_2 (km), above the station and at most 100. Default 100. */
  topAltitude?: Kilometers;
}

/**
 * Total gaseous attenuation along a slant path through the ITU-R P.835-6 mean annual global reference atmosphere,
 * ITU-R P.676-13 Annex 1 section 2.2.1 (equations 13 to 19). The atmosphere is divided into 922 layers of thickness
 * delta_i = 0.0001 exp((i - 1)/100) km (for a station above the surface, the layer grid of eq 16a to 16d), the specific
 * attenuation of each layer comes from {@link gasSpecificAttenuation} at the layer mid-height, and the path length
 * a_i in each layer comes from ray tracing with refraction (eq 17 to 19, refractive index from eq 14).
 * A = sum gamma_i a_i.
 *
 * This is valid at ALL elevations from 0 to 90 degrees, including below 5 degrees where the Annex 2 approximation is
 * not. The elevation is treated as the apparent (refracted) elevation at the station, as in the Recommendation.
 * Because it uses a fixed standard atmosphere it carries no site weather; it is the average clear-sky value.
 *
 * Implementation note: the layer-dependent, frequency-independent line parameters are built once per (h_1, h_2) and
 * cached, so repeated calls cost a few hundred microseconds.
 * @param frequency - Frequency (Hz), 1 GHz to 1000 GHz
 * @param elevation - Apparent elevation angle at the station (deg), 0 to 90
 * @param options - Optional station height and top of the atmosphere
 * @returns Slant-path gaseous attenuation (dB)
 * @throws {ValidationError} If an argument is non-finite or outside its range
 */
export const gasSlantAttenuation = (frequency: Hertz, elevation: Degrees, options: GasSlantOptions = {}): Decibels => {
  const f = frequency / 1e9;
  const h1 = options.stationAltitude ?? 0;
  const h2 = options.topAltitude ?? P835_TOP_KM;

  checkFrequency_(f, P676_MAX_GHZ, frequency);
  if (!Number.isFinite(elevation) || elevation < 0 || elevation > 90) {
    throw new ValidationError('Elevation must be between 0 and 90 degrees', 'elevation', elevation);
  }
  if (!Number.isFinite(h1) || h1 < 0 || h1 >= P835_TOP_KM) {
    throw new ValidationError('Station altitude must be at least 0 and below 100 km', 'stationAltitude', h1);
  }
  if (!Number.isFinite(h2) || h2 <= h1 || h2 > P835_TOP_KM) {
    throw new ValidationError('Top altitude must be above the station and at most 100 km', 'topAltitude', h2);
  }

  const t = getTable_(h1, h2);
  const f2 = f * f;
  let beta = ((90 - elevation) * Math.PI) / 180;
  let total = 0;

  for (let j = 0; j < t.count; j++) {
    const delta = t.delta[j];
    const r = t.radius[j];

    if (j > 0) {
      const alphaPrev = Math.asin(Math.min(1, (t.radius[j - 1] / (t.radius[j - 1] + t.delta[j - 1])) * Math.sin(beta)));

      beta = Math.asin(Math.min(1, (t.index[j - 1] / t.index[j]) * Math.sin(alphaPrev)));
    }
    const cosB = Math.cos(beta);
    const a = -r * cosB + Math.sqrt(r * r * cosB * cosB + 2 * r * delta + delta * delta);

    // Oxygen
    let No = 0;
    const ob = j * N_OXYGEN;

    for (let m = 0; m < N_OXYGEN; m++) {
      const fi = P676_OXYGEN_LINES[m][0];
      const df = t.oDf[ob + m];
      const d = t.oD[ob + m];
      const dm = fi - f;
      const dp = fi + f;

      No += t.oS[ob + m] * (f / fi) * ((df - d * dm) / (dm * dm + df * df) + (df - d * dp) / (dp * dp + df * df));
    }
    const dd = t.ndDd[j];

    No += f * t.ndP[j] * (6.14e-5 / (dd * (1 + f2 / (dd * dd))) + t.ndQ[j] / (1 + 1.9e-5 * f ** 1.5));

    // Water vapour
    let Nw = 0;
    const wb = j * N_WATER;

    for (let m = 0; m < N_WATER; m++) {
      const fi = P676_WATER_VAPOR_LINES[m][0];
      const df = t.wDf[wb + m];
      const dm = fi - f;
      const dp = fi + f;

      Nw += t.wS[wb + m] * (f / fi) * (df / (dm * dm + df * df) + df / (dp * dp + df * df));
    }

    total += 0.182 * f * (No + Nw) * a;
  }

  return total as Decibels;
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Annex 2 instantaneous                                                                                               */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Surface meteorology for the Annex 2 instantaneous method. */
export interface GasInstantaneousParams {
  /** Frequency (Hz), 1 GHz to 350 GHz */
  frequency: Hertz;
  /** Elevation angle (deg), 5 to 90 */
  elevation: Degrees;
  /** Total surface pressure P (hPa) */
  pressure: number;
  /** Surface temperature T (K) */
  temperature: number;
  /** Surface water vapour density rho (g/m^3), 0 or more */
  waterVapourDensity: number;
}

/** Table 4 of P.676-13: [f_i (GHz), a_i, b_i] for the equivalent height of water vapour, eq 37. */
const WATER_HEIGHT_TERMS: readonly (readonly [number, number, number])[] = [
  [22.23508, 2.6846, 2.7649],
  [183.310087, 5.8905, 4.9219],
  [325.152888, 2.981, 3.0748],
];

const oxygenCoefficients_ = (fGHz: number): [number, number, number, number] => {
  const table = P676_ANNEX2_OXYGEN_TABLE;
  const rows = table.length / 5;
  let lo = 0;
  let hi = rows - 1;

  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;

    if (table[mid * 5] <= fGHz) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const f0 = table[lo * 5];
  const f1 = table[hi * 5];
  const w = f1 > f0 ? (fGHz - f0) / (f1 - f0) : 0;
  const c = (n: number): number => table[lo * 5 + n] + w * (table[hi * 5 + n] - table[lo * 5 + n]);

  return [c(1), c(2), c(3), c(4)];
};

/**
 * Gaseous attenuation from surface weather only, ITU-R P.676-13 Annex 2 (the approximate method for 1 to 350 GHz and
 * elevations of 5 to 90 degrees), section 1.1 (specific attenuation from {@link gasSpecificAttenuation} at the
 * surface) with the equivalent heights of section 2.1: A = (gamma_o h_o + gamma_w h_w) / sin(theta).
 *
 * h_o = a_o + b_o T + c_o P + d_o rho (eq 31, coefficients of the Recommendation's data file, interpolated linearly
 * in frequency) and h_w = A f + B + sum a_i / ((f - f_i)^2 + b_i) (eq 37 with A = 5.6585e-5, B = 1.8348 and Table 4).
 * The water vapour pressure is e = rho T / 216.7 and the dry pressure is P - e (Annex 2 section 1.1).
 *
 * This implements the method that uses the surface water vapour density only. The more accurate variant that
 * also needs the integrated water vapour content V (P.676-13 Annex 2 section 2.2) is not included.
 * @param params - Frequency, elevation and surface pressure, temperature and vapour density
 * @returns Slant-path gaseous attenuation (dB)
 * @throws {ValidationError} If an argument is non-finite or outside its range
 */
export const gasInstantaneousAttenuation = (params: GasInstantaneousParams): Decibels => {
  const f = params.frequency / 1e9;
  const { elevation, pressure: P, temperature: T, waterVapourDensity: rho } = params;

  checkFrequency_(f, P676_ANNEX2_MAX_GHZ, params.frequency);
  if (!Number.isFinite(elevation) || elevation < 5 || elevation > 90) {
    throw new ValidationError('The Annex 2 method is valid for elevations of 5 to 90 degrees', 'elevation', elevation);
  }
  if (!Number.isFinite(P) || P <= 0) {
    throw new ValidationError('Pressure must be a positive number of hPa', 'pressure', P);
  }
  if (!Number.isFinite(T) || T <= 0) {
    throw new ValidationError('Temperature must be a positive number of kelvin', 'temperature', T);
  }
  if (!Number.isFinite(rho) || rho < 0) {
    throw new ValidationError('Water vapour density must be zero or more g/m^3', 'waterVapourDensity', rho);
  }

  const e = (rho * T) / 216.7;

  if (e >= P) {
    throw new ValidationError('Water vapour pressure rho T / 216.7 must be below the total pressure', 'waterVapourDensity', rho);
  }
  const gamma = gasSpecificAttenuation(params.frequency, P - e, e, T);
  const [ao, bo, co, dOx] = oxygenCoefficients_(f);
  const ho = ao + bo * T + co * P + dOx * rho;
  let hw = 5.6585e-5 * f + 1.8348;

  for (const [fi, ai, bi] of WATER_HEIGHT_TERMS) {
    hw += ai / ((f - fi) ** 2 + bi);
  }

  return ((gamma.oxygen * ho + gamma.waterVapour * hw) / Math.sin((elevation * Math.PI) / 180)) as Decibels;
};
