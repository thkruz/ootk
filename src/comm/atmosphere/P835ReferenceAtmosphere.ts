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
import { Kilometers } from '../../types/types';

/** Temperature, pressure and humidity at one altitude of the P.835-6 reference atmosphere. */
export interface ReferenceAtmosphereState {
  /** Temperature T (K) */
  temperature: number;
  /** Total pressure P (hPa) */
  totalPressure: number;
  /** Water vapour partial pressure e (hPa) */
  vapourPressure: number;
  /** Dry air pressure P - e (hPa) */
  dryPressure: number;
  /** Water vapour density rho (g/m^3) */
  waterVapourDensity: number;
}

/** Highest altitude of the P.676-13 Annex 1 path integration (km). */
export const P835_TOP_KM = 100;

/**
 * Mean annual global reference atmosphere of ITU-R P.835-6 (12/2017), used by P.676-13 Annex 1 section 2.2.1 for
 * slant-path gaseous attenuation.
 *
 * - Up to 86 km geometric altitude: the piecewise standard atmosphere in geopotential height
 *   h' = 6356.766 h / (6356.766 + h) with breakpoints at h' = 11, 20, 32, 47, 51, 71 km (P.835-6 eq 2 to 8, 9 to 15).
 * - 86 to 100 km: T = 186.8673 K up to 91 km, then 263.1905 - 76.3232 sqrt(1 - ((h - 91)/19.9429)^2); pressure
 *   P = exp(sum a_i h^i), a = [95.571899, -4.011801, 6.424731e-2, -4.789660e-4, 1.340543e-6] (P.835-6 eq 4 to 6).
 * - Water vapour: rho = 7.5 exp(-h/2) g/m^3 (rho0 = 7.5 g/m^3, scale height 2 km), e = rho T / 216.7, with e floored at
 *   2e-6 P so that the vapour fraction does not fall below 2 ppm at altitude. The floor was identified by comparison to
 *   the ITU validation spreadsheet layer table, which the implementation reproduces to better than 1e-9 relative.
 * @param altitude - Geometric altitude above mean sea level (km), 0 to 100
 * @returns Temperature, pressures and vapour density at that altitude
 * @throws {ValidationError} If the altitude is non-finite or outside 0 to 100 km
 */
export const referenceAtmosphere = (altitude: Kilometers): ReferenceAtmosphereState => {
  if (!Number.isFinite(altitude) || altitude < 0 || altitude > P835_TOP_KM) {
    throw new ValidationError('Altitude must be between 0 and 100 km for the P.835-6 reference atmosphere', 'altitude', altitude);
  }

  return atmosphereAt_(altitude);
};

/** Unvalidated worker for {@link referenceAtmosphere}. */
const atmosphereAt_ = (h: number): ReferenceAtmosphereState => {
  let T: number;
  let P: number;

  if (h <= 86) {
    const hp = (6356.766 * h) / (6356.766 + h);

    if (hp <= 11) {
      T = 288.15 - 6.5 * hp;
      P = 1013.25 * (288.15 / T) ** (-34.1632 / 6.5);
    } else if (hp <= 20) {
      T = 216.65;
      P = 226.3226 * Math.exp((-34.1632 * (hp - 11)) / 216.65);
    } else if (hp <= 32) {
      T = 216.65 + (hp - 20);
      P = 54.7498 * (216.65 / T) ** 34.1632;
    } else if (hp <= 47) {
      T = 228.65 + 2.8 * (hp - 32);
      P = 8.680422 * (228.65 / T) ** (34.1632 / 2.8);
    } else if (hp <= 51) {
      T = 270.65;
      P = 1.109106 * Math.exp((-34.1632 * (hp - 47)) / 270.65);
    } else if (hp <= 71) {
      T = 270.65 - 2.8 * (hp - 51);
      P = 0.6694167 * (270.65 / T) ** (-34.1632 / 2.8);
    } else {
      T = 214.65 - 2.0 * (hp - 71);
      P = 0.03956649 * (214.65 / T) ** (-34.1632 / 2.0);
    }
  } else {
    T = h <= 91 ? 186.8673 : 263.1905 - 76.3232 * Math.sqrt(1 - ((h - 91) / 19.9429) ** 2);
    const a = [95.571899, -4.011801, 6.424731e-2, -4.78966e-4, 1.340543e-6];

    P = Math.exp(a[0] + h * (a[1] + h * (a[2] + h * (a[3] + h * a[4]))));
  }

  const rho = 7.5 * Math.exp(-h / 2);
  const e = Math.max((rho * T) / 216.7, 2e-6 * P);

  return {
    temperature: T,
    totalPressure: P,
    vapourPressure: e,
    dryPressure: P - e,
    waterVapourDensity: (e * 216.7) / T,
  };
};
