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

import type { J2000 } from '../coordinate/J2000';

/**
 * OEM file header information from CCSDS format.
 */
export interface OemHeader {
  /** OEM version number */
  CCSDS_OEM_VERS: string;
  /** Creation date of the file */
  CREATION_DATE: string;
  /** Originator of the file */
  ORIGINATOR: string;
  /** Optional message identifier */
  MESSAGE_ID?: string;
  /** Optional classification */
  CLASSIFICATION?: string;
  /** Optional comment lines from header */
  COMMENT?: string[];
}

/**
 * OEM metadata block containing object and reference frame information.
 */
export interface OemMetadata {
  /** Name of the space object */
  OBJECT_NAME: string;
  /** International designator or catalog ID */
  OBJECT_ID: string;
  /** Center body name (e.g., 'EARTH', 'MARS BARYCENTER') */
  CENTER_NAME: string;
  /** Reference frame (e.g., 'EME2000', 'ICRF', 'TEME') */
  REF_FRAME: string;
  /** Time system (e.g., 'UTC', 'TDB') */
  TIME_SYSTEM: string;
  /** Start time of the data span */
  START_TIME: string;
  /** Stop time of the data span */
  STOP_TIME: string;
  /** Optional useable start time */
  USEABLE_START_TIME?: string;
  /** Optional useable stop time */
  USEABLE_STOP_TIME?: string;
  /** Optional interpolation method */
  INTERPOLATION?: string;
  /** Optional interpolation degree */
  INTERPOLATION_DEGREE?: number;
  /** Optional reference frame epoch */
  REF_FRAME_EPOCH?: string;
  /** Optional comment lines from metadata */
  COMMENT?: string[];
  /**
   * User-defined parameters from CCSDS OEM USER_DEFINED_ keywords.
   * @see CCSDS 502.0-B-3 Section 7.5.1
   */
  USER_DEFINED?: Record<string, string>;
}

/**
 * One covariance matrix from an OEM COVARIANCE_START ... COVARIANCE_STOP section
 * (CCSDS 502.0-B-3 section 5.2.5): an EPOCH, an optional COV_REF_FRAME, and the 21 lower-triangular
 * terms of the 6x6 position-velocity covariance, row by row (km^2, km^2/s, km^2/s^2).
 */
export interface OemCovarianceMatrix {
  /** Epoch of the covariance matrix (UTC) */
  epoch: Date;
  /** COV_REF_FRAME, when given (otherwise the block's REF_FRAME applies) */
  refFrame?: string;
  /** Lower triangle of the 6x6 matrix, 21 values: [C11, C21, C22, C31, C32, C33, ...] */
  values: number[];
}

/**
 * A single OEM data block containing metadata and ephemeris.
 */
export interface OemDataBlock {
  /** Metadata for this block */
  metadata: OemMetadata;
  /**
   * State vectors (km, km/s) with epochs converted to UTC from the block's TIME_SYSTEM. They are
   * stored in J2000 objects, but the coordinates are in the block's REF_FRAME as written; see
   * EphemerisSatellite.fromParsedOem for the frame conversion.
   */
  ephemeris: J2000[];
  /** Covariance matrices from the block's COVARIANCE section, one per EPOCH */
  covariance?: OemCovarianceMatrix[];
}

/**
 * Fully parsed OEM file structure.
 */
export interface ParsedOem {
  /** File header information */
  header: OemHeader;
  /** Array of data blocks (one OEM file may contain multiple) */
  dataBlocks: OemDataBlock[];
}
