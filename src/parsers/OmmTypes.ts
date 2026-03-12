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
 * OMM file header information from CCSDS format.
 * @see CCSDS 502.0-B-3 Table 4-1
 */
export interface OmmHeader {
  /** Format version (e.g., '3.0') */
  CCSDS_OMM_VERS: string;
  /** File creation date/time in UTC */
  CREATION_DATE: string;
  /** Creating agency or operator */
  ORIGINATOR: string;
  /** Optional unique message identifier */
  MESSAGE_ID?: string;
  /** Optional classification/caveats */
  CLASSIFICATION?: string;
  /** Optional comment lines from header */
  COMMENT?: string[];
}

/**
 * OMM metadata block containing object and reference frame information.
 * @see CCSDS 502.0-B-3 Table 4-2
 */
export interface OmmMetadata {
  /** Spacecraft name */
  OBJECT_NAME: string;
  /** Object identifier (international designator) */
  OBJECT_ID: string;
  /** Origin of the reference frame (e.g., 'EARTH') */
  CENTER_NAME: string;
  /** Reference frame (e.g., 'TEME', 'EME2000') */
  REF_FRAME: string;
  /** Epoch of reference frame, if not intrinsic */
  REF_FRAME_EPOCH?: string;
  /** Time system (e.g., 'UTC') */
  TIME_SYSTEM: string;
  /** Mean element theory (e.g., 'SGP4', 'DSST') */
  MEAN_ELEMENT_THEORY: string;
  /** Optional comment lines */
  COMMENT?: string[];
}

/**
 * Mean Keplerian elements data.
 * @see CCSDS 502.0-B-3 Table 4-3
 */
export interface OmmMeanElements {
  /** Epoch of Mean Keplerian elements */
  EPOCH: string;
  /** Semi-major axis in km (mutually exclusive with MEAN_MOTION) */
  SEMI_MAJOR_AXIS?: number;
  /** Mean motion in rev/day (mutually exclusive with SEMI_MAJOR_AXIS) */
  MEAN_MOTION?: number;
  /** Eccentricity */
  ECCENTRICITY: number;
  /** Inclination in degrees */
  INCLINATION: number;
  /** Right ascension of ascending node in degrees */
  RA_OF_ASC_NODE: number;
  /** Argument of pericenter in degrees */
  ARG_OF_PERICENTER: number;
  /** Mean anomaly in degrees */
  MEAN_ANOMALY: number;
  /** Gravitational coefficient in km^3/s^2 */
  GM?: number;
  /** Optional comment lines */
  COMMENT?: string[];
}

/**
 * Spacecraft parameters.
 * @see CCSDS 502.0-B-3 Table 4-3
 */
export interface OmmSpacecraftParameters {
  /** Spacecraft mass in kg */
  MASS?: number;
  /** Solar radiation pressure area in m^2 */
  SOLAR_RAD_AREA?: number;
  /** Solar radiation pressure coefficient */
  SOLAR_RAD_COEFF?: number;
  /** Drag area in m^2 */
  DRAG_AREA?: number;
  /** Drag coefficient */
  DRAG_COEFF?: number;
  /** Optional comment lines */
  COMMENT?: string[];
}

/**
 * TLE-related parameters.
 * @see CCSDS 502.0-B-3 Table 4-3
 */
export interface OmmTleParameters {
  /** Ephemeris type (default 0) */
  EPHEMERIS_TYPE?: number;
  /** Classification type (default 'U') */
  CLASSIFICATION_TYPE?: string;
  /** NORAD catalog number */
  NORAD_CAT_ID?: number;
  /** Element set number */
  ELEMENT_SET_NO?: number;
  /** Revolution number at epoch */
  REV_AT_EPOCH?: number;
  /** SGP4 drag parameter (1/Earth radii) */
  BSTAR?: number;
  /** SGP4-XP ballistic coefficient (m^2/kg) */
  BTERM?: number;
  /** First time derivative of mean motion (rev/day^2) */
  MEAN_MOTION_DOT?: number;
  /** Second time derivative of mean motion (rev/day^3) */
  MEAN_MOTION_DDOT?: number;
  /** SGP4-XP solar radiation pressure coefficient (m^2/kg) */
  AGOM?: number;
  /** Optional comment lines */
  COMMENT?: string[];
}

/**
 * Position/Velocity covariance matrix (6x6 lower triangular form).
 * @see CCSDS 502.0-B-3 Table 4-3
 */
export interface OmmCovarianceMatrix {
  /** Reference frame for covariance data */
  COV_REF_FRAME?: string;
  /** Covariance matrix elements (lower triangular, 21 values) */
  CX_X?: number;
  CY_X?: number;
  CY_Y?: number;
  CZ_X?: number;
  CZ_Y?: number;
  CZ_Z?: number;
  CX_DOT_X?: number;
  CX_DOT_Y?: number;
  CX_DOT_Z?: number;
  CX_DOT_X_DOT?: number;
  CY_DOT_X?: number;
  CY_DOT_Y?: number;
  CY_DOT_Z?: number;
  CY_DOT_X_DOT?: number;
  CY_DOT_Y_DOT?: number;
  CZ_DOT_X?: number;
  CZ_DOT_Y?: number;
  CZ_DOT_Z?: number;
  CZ_DOT_X_DOT?: number;
  CZ_DOT_Y_DOT?: number;
  CZ_DOT_Z_DOT?: number;
  /** Optional comment lines */
  COMMENT?: string[];
}

/**
 * User-defined parameters section.
 */
export interface OmmUserDefined {
  [key: string]: string;
}

/**
 * Fully parsed OMM file structure.
 * @see CCSDS 502.0-B-3 Section 4.2
 */
export interface ParsedOmm {
  /** File header information */
  header: OmmHeader;
  /** Metadata about the object and reference frame */
  metadata: OmmMetadata;
  /** Mean Keplerian elements */
  meanElements: OmmMeanElements;
  /** Optional spacecraft parameters */
  spacecraftParameters?: OmmSpacecraftParameters;
  /** Optional TLE-related parameters */
  tleParameters?: OmmTleParameters;
  /** Optional covariance matrix */
  covarianceMatrix?: OmmCovarianceMatrix;
  /** Optional user-defined parameters */
  userDefined?: OmmUserDefined;
}
