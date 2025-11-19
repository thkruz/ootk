/**
 * @author @thkruz/ootk
 * @license AGPL-3.0-or-later
 * @copyright (c) 2024 Theodore Kruczek
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

/**
 * Standard frequency bands used in satellite communications and radar systems.
 */
export enum FrequencyBand {
  /** 1-2 GHz */
  L_BAND = 'L_BAND',
  /** 2-4 GHz */
  S_BAND = 'S_BAND',
  /** 4-8 GHz */
  C_BAND = 'C_BAND',
  /** 8-12 GHz */
  X_BAND = 'X_BAND',
  /** 12-18 GHz */
  KU_BAND = 'KU_BAND',
  /** 18-27 GHz */
  K_BAND = 'K_BAND',
  /** 27-40 GHz */
  KA_BAND = 'KA_BAND',
  /** 30-300 GHz */
  V_BAND = 'V_BAND',
  /** 110-300 GHz */
  W_BAND = 'W_BAND',
  /** 300 MHz - 1 GHz */
  UHF = 'UHF',
  /** 30-300 MHz */
  VHF = 'VHF',
}
