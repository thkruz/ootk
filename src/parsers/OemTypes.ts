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
 * Covariance matrix data from OEM file.
 * Stores the lower triangular portion of a 6x6 covariance matrix.
 *
 * @deferred Full covariance processing deferred to future enhancement.
 * Currently only parsed and stored, not processed.
 */
export interface OemCovarianceMatrix {
  /** Epoch of the covariance matrix */
  epoch: Date;
  /** Optional reference frame for covariance */
  refFrame?: string;
  /** 6x6 lower triangular matrix stored as 21 values */
  values: number[];
}

// TODO: Future enhancement - add covariance processing utilities
// - CovarianceMatrix class with proper 6x6 operations
// - Uncertainty propagation along ephemeris
// - Covariance visualization helpers (uncertainty ellipsoids)

/**
 * A single OEM data block containing metadata and ephemeris.
 */
export interface OemDataBlock {
  /** Metadata for this block */
  metadata: OemMetadata;
  /** Array of J2000 state vectors */
  ephemeris: J2000[];
  /** Optional covariance data (parsed but not processed) */
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
