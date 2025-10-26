/**
 * NASA Horizons API Client
 *
 * Provides an easy-to-use interface for fetching ephemeris data from NASA's JPL Horizons system.
 *
 * @example
 * ```typescript
 * const horizons = new HorizonsAPI();
 * const data = await horizons.getObjectPosition('Makemake', {
 *   startDate: '2025-10-21',
 *   stopDate: '2025-11-20',
 *   stepSize: '1 day'
 * });
 * ```
 */

import { CELESTIAL_OBJECTS, OBSERVER_CENTERS } from "./horizons-constants";
import { HorizonsOptions, HorizonsResponse } from "./horizons-interfaces";

interface HorizonsUrlSearch {
  format: string;
  MAKE_EPHEM: string;
  COMMAND: string;
  EPHEM_TYPE: string;
  CENTER: string;
  START_TIME: string;
  STOP_TIME: string;
  STEP_SIZE: string;
  VEC_TABLE: string;
  REF_SYSTEM: string;
  REF_PLANE: string;
  VEC_CORR: string;
  CAL_TYPE: string;
  OUT_UNITS: string;
  VEC_LABELS: string;
  VEC_DELTA_T: string;
  CSV_FORMAT: string;
  OBJ_DATA: string;
}

export class HorizonsAPI {
  private readonly baseUrl = 'https://ssd.jpl.nasa.gov/api/horizons.api';

  /**
   * Get position and velocity vectors for a celestial object
   *
   * @param objectName - Name or ID of the celestial object (e.g., 'Makemake', 'Mars', '699')
   * @param options - Query options including date range and parameters
   * @returns Promise resolving to parsed Horizons data
   */
  async getObjectPosition(
    objectName: CELESTIAL_OBJECTS,
    options: HorizonsOptions
  ): Promise<HorizonsResponse> {
    const objectId = this.resolveObjectId(objectName);
    const url = this.buildUrl(objectId, options);

    /**
     * TODO: This will fail due to CORS
     */
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Horizons API request failed: ${response.status} ${response.statusText}`);
    }

    const rawData = await response.text();

    // Check for API errors in the response
    if (rawData.includes('ERROR') || rawData.includes('No matches found')) {
      throw new Error(`Horizons API error: Invalid object identifier or parameters`);
    }

    const vectors = this.parseVectorData(rawData, options.includeVelocity !== false);

    return {
      raw: rawData,
      vectors,
      objectId,
      objectName: this.getObjectName(objectId),
    };
  }

  /**
   * Get position vectors for multiple objects at once
   *
   * @param objectNames - Array of object names or IDs
   * @param options - Query options (same for all objects)
   * @returns Promise resolving to array of Horizons responses
   */
  async getMultipleObjects(
    objectNames: CELESTIAL_OBJECTS[],
    options: HorizonsOptions
  ): Promise<HorizonsResponse[]> {
    const promises = objectNames.map(name => this.getObjectPosition(name, options));
    return Promise.all(promises);
  }

  /**
   * Get current position of an object (right now)
   *
   * @param objectName - Name or ID of the celestial object
   * @param center - Observer center (default: geocentric)
   * @returns Promise resolving to current position data
   */
  async getCurrentPosition(
    objectName: CELESTIAL_OBJECTS,
    center: string = OBSERVER_CENTERS.Geocentric
  ): Promise<[number, [number, number, number], [number, number, number]?]> {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await this.getObjectPosition(objectName, {
      startDate: this.formatDate(now),
      stopDate: this.formatDate(tomorrow),
      stepSize: '1 day',
      center,
    });

    return response.vectors[0];
  }

  /**
   * Build the full API URL with all parameters
   */
  buildUrl(objectId: string, options: HorizonsOptions): string {
    const params = this.generateApiString({
      format: 'text',
      MAKE_EPHEM: 'YES',
      COMMAND: `'${objectId}'`,
      EPHEM_TYPE: "'VECTORS'",
      CENTER: `'${options.center ?? OBSERVER_CENTERS.Geocentric}'`,
      START_TIME: `'${options.startDate}'`,
      STOP_TIME: `'${options.stopDate}'`,
      STEP_SIZE: `'${options.stepSize ?? '1 day'}'`,
      VEC_TABLE: options.includeVelocity !== false ? "'3'" : "'2'",
      REF_SYSTEM: `'${options.refSystem ?? 'ICRF'}'`,
      REF_PLANE: `'${options.refPlane ?? 'FRAME'}'`,
      VEC_CORR: `'${options.vecCorr ?? 'NONE'}'`,
      CAL_TYPE: "'M'",
      OUT_UNITS: `'${options.outUnits ?? 'KM-S'}'`,
      VEC_LABELS: "'NO'",
      VEC_DELTA_T: "'NO'",
      CSV_FORMAT: "'NO'",
      OBJ_DATA: "'NO'",
    });

    return `${this.baseUrl}?${params}`;
  }
  generateApiString(input: HorizonsUrlSearch): string {
    // Create a string without using URLSearchParams
    return Object.entries(input)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Resolve object name to Horizons ID
   */
  private resolveObjectId(nameOrId: string): CELESTIAL_OBJECTS | string {
    // Check if it's already a numeric ID
    if (/^\d+$/.test(nameOrId)) {
      return nameOrId;
    }

    // Look up in the CELESTIAL_OBJECTS map (case-insensitive)
    const normalizedName = nameOrId.charAt(0).toUpperCase() + nameOrId.slice(1).toLowerCase();
    const objectId = CELESTIAL_OBJECTS[normalizedName as keyof typeof CELESTIAL_OBJECTS];

    if (objectId) {
      return objectId;
    }

    // If not found, return the name as-is and let the API handle it
    return nameOrId;
  }

  /**
   * Get object name from ID
   */
  private getObjectName(objectId: string): CELESTIAL_OBJECTS | undefined {
    const entry = Object.entries(CELESTIAL_OBJECTS).find(([_, id]) => id === objectId) as CELESTIAL_OBJECTS[];
    return entry?.[0];
  }

  /**
   * Format date to YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Parse vector data from the API response
   */
  parseVectorData(rawData: string, includeVelocity = false): [number, [number, number, number], [number, number, number]?][] {
    const vectors: [number, [number, number, number], [number, number, number]?][] = [];

    // Find the section between $$SOE (Start of Ephemeris) and $$EOE (End of Ephemeris)
    const soeIndex = rawData.indexOf('$$SOE');
    const eoeIndex = rawData.indexOf('$$EOE');

    if (soeIndex === -1 || eoeIndex === -1) {
      throw new Error('Could not find ephemeris data in response');
    }

    const ephemerisData = rawData.substring(soeIndex + 5, eoeIndex).trim();
    const lines = ephemerisData.split('\n').filter(line => line.trim());

    // Parse data in groups (each record can span multiple lines)
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      // Look for Julian Date line
      if (RegExp(/^\d{7}\.\d+/).exec(line)) {
        // const parts = line.split(/\s+/);
        // const jd = parseFloat(parts[0]);

        // Next line contains date
        // i++;
        const dateLine = lines[i]?.trim();
        let date = NaN;
        if (dateLine) {
          // Match "1990-Jan-01 00:00:00.0000" (month as 3-letter name) and optional time
          const m = RegExp(/(\d{4})-([A-Za-z]{3})-(\d{2})(?:\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?))?/).exec(dateLine);
          if (m) {
            const [, year, monStr, day, timePart] = m;
            const months: Record<string, string> = {
              jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
              jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
            };
            const mon = months[monStr.toLowerCase()] ?? '01';
            const time = timePart ?? '00:00:00.0000';
            // Build an ISO-like string and parse as UTC
            const iso = `${year}-${mon}-${day}T${time}Z`;
            date = new Date(iso).getTime();
          } else {
            // Fallback: try letting Date parse the line
            const parsed = Date.parse(dateLine);
            date = isNaN(parsed) ? NaN : parsed;
          }
        }

        // Next line contains position X, Y, Z (labels) or plain three numbers
        i++;
        const posLine = lines[i]?.trim();
        const posLabelRegex = /X\s*=\s*([-\d.E+]+)\s+Y\s*=\s*([-\d.E+]+)\s+Z\s*=\s*([-\d.E+]+)/;
        const plainTripleRegex = /^([-\d.E+]+)\s+([-\d.E+]+)\s+([-\d.E+]+)/;
        const posMatch = posLabelRegex.exec(posLine ?? '') || plainTripleRegex.exec(posLine ?? '');

        let velocity: [number, number, number] | undefined;

        if (includeVelocity) {
          // Next line contains velocity VX, VY, VZ (labels) or plain three numbers
          i++;
          const velLine = lines[i]?.trim();
          const velLabelRegex = /VX\s*=\s*([-\d.E+]+)\s+VY\s*=\s*([-\d.E+]+)\s+VZ\s*=\s*([-\d.E+]+)/;
          const velMatch = velLabelRegex.exec(velLine ?? '') || plainTripleRegex.exec(velLine ?? '');

          if (velMatch) {
            velocity = [
              parseFloat(velMatch[1]),
              parseFloat(velMatch[2]),
              parseFloat(velMatch[3])
            ];
          }
        }

        if (posMatch && velocity) {
          vectors.push([
            date,
            [
              parseFloat(posMatch[1]),
              parseFloat(posMatch[2]),
              parseFloat(posMatch[3])
            ],
            velocity,
          ]);
        } else if (posMatch) {
          vectors.push([
            date,
            [
              parseFloat(posMatch[1]),
              parseFloat(posMatch[2]),
              parseFloat(posMatch[3])
            ],
          ]);
        }
      }

      i++;
    }

    return vectors;
  }
}

// Convenience export for direct usage
export default HorizonsAPI;