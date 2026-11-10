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
import { Decibels, Hertz, LinkEndGeometry, LinkGeometry, LinkLossModel, LinkLossTerm } from '../CommTypes';
import { P618_MAX_GHZ, P618_MIN_GHZ, rainAttenuation } from './P618RainAttenuation';
import {
  gasInstantaneousAttenuation, gasSlantAttenuation, P676_ANNEX2_MAX_GHZ, P676_MAX_GHZ, P676_MIN_GHZ,
} from './P676GasAttenuation';
import { cloudAttenuation, P840_MAX_GHZ, P840_MIN_ELEVATION_DEG, P840_MIN_GHZ } from './P840CloudAttenuation';

/** Surface weather for the P.676-13 Annex 2 instantaneous gas method. */
export interface SurfaceMeteorology {
  /** Total surface pressure (hPa) */
  pressure: number;
  /** Surface temperature (K) */
  temperature: number;
  /** Surface water vapour density (g/m^3) */
  waterVapourDensity: number;
}

/** Parameters of {@link atmosphericLossModel}. Terms with no input are not reported. */
export interface AtmosphericLossParams {
  /**
   * Rain rate (mm/h) at the ground end. Enables the `rain` term (0 gives a 0 dB term). It is used as R_0.01 in the
   * statistical P.618-14 method, see {@link rainAttenuation} for why that is a simulation simplification.
   */
  rainRate?: number;
  /** Rain height above mean sea level (km). Default: the rough P.839-2 latitude formula. */
  rainHeight?: Kilometers;
  /** Percentage of an average year the rain attenuation is exceeded (percent), 0.001 to 5. Default 0.01. */
  exceedancePercent?: number;
  /** Polarisation tilt angle relative to the horizontal (deg): 0 horizontal, 90 vertical, 45 circular. Default 45. */
  polarizationTilt?: Degrees;
  /** Report the `gas` term. Default true. */
  gas?: boolean;
  /**
   * Gas method. `'annex1'` (default) is the P.676-13 Annex 1 line-by-line path through the P.835-6 mean atmosphere,
   * valid at every elevation and needing no weather. `'annex2'` is the approximate instantaneous method from surface
   * weather (needs `surfaceMeteorology`), valid for 5 to 90 degrees and 1 to 350 GHz; below 5 degrees it falls back to
   * Annex 1.
   */
  gasMethod?: 'annex1' | 'annex2';
  /** Surface weather, required when `gasMethod` is `'annex2'` */
  surfaceMeteorology?: SurfaceMeteorology;
  /** Integrated cloud liquid water (kg/m^2). Enables the `cloud` term (P.840-9). */
  cloudLiquidWater?: number;
}

const finiteAtLeast_ = (value: number, min: number, field: string, what: string): void => {
  if (!Number.isFinite(value) || value < min) {
    throw new ValidationError(`${what} must be a finite number of at least ${min}`, field, value);
  }
};

const checkBand_ = (fGHz: number, lo: number, hi: number, term: string, frequency: number): void => {
  if (!(fGHz >= lo && fGHz <= hi)) {
    throw new ValidationError(`The ${term} model is valid from ${lo} to ${hi} GHz`, 'frequency', frequency);
  }
};

/**
 * Build a {@link LinkLossModel} that reports rain, gaseous and cloud attenuation of an Earth-space link, for use with
 * `Transmitter.calculateLinkBudget` (`lossModels` option). Each enabled model yields one named term, in this order:
 * `'rain'` (ITU-R P.618-14 with P.838-3 and P.839), `'gas'` (ITU-R P.676-13 with P.835-6) and `'cloud'` (ITU-R P.840-9).
 * The link budget subtracts the sum of the terms. The terms are summed (no scintillation), which is the P.618-14
 * section 2.5 combination with A_S = 0; see {@link totalAttenuation} for the full rule.
 *
 * Geometry: the terms apply to ground ends only, using the end's look elevation, latitude and altitude. A link with
 * no ground end (space to space) returns no terms. A link with two ground ends throws: these are Earth-space models
 * that integrate the whole atmospheric column above an end, so they do not describe a finite terrestrial path
 * (summing two columns would overstate the loss).
 *
 * Station altitude is the WGS84 altitude and is used as the height above mean sea level (a geoid undulation of tens of
 * metres is far below the model accuracy). Negative altitudes are treated as sea level.
 *
 * The caller supplies the weather (rain rate, cloud liquid water, surface meteorology); no climate maps are read.
 * Frequency limits are checked for each enabled term: rain 1 to 55 GHz, gas 1 to 1000 GHz (Annex 1) or 1 to 350 GHz
 * (Annex 2), cloud 1 to 200 GHz. A look elevation below the horizon throws. For cloud, elevations below 5 degrees
 * (outside P.840-9) are evaluated at 5 degrees, which UNDERESTIMATES the cloud term there.
 *
 * The returned function is a closure over the validated parameters and is not serialisable.
 * @param params - Weather inputs and method choices
 * @returns A loss model for `LinkBudgetOptions.lossModels`
 * @throws {ValidationError} If a parameter is invalid (when built), or if a call has a bad frequency or elevation
 */
export const atmosphericLossModel = (params: AtmosphericLossParams = {}): LinkLossModel => {
  const tilt = params.polarizationTilt ?? (45 as Degrees);
  const p = params.exceedancePercent ?? 0.01;
  const gasOn = params.gas ?? true;
  const method = params.gasMethod ?? 'annex1';

  if (params.rainRate !== undefined) {
    finiteAtLeast_(params.rainRate, 0, 'rainRate', 'Rain rate');
  }
  if (params.cloudLiquidWater !== undefined) {
    finiteAtLeast_(params.cloudLiquidWater, 0, 'cloudLiquidWater', 'Cloud liquid water');
  }
  if (params.rainHeight !== undefined) {
    finiteAtLeast_(params.rainHeight, 0, 'rainHeight', 'Rain height');
  }
  if (!Number.isFinite(p) || p < 0.001 || p > 5) {
    throw new ValidationError('Exceedance percentage must be between 0.001 and 5', 'exceedancePercent', p);
  }
  if (!Number.isFinite(tilt)) {
    throw new ValidationError('Polarisation tilt must be a finite number of degrees', 'polarizationTilt', tilt);
  }
  if (method !== 'annex1' && method !== 'annex2') {
    throw new ValidationError('Gas method must be \'annex1\' or \'annex2\'', 'gasMethod', method);
  }
  if (gasOn && method === 'annex2') {
    const m = params.surfaceMeteorology;

    if (!m) {
      throw new ValidationError('gasMethod \'annex2\' needs surfaceMeteorology', 'surfaceMeteorology', m);
    }
    if (!Number.isFinite(m.pressure) || m.pressure <= 0) {
      throw new ValidationError('Surface pressure must be a positive number of hPa', 'surfaceMeteorology.pressure', m.pressure);
    }
    if (!Number.isFinite(m.temperature) || m.temperature <= 0) {
      throw new ValidationError('Surface temperature must be a positive number of kelvin', 'surfaceMeteorology.temperature', m.temperature);
    }
    finiteAtLeast_(m.waterVapourDensity, 0, 'surfaceMeteorology.waterVapourDensity', 'Water vapour density');
  }

  const endTerms = (end: LinkEndGeometry, frequency: Hertz): { rain?: number; gas?: number; cloud?: number } => {
    const fGHz = frequency / 1e9;
    const el = end.lookEl;

    if (!Number.isFinite(el) || el < 0) {
      throw new ValidationError('The link is below the horizon of a ground end (negative elevation)', 'lookEl', el);
    }
    const elevation = Math.min(90, el) as Degrees;
    const altitude = Math.max(0, end.altitude) as Kilometers;
    const out: { rain?: number; gas?: number; cloud?: number } = {};

    if (params.rainRate !== undefined) {
      checkBand_(fGHz, P618_MIN_GHZ, P618_MAX_GHZ, 'rain', frequency);
      out.rain = rainAttenuation({
        frequency,
        elevation,
        polarizationTilt: tilt,
        rainRate: params.rainRate,
        latitude: end.latitude,
        stationAltitude: altitude,
        rainHeight: params.rainHeight,
        exceedancePercent: p,
      }).attenuation;
    }

    if (gasOn) {
      const m = params.surfaceMeteorology;

      if (method === 'annex2' && m && elevation >= 5) {
        checkBand_(fGHz, P676_MIN_GHZ, P676_ANNEX2_MAX_GHZ, 'gas (Annex 2)', frequency);
        out.gas = gasInstantaneousAttenuation({
          frequency, elevation, pressure: m.pressure, temperature: m.temperature, waterVapourDensity: m.waterVapourDensity,
        });
      } else {
        checkBand_(fGHz, P676_MIN_GHZ, P676_MAX_GHZ, 'gas', frequency);
        out.gas = gasSlantAttenuation(frequency, elevation, { stationAltitude: altitude });
      }
    }

    if (params.cloudLiquidWater !== undefined) {
      checkBand_(fGHz, P840_MIN_GHZ, P840_MAX_GHZ, 'cloud', frequency);
      out.cloud = cloudAttenuation({
        frequency, elevation: Math.max(P840_MIN_ELEVATION_DEG, elevation) as Degrees, cloudLiquidWater: params.cloudLiquidWater,
      });
    }

    return out;
  };

  return (geometry: LinkGeometry, frequency: Hertz): LinkLossTerm[] => {
    if (geometry.tx && geometry.rx) {
      throw new ValidationError(
        'The atmospheric loss model covers Earth-space links only; both ends are on the ground (terrestrial path)',
        'geometry',
        geometry.distance,
      );
    }
    const ends = [geometry.tx, geometry.rx].filter((e): e is LinkEndGeometry => e !== undefined);
    const totals: { rain?: number; gas?: number; cloud?: number } = {};

    for (const end of ends) {
      const t = endTerms(end, frequency);

      for (const key of ['rain', 'gas', 'cloud'] as const) {
        if (t[key] !== undefined) {
          totals[key] = (totals[key] ?? 0) + (t[key] as number);
        }
      }
    }

    const terms: LinkLossTerm[] = [];

    for (const key of ['rain', 'gas', 'cloud'] as const) {
      const v = totals[key];

      if (v !== undefined) {
        terms.push({ name: key, db: v as Decibels });
      }
    }

    return terms;
  };
};
