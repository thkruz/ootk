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
import type { StateCovariance } from '../covariance/StateCovariance';
import type { ConjunctionEvent } from '../conjunction/ConjunctionEvent';
import type { CdmExportOptions, CdmObjectMetadata } from './CdmTypes';

/**
 * Exporter for CCSDS Conjunction Data Message (CDM) KVN format.
 *
 * Exports ConjunctionEvent objects to text-based CDM files conforming
 * to CCSDS 508.0-B-1 standard.
 *
 * @see https://public.ccsds.org/Pubs/508x0b1e2c2.pdf CCSDS CDM Standard
 *
 * @example
 * ```typescript
 * const event = assessment.assess({ startTime, endTime });
 * const cdmContent = CdmExporter.export(event, {
 *   originator: 'OOTK',
 *   messageId: 'CDM-2025-001',
 * });
 * fs.writeFileSync('conjunction.cdm', cdmContent);
 * ```
 */
export class CdmExporter {
  private constructor() {
    // Static-only utility class
  }

  /**
   * Export a ConjunctionEvent to CDM KVN format string.
   * @param event - The conjunction event to export
   * @param options - Export configuration options
   * @returns CDM KVN format string
   */
  static export(event: ConjunctionEvent, options: CdmExportOptions = {}): string {
    const lines: string[] = [];

    // Header section
    lines.push(...CdmExporter.formatHeader_(event, options));
    lines.push('');

    // Relative metadata/data section
    lines.push(...CdmExporter.formatRelativeData_(event));
    lines.push('');

    // Object 1 metadata and data
    lines.push(...CdmExporter.formatObjectMetadata_('OBJECT1', event.primaryState, options.object1Metadata));
    lines.push('');
    lines.push(...CdmExporter.formatObjectData_(
      'OBJECT1',
      event.primaryState,
      event.combinedCovariance,
      options.includeFullCovariance,
    ));
    lines.push('');

    // Object 2 metadata and data
    lines.push(...CdmExporter.formatObjectMetadata_('OBJECT2', event.secondaryState, options.object2Metadata));
    lines.push('');
    lines.push(...CdmExporter.formatObjectData_(
      'OBJECT2',
      event.secondaryState,
      undefined, // Secondary covariance not stored separately
      options.includeFullCovariance,
    ));

    return lines.join('\n');
  }

  /**
   * Export multiple conjunction events to separate CDM strings.
   * @param events - Array of conjunction events
   * @param options - Export configuration options
   * @returns Array of CDM KVN format strings
   */
  static exportMultiple(events: ConjunctionEvent[], options: CdmExportOptions = {}): string[] {
    return events.map((event, index) => {
      const eventOptions = { ...options };

      // Generate unique message ID if base ID provided
      if (options.messageId) {
        eventOptions.messageId = `${options.messageId}-${index + 1}`;
      }

      return CdmExporter.export(event, eventOptions);
    });
  }

  /**
   * Format header section.
   */
  private static formatHeader_(_event: ConjunctionEvent, options: CdmExportOptions): string[] {
    const lines: string[] = [];

    lines.push('CCSDS_CDM_VERS = 1.0');

    // Add comments if provided
    if (options.comments) {
      for (const comment of options.comments) {
        lines.push(`COMMENT ${comment}`);
      }
    }

    lines.push(`CREATION_DATE = ${CdmExporter.formatDateTime_(new Date())}`);
    lines.push(`ORIGINATOR = ${options.originator ?? 'OOTK'}`);

    if (options.messageFor) {
      lines.push(`MESSAGE_FOR = ${options.messageFor}`);
    }
    if (options.messageId) {
      lines.push(`MESSAGE_ID = ${options.messageId}`);
    }

    return lines;
  }

  /**
   * Format relative metadata/data section.
   */
  private static formatRelativeData_(event: ConjunctionEvent): string[] {
    const lines: string[] = [];

    lines.push(`TCA = ${event.tca.toString()}`);
    lines.push(`MISS_DISTANCE = ${CdmExporter.formatNumber_(event.missDistance)} [km]`);

    // Relative position in RTN (RIC) frame
    lines.push(`RELATIVE_POSITION_R = ${CdmExporter.formatNumber_(event.radialDistance)} [km]`);
    lines.push(`RELATIVE_POSITION_T = ${CdmExporter.formatNumber_(event.intrackDistance)} [km]`);
    lines.push(`RELATIVE_POSITION_N = ${CdmExporter.formatNumber_(event.crosstrackDistance)} [km]`);

    // Relative velocity
    lines.push(`RELATIVE_SPEED = ${CdmExporter.formatNumber_(event.relativeVelocity)} [km/s]`);

    // Relative velocity components from RIC if available
    if (event.relativeState) {
      lines.push(`RELATIVE_VELOCITY_R = ${CdmExporter.formatNumber_(event.relativeState.velocity.x)} [km/s]`);
      lines.push(`RELATIVE_VELOCITY_T = ${CdmExporter.formatNumber_(event.relativeState.velocity.y)} [km/s]`);
      lines.push(`RELATIVE_VELOCITY_N = ${CdmExporter.formatNumber_(event.relativeState.velocity.z)} [km/s]`);
    }

    // Probability of collision if available
    if (event.probabilityOfCollision !== undefined) {
      lines.push(`COLLISION_PROBABILITY = ${event.probabilityOfCollision.toExponential(6)}`);
      lines.push('COLLISION_PROBABILITY_METHOD = CHAN-2D');
    }

    return lines;
  }

  /**
   * Format object metadata section.
   */
  private static formatObjectMetadata_(
    objectId: 'OBJECT1' | 'OBJECT2',
    _state: J2000,
    metadata?: Partial<CdmObjectMetadata>,
  ): string[] {
    const lines: string[] = [];

    lines.push(`OBJECT = ${objectId}`);
    lines.push(`OBJECT_DESIGNATOR = ${metadata?.OBJECT_DESIGNATOR ?? 'UNKNOWN'}`);

    if (metadata?.CATALOG_NAME) {
      lines.push(`CATALOG_NAME = ${metadata.CATALOG_NAME}`);
    }
    if (metadata?.OBJECT_NAME) {
      lines.push(`OBJECT_NAME = ${metadata.OBJECT_NAME}`);
    }
    if (metadata?.INTERNATIONAL_DESIGNATOR) {
      lines.push(`INTERNATIONAL_DESIGNATOR = ${metadata.INTERNATIONAL_DESIGNATOR}`);
    }
    if (metadata?.OBJECT_TYPE) {
      lines.push(`OBJECT_TYPE = ${metadata.OBJECT_TYPE}`);
    }
    if (metadata?.OPERATOR_ORGANIZATION) {
      lines.push(`OPERATOR_ORGANIZATION = ${metadata.OPERATOR_ORGANIZATION}`);
    }
    if (metadata?.EPHEMERIS_NAME) {
      lines.push(`EPHEMERIS_NAME = ${metadata.EPHEMERIS_NAME}`);
    }
    if (metadata?.COVARIANCE_METHOD) {
      lines.push(`COVARIANCE_METHOD = ${metadata.COVARIANCE_METHOD}`);
    }
    if (metadata?.MANEUVERABLE) {
      lines.push(`MANEUVERABLE = ${metadata.MANEUVERABLE}`);
    }

    // Default reference frame
    lines.push(`REF_FRAME = ${metadata?.REF_FRAME ?? 'EME2000'}`);

    return lines;
  }

  /**
   * Format object state data section.
   */
  private static formatObjectData_(
    objectId: 'OBJECT1' | 'OBJECT2',
    state: J2000,
    covariance?: StateCovariance,
    includeFullCovariance?: boolean,
  ): string[] {
    const lines: string[] = [];

    lines.push(`OBJECT = ${objectId}`);

    // State vector
    lines.push(`X = ${CdmExporter.formatNumber_(state.position.x)} [km]`);
    lines.push(`Y = ${CdmExporter.formatNumber_(state.position.y)} [km]`);
    lines.push(`Z = ${CdmExporter.formatNumber_(state.position.z)} [km]`);
    lines.push(`X_DOT = ${CdmExporter.formatNumber_(state.velocity.x)} [km/s]`);
    lines.push(`Y_DOT = ${CdmExporter.formatNumber_(state.velocity.y)} [km/s]`);
    lines.push(`Z_DOT = ${CdmExporter.formatNumber_(state.velocity.z)} [km/s]`);

    // Covariance if available
    if (covariance) {
      lines.push(...CdmExporter.formatCovariance_(covariance, includeFullCovariance ?? false));
    }

    return lines;
  }

  /**
   * Format covariance matrix elements.
   */
  private static formatCovariance_(covariance: StateCovariance, full: boolean): string[] {
    const lines: string[] = [];
    const m = covariance.matrix.elements;

    // Position covariance (lower triangular, RTN frame)
    lines.push(`CR_R = ${CdmExporter.formatScientific_(m[0][0])} [km**2]`);
    lines.push(`CT_R = ${CdmExporter.formatScientific_(m[1][0])} [km**2]`);
    lines.push(`CT_T = ${CdmExporter.formatScientific_(m[1][1])} [km**2]`);
    lines.push(`CN_R = ${CdmExporter.formatScientific_(m[2][0])} [km**2]`);
    lines.push(`CN_T = ${CdmExporter.formatScientific_(m[2][1])} [km**2]`);
    lines.push(`CN_N = ${CdmExporter.formatScientific_(m[2][2])} [km**2]`);

    // Velocity covariance if full matrix requested and available
    if (full && m.length >= 6 && m[0].length >= 6) {
      lines.push(`CRDOT_R = ${CdmExporter.formatScientific_(m[3][0])} [km**2/s]`);
      lines.push(`CRDOT_T = ${CdmExporter.formatScientific_(m[3][1])} [km**2/s]`);
      lines.push(`CRDOT_N = ${CdmExporter.formatScientific_(m[3][2])} [km**2/s]`);
      lines.push(`CRDOT_RDOT = ${CdmExporter.formatScientific_(m[3][3])} [km**2/s**2]`);
      lines.push(`CTDOT_R = ${CdmExporter.formatScientific_(m[4][0])} [km**2/s]`);
      lines.push(`CTDOT_T = ${CdmExporter.formatScientific_(m[4][1])} [km**2/s]`);
      lines.push(`CTDOT_N = ${CdmExporter.formatScientific_(m[4][2])} [km**2/s]`);
      lines.push(`CTDOT_RDOT = ${CdmExporter.formatScientific_(m[4][3])} [km**2/s**2]`);
      lines.push(`CTDOT_TDOT = ${CdmExporter.formatScientific_(m[4][4])} [km**2/s**2]`);
      lines.push(`CNDOT_R = ${CdmExporter.formatScientific_(m[5][0])} [km**2/s]`);
      lines.push(`CNDOT_T = ${CdmExporter.formatScientific_(m[5][1])} [km**2/s]`);
      lines.push(`CNDOT_N = ${CdmExporter.formatScientific_(m[5][2])} [km**2/s]`);
      lines.push(`CNDOT_RDOT = ${CdmExporter.formatScientific_(m[5][3])} [km**2/s**2]`);
      lines.push(`CNDOT_TDOT = ${CdmExporter.formatScientific_(m[5][4])} [km**2/s**2]`);
      lines.push(`CNDOT_NDOT = ${CdmExporter.formatScientific_(m[5][5])} [km**2/s**2]`);
    }

    return lines;
  }

  /**
   * Format Date to ISO 8601 string for CDM.
   */
  private static formatDateTime_(date: Date): string {
    return date.toISOString().replace('Z', '');
  }

  /**
   * Format a number with appropriate precision.
   */
  private static formatNumber_(value: number): string {
    return value.toFixed(9);
  }

  /**
   * Format a number in scientific notation.
   */
  private static formatScientific_(value: number): string {
    return value.toExponential(9);
  }
}
