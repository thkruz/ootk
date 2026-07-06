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

import { J2000 } from '../coordinate/J2000';
import { ParseError } from '../errors';
import { InterpolatorType } from '../objects/InterpolatorType';
import { EpochUTC } from '../time/EpochUTC';
import { Kilometers, KilometersPerSecond } from '../types/types';
import { Vector3D } from '../operations/Vector3D';
import type { OemCovarianceMatrix, OemDataBlock, OemHeader, OemMetadata, ParsedOem } from './OemTypes';

/**
 * Parser for CCSDS Orbit Ephemeris Message (OEM) files.
 * Separates parsing concern from EphemerisSatellite object management.
 *
 * @see https://public.ccsds.org/Pubs/502x0b3e1.pdf CCSDS OEM Standard
 *
 * @example
 * ```typescript
 * const oemContent = fs.readFileSync('orbit.oem', 'utf-8');
 * const parsed = OemParser.parse(oemContent);
 * const satellite = EphemerisSatellite.fromParsedOem(parsed);
 * ```
 */
export class OemParser {
  /**
   * Parse OEM text content into structured data.
   * @param content - The raw OEM file content as a string
   * @returns Parsed OEM structure with header and data blocks
   * @throws Error if the file cannot be parsed
   */
  static parse(content: string): ParsedOem {
    const lines = content
      .split(/\r?\n/u)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const header = OemParser.parseHeader_(lines);
    const dataBlocks = OemParser.parseDataBlocks_(lines);

    if (dataBlocks.length === 0) {
      throw new ParseError('OEM file contains no data blocks', 'OEM');
    }

    return { header, dataBlocks };
  }

  /**
   * Get recommended interpolator type from OEM metadata.
   * @param metadata - The OEM metadata block
   * @returns The recommended InterpolatorType based on INTERPOLATION field
   */
  static getRecommendedInterpolator(metadata: OemMetadata): InterpolatorType {
    const interp = metadata.INTERPOLATION?.toUpperCase();

    if (interp === 'LAGRANGE') {
      return InterpolatorType.LAGRANGE;
    }
    if (interp === 'HERMITE') {
      return InterpolatorType.CUBIC_SPLINE;
    }
    if (interp === 'CHEBYSHEV') {
      return InterpolatorType.CHEBYSHEV;
    }

    // Default to Lagrange for unspecified or unknown
    return InterpolatorType.LAGRANGE;
  }

  /**
   * Get interpolation order from OEM metadata.
   * @param metadata - The OEM metadata block
   * @returns The interpolation order (degree), defaults to 10
   */
  static getInterpolationOrder(metadata: OemMetadata): number {
    return metadata.INTERPOLATION_DEGREE ?? 10;
  }

  private static parseHeader_(lines: string[]): OemHeader {
    const header: Partial<OemHeader> = {};
    const comments: string[] = [];

    for (const line of lines) {
      // Stop at first META_START
      if (line.startsWith('META_START')) {
        break;
      }

      if (line.startsWith('COMMENT')) {
        comments.push(line.substring(7).trim());
      } else if (line.includes('=')) {
        const eqIndex = line.indexOf('=');
        const key = line.substring(0, eqIndex).trim();
        const value = line.substring(eqIndex + 1).trim();

        (header as Record<string, string>)[key] = value;
      }
    }

    if (comments.length > 0) {
      header.COMMENT = comments;
    }

    return header as OemHeader;
  }

  private static parseDataBlocks_(lines: string[]): OemDataBlock[] {
    const blocks: OemDataBlock[] = [];
    let currentBlock: Partial<OemDataBlock> | null = null;
    let currentMetadata: Partial<OemMetadata> = {};
    let metadataComments: string[] = [];
    let userDefined: Record<string, string> = {};
    let inMeta = false;
    let inData = false;
    let inCovariance = false;
    let covarianceData: OemCovarianceMatrix[] = [];

    for (const line of lines) {
      // Handle block delimiters
      if (line === 'META_START') {
        currentMetadata = {};
        metadataComments = [];
        userDefined = {};
        inMeta = true;
        continue;
      }

      if (line === 'META_STOP') {
        if (metadataComments.length > 0) {
          currentMetadata.COMMENT = metadataComments;
        }
        if (Object.keys(userDefined).length > 0) {
          currentMetadata.USER_DEFINED = userDefined;
        }
        currentBlock = {
          metadata: currentMetadata as OemMetadata,
          ephemeris: [],
        };
        inMeta = false;
        continue;
      }

      // Handle various data block markers (OEM 1.0 and 2.0 formats)
      if (line === 'DATA_START' || line.match(/^EPHEMERIS_DATA_BLOCK/iu)) {
        inData = true;
        continue;
      }

      if (line === 'DATA_STOP' || line.match(/^EPHEMERIS_DATA_BLOCK.*STOP/iu)) {
        inData = false;
        if (currentBlock) {
          if (covarianceData.length > 0) {
            currentBlock.covariance = covarianceData;
            covarianceData = [];
          }
          blocks.push(currentBlock as OemDataBlock);
          currentBlock = null;
        }
        continue;
      }

      if (line === 'COVARIANCE_START') {
        inCovariance = true;
        continue;
      }

      if (line === 'COVARIANCE_STOP') {
        inCovariance = false;
        continue;
      }

      // Parse metadata key-value pairs
      if (inMeta && line.includes('=')) {
        if (line.startsWith('COMMENT')) {
          metadataComments.push(line.substring(7).trim());
        } else {
          const eqIndex = line.indexOf('=');
          const key = line.substring(0, eqIndex).trim();
          const value = line.substring(eqIndex + 1).trim();

          if (key.startsWith('USER_DEFINED_')) {
            // CCSDS 502.0-B-3 Section 7.5.1 — store without prefix
            userDefined[key.substring(13)] = value;
          } else if (key === 'INTERPOLATION_DEGREE') {
            currentMetadata[key] = parseInt(value, 10);
          } else {
            (currentMetadata as Record<string, string | number>)[key] = value;
          }
        }
      }

      // Parse ephemeris data lines
      if (inData && currentBlock && !line.startsWith('COMMENT')) {
        const state = OemParser.parseStateVector_(line);

        if (state) {
          currentBlock.ephemeris!.push(state);
        }
      }

      // Parse covariance data (stored but not processed)
      if (inCovariance && currentBlock) {
        const cov = OemParser.parseCovarianceLine_(line);

        if (cov) {
          covarianceData.push(cov);
        }
      }
    }

    return blocks;
  }

  private static parseStateVector_(line: string): J2000 | null {
    const parts = line.trim().split(/\s+/u);

    // Need at least: epoch x y z vx vy vz
    if (parts.length < 7) {
      return null;
    }

    try {
      const epoch = EpochUTC.fromDateTimeString(parts[0]);
      const position = new Vector3D(
        parseFloat(parts[1]) as Kilometers,
        parseFloat(parts[2]) as Kilometers,
        parseFloat(parts[3]) as Kilometers,
      );
      const velocity = new Vector3D(
        parseFloat(parts[4]) as KilometersPerSecond,
        parseFloat(parts[5]) as KilometersPerSecond,
        parseFloat(parts[6]) as KilometersPerSecond,
      );

      return new J2000(epoch, position, velocity);
    } catch {
      // Skip malformed lines
      return null;
    }
  }

  private static parseCovarianceLine_(line: string): OemCovarianceMatrix | null {
    // Covariance parsing is minimal - just store the raw data
    // Full processing is deferred to future enhancement
    const parts = line.trim().split(/\s+/u);

    if (parts.length < 2) {
      return null;
    }

    // Check if this looks like an EPOCH line
    if (line.includes('EPOCH')) {
      return null; // Skip epoch markers, actual data comes on following lines
    }

    try {
      // Try to parse as covariance values (21 values for 6x6 lower triangular)
      const values = parts.map((p) => parseFloat(p)).filter((n) => !isNaN(n));

      if (values.length > 0) {
        return {
          epoch: new Date(), // Placeholder - proper epoch handling deferred
          values,
        };
      }

      return null;
    } catch {
      return null;
    }
  }
}
