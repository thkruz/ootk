import { PayloadStatus } from '../types/PayloadStatus';
import { CatalogSource } from '../enums/CatalogSource';
import { HistoryConfig } from '../objects/History';
import {
  LaunchDetails,
  OperationsDetails,
  SpaceCraftDetails,
  SpaceObjectType,
  TemeVec3,
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
  position?: TemeVec3;
  time?: Date;

  // ==================== Detailed Properties (merged from DetailedSatellite) ====================

  /** Unique identifier */
  id?: number;
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

  // History tracking
  /** Configuration for tracking position/velocity history during propagation */
  historyConfig?: HistoryConfig;
}
