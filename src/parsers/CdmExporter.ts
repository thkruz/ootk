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
import { RelativeState } from '../coordinate/RelativeState';
import { RIC } from '../coordinate/RIC';
import { CovarianceFrame, type StateCovariance } from '../covariance/StateCovariance';
import { Matrix } from '../operations/Matrix';
import type { ConjunctionEvent } from '../conjunction/ConjunctionEvent';
import type { CdmExportOptions, CdmObjectMetadata } from './CdmTypes';

/**
 * Exporter for CCSDS Conjunction Data Message (CDM) KVN format.
 *
 * Exports ConjunctionEvent objects to text-based CDM files conforming
 * to CCSDS 508.0-B-1 standard.
 *
 * Units follow CCSDS 508.0-B-1 Tables 3-3 and 3-4: MISS_DISTANCE and RELATIVE_POSITION_* in [m],
 * RELATIVE_SPEED and RELATIVE_VELOCITY_* in [m/s], the state vector in [km] and [km/s], and the
 * covariance in [m**2], [m**2/s] and [m**2/s**2]. ootk's km values are converted on output.
 *
 * Each object's covariance is written in that object's own RTN frame: OBJECT1 from
 * `event.primaryCovariance`, OBJECT2 from `event.secondaryCovariance` (an ECI covariance is
 * rotated into the object's RTN first). `combinedCovariance` is never written, because a CDM has
 * no slot for it. By default the full 21-term 6x6 is written, as CDM 1.0 requires.
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
    lines.push(...CdmExporter.formatRelativeData_(event, options));
    lines.push('');

    // Object 1 metadata and data
    lines.push(...CdmExporter.formatObjectMetadata_('OBJECT1', event, options.object1Metadata));
    lines.push('');
    lines.push(...CdmExporter.formatObjectData_(
      'OBJECT1',
      event.primaryState,
      event.primaryCovariance,
      options.includeFullCovariance ?? true,
    ));
    lines.push('');

    // Object 2 metadata and data
    lines.push(...CdmExporter.formatObjectMetadata_('OBJECT2', event, options.object2Metadata));
    lines.push('');
    lines.push(...CdmExporter.formatObjectData_(
      'OBJECT2',
      event.secondaryState,
      event.secondaryCovariance,
      options.includeFullCovariance ?? true,
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
   * Signed relative position (km) and velocity (km/s) of OBJECT2 with respect to OBJECT1 in
   * OBJECT1's RTN frame, both from ONE source so the CDM never mixes them:
   *
   * - When the event stores all three relative velocity components, the stored position
   *   (radialDistance, intrackDistance, crosstrackDistance) and the stored velocity are used.
   * - Otherwise both are recomputed from the two J2000 states with RIC.fromJ2000.
   * @param event The conjunction event
   * @returns Position [R, T, N] in km and velocity [R, T, N] in km/s
   */
  private static relativeRtn_(event: ConjunctionEvent): { pos: number[]; vel: number[] } {
    const { radialVelocity, intrackVelocity, crosstrackVelocity } = event;

    if (radialVelocity !== undefined && intrackVelocity !== undefined && crosstrackVelocity !== undefined) {
      return {
        pos: [event.radialDistance, event.intrackDistance, event.crosstrackDistance],
        vel: [radialVelocity, intrackVelocity, crosstrackVelocity],
      };
    }

    const ric = RIC.fromJ2000(event.secondaryState, event.primaryState);

    return {
      pos: [ric.position.x, ric.position.y, ric.position.z],
      vel: [ric.velocity.x, ric.velocity.y, ric.velocity.z],
    };
  }

  /**
   * Format relative metadata/data section in CCSDS 508.0-B-1 Table 3-2 order. Lengths in m and
   * speeds in m/s (Table 3-3); ootk's km and km/s are multiplied by 1000. RELATIVE_POSITION_* and
   * RELATIVE_VELOCITY_* are signed and come from one source (see relativeRtn_). The screening
   * period and volume are written when the event carries them.
   */
  private static formatRelativeData_(event: ConjunctionEvent, options: CdmExportOptions): string[] {
    const lines: string[] = [];
    const m = (km: number): string => CdmExporter.formatMetres_(km);
    const { pos, vel } = CdmExporter.relativeRtn_(event);

    lines.push(`TCA = ${event.tca.toString()}`);
    lines.push(`MISS_DISTANCE = ${m(event.missDistance)} [m]`);
    lines.push(`RELATIVE_SPEED = ${m(event.relativeVelocity)} [m/s]`);

    lines.push(`RELATIVE_POSITION_R = ${m(pos[0])} [m]`);
    lines.push(`RELATIVE_POSITION_T = ${m(pos[1])} [m]`);
    lines.push(`RELATIVE_POSITION_N = ${m(pos[2])} [m]`);
    lines.push(`RELATIVE_VELOCITY_R = ${m(vel[0])} [m/s]`);
    lines.push(`RELATIVE_VELOCITY_T = ${m(vel[1])} [m/s]`);
    lines.push(`RELATIVE_VELOCITY_N = ${m(vel[2])} [m/s]`);

    const sv = event.screenVolume;

    if (sv) {
      const optional: [string, string | undefined][] = [
        ['START_SCREEN_PERIOD', sv.startScreenPeriod],
        ['STOP_SCREEN_PERIOD', sv.stopScreenPeriod],
        ['SCREEN_VOLUME_FRAME', sv.frame],
        ['SCREEN_VOLUME_SHAPE', sv.shape],
        ['SCREEN_VOLUME_X', sv.x === undefined ? undefined : `${m(sv.x)} [m]`],
        ['SCREEN_VOLUME_Y', sv.y === undefined ? undefined : `${m(sv.y)} [m]`],
        ['SCREEN_VOLUME_Z', sv.z === undefined ? undefined : `${m(sv.z)} [m]`],
        ['SCREEN_ENTRY_TIME', sv.entryTime],
        ['SCREEN_EXIT_TIME', sv.exitTime],
      ];

      for (const [key, value] of optional) {
        if (value !== undefined) {
          lines.push(`${key} = ${value}`);
        }
      }
    }

    // Probability of collision if available
    if (event.probabilityOfCollision !== undefined) {
      lines.push(`COLLISION_PROBABILITY = ${event.probabilityOfCollision.toExponential(6)}`);
      /*
       * ootk's ProbabilityOfCollision integrates the 2D Gaussian over the hard-body disc exactly,
       * which is Foster and Estes (1992); FOSTER-1992 is the SANA registry value for it.
       */
      lines.push(`COLLISION_PROBABILITY_METHOD = ${options.collisionProbabilityMethod ?? 'FOSTER-1992'}`);
    }

    return lines;
  }

  /**
   * Format object metadata section. CCSDS 508.0-B-1 Table 3-3 makes OBJECT_DESIGNATOR,
   * CATALOG_NAME, OBJECT_NAME, INTERNATIONAL_DESIGNATOR, EPHEMERIS_NAME, COVARIANCE_METHOD,
   * MANEUVERABLE and REF_FRAME mandatory, so each is written: from the options first, then the
   * event (OBJECT_DESIGNATOR is the catalog number in CATALOG_NAME = SATCAT, INTERNATIONAL_DESIGNATOR
   * the COSPAR id), then a neutral default. REF_FRAME is EME2000 because the event states are J2000.
   */
  private static formatObjectMetadata_(
    objectId: 'OBJECT1' | 'OBJECT2',
    event: ConjunctionEvent,
    metadata?: Partial<CdmObjectMetadata>,
  ): string[] {
    const lines: string[] = [];
    const isPrimary = objectId === 'OBJECT1';
    const eventName = isPrimary ? event.primaryName : event.secondaryName;
    const eventDesignator = isPrimary ? event.primaryDesignator : event.secondaryDesignator;
    const eventIntlDes = isPrimary ? event.primaryInternationalDesignator : event.secondaryInternationalDesignator;
    const eventEphemeris = isPrimary ? event.primaryEphemerisName : event.secondaryEphemerisName;
    const eventManeuverable = isPrimary ? event.primaryManeuverable : event.secondaryManeuverable;

    lines.push(`OBJECT = ${objectId}`);
    lines.push(`OBJECT_DESIGNATOR = ${metadata?.OBJECT_DESIGNATOR ?? eventDesignator ?? 'UNKNOWN'}`);
    lines.push(`CATALOG_NAME = ${metadata?.CATALOG_NAME ?? 'SATCAT'}`);
    lines.push(`OBJECT_NAME = ${metadata?.OBJECT_NAME ?? eventName ?? 'UNKNOWN'}`);
    lines.push(`INTERNATIONAL_DESIGNATOR = ${metadata?.INTERNATIONAL_DESIGNATOR ?? eventIntlDes ?? 'UNKNOWN'}`);
    if (metadata?.OBJECT_TYPE) {
      lines.push(`OBJECT_TYPE = ${metadata.OBJECT_TYPE}`);
    }
    if (metadata?.OPERATOR_ORGANIZATION) {
      lines.push(`OPERATOR_ORGANIZATION = ${metadata.OPERATOR_ORGANIZATION}`);
    }
    lines.push(`EPHEMERIS_NAME = ${metadata?.EPHEMERIS_NAME ?? eventEphemeris ?? 'NONE'}`);
    lines.push(`COVARIANCE_METHOD = ${metadata?.COVARIANCE_METHOD ?? 'CALCULATED'}`);
    lines.push(`MANEUVERABLE = ${metadata?.MANEUVERABLE ?? eventManeuverable ?? 'N/A'}`);
    lines.push('REF_FRAME = EME2000');

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

    // Covariance if available, in this object's own RTN frame
    if (covariance) {
      lines.push(...CdmExporter.formatCovariance_(CdmExporter.toRtn_(covariance, state), includeFullCovariance ?? true));
    }

    return lines;
  }

  /**
   * Express a covariance in the RTN frame of `state`. An RIC covariance is returned unchanged
   * (ootk's RIC is the CDM's RTN: R = r/|r|, N = r x v/|r x v|, T = N x R). An ECI covariance is
   * rotated, C_rtn = Q6 C Q6^T with Q6 = blockdiag(Q, Q), Q rows = R, T, N in J2000.
   * @param covariance The covariance (km units).
   * @param state The object's J2000 state that defines its RTN frame.
   * @returns The covariance in the object's RTN frame.
   */
  private static toRtn_(covariance: StateCovariance, state: J2000): Matrix {
    if (covariance.frame !== CovarianceFrame.ECI) {
      return covariance.matrix;
    }

    const q = RelativeState.createMatrix(state.position, state.velocity).elements;
    const n = covariance.matrix.elements.length;
    const t: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));

    for (let b = 0; b + 3 <= n; b += 3) {
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          t[b + i][b + j] = q[i][j];
        }
      }
    }
    const tm = new Matrix(t);

    return tm.multiply(covariance.matrix).multiply(tm.transpose());
  }

  /**
   * Format covariance matrix elements (lower triangle, RTN) in m**2, m**2/s and m**2/s**2
   * (CCSDS 508.0-B-1 Table 3-4); ootk's km-based terms are multiplied by 1e6.
   * @param m The covariance in km units, R, T, N, Rdot, Tdot, Ndot order.
   * @param full Write the 15 velocity terms when the matrix is 6x6.
   * @returns KVN lines.
   */
  private static formatCovariance_(m: Matrix, full: boolean): string[] {
    const lines: string[] = [];
    const e = m.elements;
    const v = (i: number, j: number): string => CdmExporter.formatScientific_(e[i][j] * 1e6);

    // Position covariance (lower triangular, RTN frame)
    lines.push(`CR_R = ${v(0, 0)} [m**2]`);
    lines.push(`CT_R = ${v(1, 0)} [m**2]`);
    lines.push(`CT_T = ${v(1, 1)} [m**2]`);
    lines.push(`CN_R = ${v(2, 0)} [m**2]`);
    lines.push(`CN_T = ${v(2, 1)} [m**2]`);
    lines.push(`CN_N = ${v(2, 2)} [m**2]`);

    // Velocity covariance (CDM 1.0 requires all 21 terms)
    if (full && e.length >= 6 && e[0].length >= 6) {
      lines.push(`CRDOT_R = ${v(3, 0)} [m**2/s]`);
      lines.push(`CRDOT_T = ${v(3, 1)} [m**2/s]`);
      lines.push(`CRDOT_N = ${v(3, 2)} [m**2/s]`);
      lines.push(`CRDOT_RDOT = ${v(3, 3)} [m**2/s**2]`);
      lines.push(`CTDOT_R = ${v(4, 0)} [m**2/s]`);
      lines.push(`CTDOT_T = ${v(4, 1)} [m**2/s]`);
      lines.push(`CTDOT_N = ${v(4, 2)} [m**2/s]`);
      lines.push(`CTDOT_RDOT = ${v(4, 3)} [m**2/s**2]`);
      lines.push(`CTDOT_TDOT = ${v(4, 4)} [m**2/s**2]`);
      lines.push(`CNDOT_R = ${v(5, 0)} [m**2/s]`);
      lines.push(`CNDOT_T = ${v(5, 1)} [m**2/s]`);
      lines.push(`CNDOT_N = ${v(5, 2)} [m**2/s]`);
      lines.push(`CNDOT_RDOT = ${v(5, 3)} [m**2/s**2]`);
      lines.push(`CNDOT_TDOT = ${v(5, 4)} [m**2/s**2]`);
      lines.push(`CNDOT_NDOT = ${v(5, 5)} [m**2/s**2]`);
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
   * Format a km (or km/s) value in m (or m/s) to 1 micrometre.
   */
  private static formatMetres_(valueKm: number): string {
    return (valueKm * 1000).toFixed(6);
  }

  /**
   * Format a number in scientific notation.
   */
  private static formatScientific_(value: number): string {
    return value.toExponential(9);
  }
}
