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

/**
 * Base options for ODM (Orbit Data Message) export.
 */
export interface OdmExportOptions {
  /** Originator of the file. Default: 'KeepTrack' */
  originator?: string;
  /** Optional unique message identifier */
  messageId?: string;
  /** Optional comment lines */
  comments?: string[];
  /** Reference frame for state vectors. Default: 'TEME' */
  refFrame?: 'TEME' | 'EME2000';
}

/**
 * OPM (Orbit Parameter Message) export options.
 */
export interface OpmExportOptions extends OdmExportOptions {
  /** Include optional osculating Keplerian elements section */
  includeKeplerian?: boolean;
}

/**
 * OEM (Orbit Ephemeris Message) export options.
 */
export interface OemExportOptions extends OdmExportOptions {
  /** Interpolation method. Default: 'LAGRANGE' */
  interpolation?: string;
  /** Interpolation order. Default: 7 */
  interpolationDegree?: number;
}

/**
 * OEM from state vectors export options.
 */
export interface OemFromStateVectorsOptions extends OdmExportOptions {
  /** Interpolation method. Default: 'LAGRANGE' */
  interpolation?: string;
  /** Interpolation order. Default: 7 */
  interpolationDegree?: number;
  /** Center body name. Default: 'EARTH' */
  centerName?: string;
}

/**
 * OMM (Orbit Mean-Elements Message) export options.
 */
export type OmmExportOptions = OdmExportOptions;
