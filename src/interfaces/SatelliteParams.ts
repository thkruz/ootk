import { CatalogSource } from '../enums/CatalogSource';
import {
  EciVec3,
  LaunchDetails,
  OperationsDetails,
  PayloadStatus,
  SpaceCraftDetails,
  SpaceObjectType,
  TleLine1,
  TleLine2,
} from '../types/types';
import { OmmDataFormat } from './OmmFormat';

/**
 * Information about a space object.
 */
export interface SatelliteParams extends LaunchDetails, SpaceCraftDetails, OperationsDetails {
  name?: string;
  rcs?: number | null;
  omm?: OmmDataFormat;
  tle1?: TleLine1;
  tle2?: TleLine2;
  type?: SpaceObjectType;
  vmag?: number | null;
  sccNum?: string;
  intlDes?: string;
  position?: EciVec3;
  time?: Date;

  // ==================== Detailed Properties (merged from DetailedSatellite) ====================

  /** Unique identifier */
  id?: string;
  /** Whether the satellite is active */
  active?: boolean;

  // Physical dimensions
  /** Length in meters */
  length?: string;
  /** Diameter in meters */
  diameter?: string;

  // Catalog details
  /** Catalog source (e.g., VIMPEL) */
  source?: CatalogSource | string;
  /** Alternate catalog ID */
  altId?: string;
  /** Alternate name */
  altName?: string;
  /** Operational status */
  status?: PayloadStatus;
}
