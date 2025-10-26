export interface HorizonsOptions {
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** Stop date in YYYY-MM-DD format */
  stopDate: string;
  /** Step size (e.g., '1 day', '1 hour', '30 minutes') */
  stepSize?: string;
  /** Observer center (default: geocentric) */
  center?: string;
  /** Reference system (default: ICRF) */
  refSystem?: 'ICRF' | 'J2000';
  /** Reference plane (default: FRAME) */
  refPlane?: 'FRAME' | 'ECLIPTIC';
  /** Output units (default: KM-S for km and seconds) */
  outUnits?: 'KM-S' | 'AU-D' | 'KM-D';
  /** Vector corrections (default: NONE) */
  vecCorr?: 'NONE' | 'LT' | 'LT+S';
  /** Include velocity data (default: true) */
  includeVelocity?: boolean;
}

export interface HorizonsResponse {
  /** Raw API response */
  raw: string;
  /** Parsed vector data
   *
   * Each entry contains:
   * - Julian Date (number)
   * - Date string (YYYY-MMM-DD)
   * - Position vector [x, y, z] in kilometers
   * - (Optional) Velocity vector [vx, vy, vz] in kilometers per second
   */
  vectors: [number, [number, number, number], [number, number, number]?][];
  /** Object identifier used in the query */
  objectId: string;
  /** Object name */
  objectName?: string;
}
