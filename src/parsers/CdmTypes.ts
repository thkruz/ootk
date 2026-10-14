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

import type { Kilometers, KilometersPerSecond } from '../types/types';

/**
 * CDM Header section data.
 * @see CCSDS 508.0-B-1 Section 3.2
 */
export interface CdmHeader {
  /** CDM format version (e.g., "1.0") */
  CCSDS_CDM_VERS: string;
  /** Message creation date/time in ISO 8601 format */
  CREATION_DATE: string;
  /** Organization that created the CDM */
  ORIGINATOR: string;
  /** Intended recipient of the message */
  MESSAGE_FOR?: string;
  /** Unique message identifier */
  MESSAGE_ID?: string;
  /** Optional comments */
  COMMENT?: string[];
}

/**
 * CDM Relative metadata and state data.
 *
 * Values are in ootk's km-based units. The CDM itself carries MISS_DISTANCE and
 * RELATIVE_POSITION_* in m and RELATIVE_SPEED / RELATIVE_VELOCITY_* in m/s; CdmParser divides by
 * 1000 on parse and CdmExporter multiplies by 1000 on export.
 * @see CCSDS 508.0-B-1 Section 3.3
 */
export interface CdmRelativeData {
  /** Time of Closest Approach in ISO 8601 format */
  TCA: string;
  /** Total miss distance at TCA (km) */
  MISS_DISTANCE: Kilometers;
  /** Relative velocity magnitude at TCA (km/s) */
  RELATIVE_SPEED?: KilometersPerSecond;
  /** Radial component of relative position (km) */
  RELATIVE_POSITION_R?: Kilometers;
  /** In-track component of relative position (km) */
  RELATIVE_POSITION_T?: Kilometers;
  /** Cross-track component of relative position (km) */
  RELATIVE_POSITION_N?: Kilometers;
  /** Radial component of relative velocity (km/s) */
  RELATIVE_VELOCITY_R?: KilometersPerSecond;
  /** In-track component of relative velocity (km/s) */
  RELATIVE_VELOCITY_T?: KilometersPerSecond;
  /** Cross-track component of relative velocity (km/s) */
  RELATIVE_VELOCITY_N?: KilometersPerSecond;
  /** Probability of collision (0-1) */
  COLLISION_PROBABILITY?: number;
  /** Method used to compute collision probability */
  COLLISION_PROBABILITY_METHOD?: string;
  /** Start of screening period */
  START_SCREEN_PERIOD?: string;
  /** End of screening period */
  STOP_SCREEN_PERIOD?: string;
  /** Screening volume frame (RTN or TVN) */
  SCREEN_VOLUME_FRAME?: 'RTN' | 'TVN';
  /** Screening volume shape (ELLIPSOID or BOX) */
  SCREEN_VOLUME_SHAPE?: 'ELLIPSOID' | 'BOX';
  /** Screening volume X extent (km) */
  SCREEN_VOLUME_X?: Kilometers;
  /** Screening volume Y extent (km) */
  SCREEN_VOLUME_Y?: Kilometers;
  /** Screening volume Z extent (km) */
  SCREEN_VOLUME_Z?: Kilometers;
  /** Screening entry time */
  SCREEN_ENTRY_TIME?: string;
  /** Screening exit time */
  SCREEN_EXIT_TIME?: string;
}

/**
 * CDM Object type enumeration.
 */
export type CdmObjectType = 'PAYLOAD' | 'ROCKET BODY' | 'DEBRIS' | 'UNKNOWN' | 'OTHER';

/**
 * CDM Maneuverable status.
 */
export type CdmManeuverableStatus = 'YES' | 'NO' | 'N/A';

/**
 * CDM Object metadata section.
 * @see CCSDS 508.0-B-1 Section 3.4
 */
export interface CdmObjectMetadata {
  /** Object identifier (OBJECT1 or OBJECT2) */
  OBJECT: 'OBJECT1' | 'OBJECT2';
  /** Satellite catalog designator: the catalog number in the CATALOG_NAME catalog (e.g. 25544 in SATCAT) */
  OBJECT_DESIGNATOR: string;
  /** Catalog name (e.g., "SATCAT") */
  CATALOG_NAME?: string;
  /** Object name */
  OBJECT_NAME?: string;
  /** International designator (e.g., "1998-067A") */
  INTERNATIONAL_DESIGNATOR?: string;
  /** Type of object */
  OBJECT_TYPE?: CdmObjectType;
  /** Contact position at operator organization */
  OPERATOR_CONTACT_POSITION?: string;
  /** Operator organization name */
  OPERATOR_ORGANIZATION?: string;
  /** Operator phone number */
  OPERATOR_PHONE?: string;
  /** Operator email */
  OPERATOR_EMAIL?: string;
  /** Ephemeris name/source */
  EPHEMERIS_NAME?: string;
  /** Method used to generate covariance */
  COVARIANCE_METHOD?: string;
  /** Whether object can maneuver */
  MANEUVERABLE?: CdmManeuverableStatus;
  /** Reference frame for state data */
  REF_FRAME?: string;
  /** Gravity model used */
  GRAVITY_MODEL?: string;
  /** Atmospheric model used */
  ATMOSPHERIC_MODEL?: string;
  /** N-body perturbation bodies */
  N_BODY_PERTURBATIONS?: string;
  /** Whether solar radiation pressure was modeled */
  SOLAR_RAD_PRESSURE?: 'YES' | 'NO';
  /** Whether Earth tides were modeled */
  EARTH_TIDES?: 'YES' | 'NO';
  /** Whether in-track thrust was modeled */
  INTRACK_THRUST?: 'YES' | 'NO';
}

/**
 * CDM Object state data section.
 * @see CCSDS 508.0-B-1 Section 3.5
 */
export interface CdmObjectData {
  /** Object identifier (OBJECT1 or OBJECT2) */
  OBJECT: 'OBJECT1' | 'OBJECT2';

  /** Optional comment */
  COMMENT?: string;

  /** Start of the time interval containing the last accepted observation (UTC) */
  TIME_LASTOB_START?: string;
  /** End of the time interval containing the last accepted observation (UTC) */
  TIME_LASTOB_END?: string;

  // State vector components
  /** X position (km) */
  X: Kilometers;
  /** Y position (km) */
  Y: Kilometers;
  /** Z position (km) */
  Z: Kilometers;
  /** X velocity (km/s) */
  X_DOT: KilometersPerSecond;
  /** Y velocity (km/s) */
  Y_DOT: KilometersPerSecond;
  /** Z velocity (km/s) */
  Z_DOT: KilometersPerSecond;

  // Optional physical parameters
  /** Object mass (kg) */
  MASS?: number;
  /** Ballistic coefficient term C_D A / m (m^2/kg), used by the drag model */
  CD_AREA_OVER_MASS?: number;
  /** Solar radiation pressure term C_R A / m (m^2/kg) */
  CR_AREA_OVER_MASS?: number;
  /** Thrust acceleration (m/s^2) */
  THRUST_ACCELERATION?: number;
  /** Specific energy dissipation rate, the energy lost to drag per unit mass (W/kg) */
  SEDR?: number;

  /*
   * Covariance, lower triangular, in this object's own RTN frame. Values are in km^2, km^2/s and
   * km^2/s^2; the CDM carries m**2, m**2/s and m**2/s**2 (CCSDS 508.0-B-1 Table 3-4) and
   * CdmParser / CdmExporter convert by 1e-6 / 1e6.
   */
  // Position covariance
  /** Radial-Radial covariance (km^2) */
  CR_R?: number;
  /** Transverse-Radial covariance (km^2) */
  CT_R?: number;
  /** Transverse-Transverse covariance (km^2) */
  CT_T?: number;
  /** Normal-Radial covariance (km^2) */
  CN_R?: number;
  /** Normal-Transverse covariance (km^2) */
  CN_T?: number;
  /** Normal-Normal covariance (km^2) */
  CN_N?: number;

  // Position-velocity cross covariance
  /** Rdot-R covariance (km^2/s) */
  CRDOT_R?: number;
  /** Rdot-T covariance (km^2/s) */
  CRDOT_T?: number;
  /** Rdot-N covariance (km^2/s) */
  CRDOT_N?: number;
  /** Rdot-Rdot covariance (km^2/s^2) */
  CRDOT_RDOT?: number;
  /** Tdot-R covariance (km^2/s) */
  CTDOT_R?: number;
  /** Tdot-T covariance (km^2/s) */
  CTDOT_T?: number;
  /** Tdot-N covariance (km^2/s) */
  CTDOT_N?: number;
  /** Tdot-Rdot covariance (km^2/s^2) */
  CTDOT_RDOT?: number;
  /** Tdot-Tdot covariance (km^2/s^2) */
  CTDOT_TDOT?: number;
  /** Ndot-R covariance (km^2/s) */
  CNDOT_R?: number;
  /** Ndot-T covariance (km^2/s) */
  CNDOT_T?: number;
  /** Ndot-N covariance (km^2/s) */
  CNDOT_N?: number;
  /** Ndot-Rdot covariance (km^2/s^2) */
  CNDOT_RDOT?: number;
  /** Ndot-Tdot covariance (km^2/s^2) */
  CNDOT_TDOT?: number;
  /** Ndot-Ndot covariance (km^2/s^2) */
  CNDOT_NDOT?: number;
}

/**
 * Fully parsed CDM structure containing all sections.
 */
export interface ParsedCdm {
  /** CDM header information */
  header: CdmHeader;
  /** Relative metadata and data */
  relativeData: CdmRelativeData;
  /** Object 1 metadata */
  object1Metadata: CdmObjectMetadata;
  /** Object 1 state data */
  object1Data: CdmObjectData;
  /** Object 2 metadata */
  object2Metadata: CdmObjectMetadata;
  /** Object 2 state data */
  object2Data: CdmObjectData;
}

/**
 * Options for CDM export.
 */
export interface CdmExportOptions {
  /** Originator identifier (organization creating the CDM) */
  originator?: string;
  /** Unique message identifier */
  messageId?: string;
  /** Intended recipient */
  messageFor?: string;
  /**
   * Write the full 21-term 6x6 covariance (default true, as CDM 1.0 requires); false writes only
   * the six position terms.
   */
  includeFullCovariance?: boolean;
  /**
   * COLLISION_PROBABILITY_METHOD value (SANA registry). Default 'FOSTER-1992', which is the
   * exact 2D encounter-plane integral that ootk's ProbabilityOfCollision computes.
   */
  collisionProbabilityMethod?: string;
  /** Not used: the 15 velocity terms are written whenever `includeFullCovariance` is true and the matrix is 6x6. */
  includeVelocityCovariance?: boolean;
  /** Optional comments to include in header */
  comments?: string[];
  /** Object 1 metadata overrides */
  object1Metadata?: Partial<CdmObjectMetadata>;
  /** Object 2 metadata overrides */
  object2Metadata?: Partial<CdmObjectMetadata>;
}
