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
import { earthGravityParam, RAD2DEG } from '../utils/constants';
import type { Satellite } from '../objects/Satellite';
import type { OpmExportOptions, OemExportOptions, OemFromStateVectorsOptions, OmmExportOptions } from './OdmTypes';

/**
 * Exporter for CCSDS Orbit Data Messages (ODM) in KVN format.
 *
 * Supports three message types from the CCSDS 502.0-B-3 standard:
 * - **OPM** (Orbit Parameter Message): single-epoch state vector
 * - **OEM** (Orbit Ephemeris Message): propagated ephemeris over a time span
 * - **OMM** (Orbit Mean-Elements Message): mean orbital elements (TLE equivalent)
 *
 * @see https://public.ccsds.org/Pubs/502x0b3e1.pdf CCSDS ODM Standard
 *
 * @example
 * ```typescript
 * const opm = OdmExporter.formatOpm(satellite, new Date(), {
 *   originator: 'KeepTrack',
 *   includeKeplerian: true,
 * });
 *
 * const oem = OdmExporter.formatOem(satellite, startTime, 24, 60);
 *
 * const omm = OdmExporter.formatOmm(satellite);
 * ```
 */
export class OdmExporter {
  private constructor() {
    // Static-only utility class
  }

  // ==========================================================================
  // OPM — Orbit Parameter Message
  // ==========================================================================

  /**
   * Export a satellite's state at a given epoch as OPM KVN.
   * @param satellite - The satellite to export
   * @param date - The epoch for the state vector
   * @param options - Export configuration
   * @returns OPM KVN format string
   */
  static formatOpm(satellite: Satellite, date: Date, options: OpmExportOptions = {}): string {
    const refFrame = options.refFrame ?? 'TEME';
    const lines: string[] = [];

    // Header
    lines.push('CCSDS_OPM_VERS = 2.0');
    OdmExporter.appendComments_(lines, options.comments);
    lines.push(`CREATION_DATE = ${OdmExporter.formatDateTime_(new Date())}`);
    lines.push(`ORIGINATOR = ${options.originator ?? 'KeepTrack'}`);
    if (options.messageId) {
      lines.push(`MESSAGE_ID = ${options.messageId}`);
    }
    lines.push('');

    // Metadata
    lines.push('META_START');
    lines.push(`OBJECT_NAME = ${satellite.name}`);
    lines.push(`OBJECT_ID = ${satellite.intlDes}`);
    lines.push('CENTER_NAME = EARTH');
    lines.push(`REF_FRAME = ${refFrame}`);
    lines.push('TIME_SYSTEM = UTC');
    lines.push('META_STOP');
    lines.push('');

    // State vector
    const stateEpoch = OdmExporter.formatDateTime_(date);

    if (refFrame === 'EME2000') {
      const j2k = satellite.toJ2000(date);

      lines.push(`EPOCH = ${stateEpoch}`);
      lines.push(`X = ${OdmExporter.formatNumber_(j2k.position.x)} [km]`);
      lines.push(`Y = ${OdmExporter.formatNumber_(j2k.position.y)} [km]`);
      lines.push(`Z = ${OdmExporter.formatNumber_(j2k.position.z)} [km]`);
      lines.push(`X_DOT = ${OdmExporter.formatNumber_(j2k.velocity.x)} [km/s]`);
      lines.push(`Y_DOT = ${OdmExporter.formatNumber_(j2k.velocity.y)} [km/s]`);
      lines.push(`Z_DOT = ${OdmExporter.formatNumber_(j2k.velocity.z)} [km/s]`);
    } else {
      const pv = satellite.eci(date);

      if (!pv || !pv.position || !pv.velocity) {
        throw new Error('SGP4 propagation failed for OPM export');
      }
      lines.push(`EPOCH = ${stateEpoch}`);
      lines.push(`X = ${OdmExporter.formatNumber_(pv.position.x)} [km]`);
      lines.push(`Y = ${OdmExporter.formatNumber_(pv.position.y)} [km]`);
      lines.push(`Z = ${OdmExporter.formatNumber_(pv.position.z)} [km]`);
      lines.push(`X_DOT = ${OdmExporter.formatNumber_(pv.velocity.x)} [km/s]`);
      lines.push(`Y_DOT = ${OdmExporter.formatNumber_(pv.velocity.y)} [km/s]`);
      lines.push(`Z_DOT = ${OdmExporter.formatNumber_(pv.velocity.z)} [km/s]`);
    }

    // Optional Keplerian elements
    if (options.includeKeplerian) {
      lines.push('');
      const ce = satellite.toClassicalElements(date);

      lines.push(`SEMI_MAJOR_AXIS = ${OdmExporter.formatNumber_(ce.semimajorAxis)} [km]`);
      lines.push(`ECCENTRICITY = ${ce.eccentricity.toFixed(12)}`);
      lines.push(`INCLINATION = ${OdmExporter.formatNumber_(ce.inclination * RAD2DEG)} [deg]`);
      lines.push(`RA_OF_ASC_NODE = ${OdmExporter.formatNumber_(ce.rightAscension * RAD2DEG)} [deg]`);
      lines.push(`ARG_OF_PERICENTER = ${OdmExporter.formatNumber_(ce.argPerigee * RAD2DEG)} [deg]`);
      lines.push(`TRUE_ANOMALY = ${OdmExporter.formatNumber_(ce.trueAnomaly * RAD2DEG)} [deg]`);
      lines.push(`GM = ${earthGravityParam.toFixed(4)} [km**3/s**2]`);
    }

    return lines.join('\n');
  }

  // ==========================================================================
  // OEM — Orbit Ephemeris Message
  // ==========================================================================

  /**
   * Export propagated ephemeris as OEM KVN.
   * @param satellite - The satellite to export
   * @param startTime - Start of ephemeris span
   * @param spanHours - Duration in hours
   * @param stepSec - Step size in seconds
   * @param options - Export configuration
   * @returns OEM KVN format string
   */
  static formatOem(
    satellite: Satellite,
    startTime: Date,
    spanHours: number,
    stepSec: number,
    options: OemExportOptions = {},
  ): string {
    const refFrame = options.refFrame ?? 'TEME';
    const totalSeconds = spanHours * 3600;
    const numPoints = Math.floor(totalSeconds / stepSec) + 1;
    const stopTime = new Date(startTime.getTime() + totalSeconds * 1000);

    const lines: string[] = [];

    // Header
    lines.push('CCSDS_OEM_VERS = 2.0');
    OdmExporter.appendComments_(lines, options.comments);
    lines.push(`CREATION_DATE = ${OdmExporter.formatDateTime_(new Date())}`);
    lines.push(`ORIGINATOR = ${options.originator ?? 'KeepTrack'}`);
    if (options.messageId) {
      lines.push(`MESSAGE_ID = ${options.messageId}`);
    }
    lines.push('');

    // Metadata
    lines.push('META_START');
    lines.push(`OBJECT_NAME = ${satellite.name}`);
    lines.push(`OBJECT_ID = ${satellite.intlDes}`);
    lines.push('CENTER_NAME = EARTH');
    lines.push(`REF_FRAME = ${refFrame}`);
    lines.push('TIME_SYSTEM = UTC');
    lines.push(`START_TIME = ${OdmExporter.formatDateTime_(startTime)}`);
    lines.push(`STOP_TIME = ${OdmExporter.formatDateTime_(stopTime)}`);
    lines.push(`INTERPOLATION = ${options.interpolation ?? 'LAGRANGE'}`);
    lines.push(`INTERPOLATION_DEGREE = ${options.interpolationDegree ?? 7}`);
    lines.push('META_STOP');
    lines.push('');

    // Ephemeris data
    for (let i = 0; i < numPoints; i++) {
      const offsetMs = i * stepSec * 1000;
      const time = new Date(startTime.getTime() + offsetMs);
      const epoch = OdmExporter.formatDateTime_(time);

      if (refFrame === 'EME2000') {
        try {
          const j2k = satellite.toJ2000(time);

          lines.push([
            epoch,
            OdmExporter.formatNumber_(j2k.position.x),
            OdmExporter.formatNumber_(j2k.position.y),
            OdmExporter.formatNumber_(j2k.position.z),
            OdmExporter.formatNumber_(j2k.velocity.x),
            OdmExporter.formatNumber_(j2k.velocity.y),
            OdmExporter.formatNumber_(j2k.velocity.z),
          ].join('  '));
        } catch {
          // Skip points where propagation fails
        }
      } else {
        const pv = satellite.eci(time);

        if (pv?.position && pv?.velocity) {
          lines.push([
            epoch,
            OdmExporter.formatNumber_(pv.position.x),
            OdmExporter.formatNumber_(pv.position.y),
            OdmExporter.formatNumber_(pv.position.z),
            OdmExporter.formatNumber_(pv.velocity.x),
            OdmExporter.formatNumber_(pv.velocity.y),
            OdmExporter.formatNumber_(pv.velocity.z),
          ].join('  '));
        }
      }
    }

    return lines.join('\n');
  }

  // ==========================================================================
  // OEM from State Vectors — direct J2000 array export
  // ==========================================================================

  /**
   * Export an array of J2000 state vectors as OEM KVN.
   *
   * Unlike {@link formatOem}, which propagates a TLE-based satellite, this
   * method serializes pre-computed state vectors directly. Useful for
   * converting parsed ephemeris data (e.g., NASA Horizons) to CCSDS OEM.
   *
   * @param stateVectors - Array of J2000 state vectors to export
   * @param metadata - Object identification metadata
   * @param options - Export configuration
   * @returns OEM KVN format string
   */
  static formatOemFromStateVectors(
    stateVectors: J2000[],
    metadata: {
      objectName: string;
      objectId: string;
    },
    options: OemFromStateVectorsOptions = {},
  ): string {
    if (stateVectors.length === 0) {
      throw new Error('Cannot export OEM with no state vectors');
    }

    const refFrame = options.refFrame ?? 'EME2000';
    const centerName = options.centerName ?? 'EARTH';
    const startTime = stateVectors[0].epoch.toDateTime();
    const stopTime = stateVectors[stateVectors.length - 1].epoch.toDateTime();
    const lines: string[] = [];

    // Header
    lines.push('CCSDS_OEM_VERS = 2.0');
    OdmExporter.appendComments_(lines, options.comments);
    lines.push(`CREATION_DATE = ${OdmExporter.formatDateTime_(new Date())}`);
    lines.push(`ORIGINATOR = ${options.originator ?? 'KeepTrack'}`);
    if (options.messageId) {
      lines.push(`MESSAGE_ID = ${options.messageId}`);
    }
    lines.push('');

    // Metadata
    lines.push('META_START');
    lines.push(`OBJECT_NAME = ${metadata.objectName}`);
    lines.push(`OBJECT_ID = ${metadata.objectId}`);
    lines.push(`CENTER_NAME = ${centerName}`);
    lines.push(`REF_FRAME = ${refFrame}`);
    lines.push('TIME_SYSTEM = UTC');
    lines.push(`START_TIME = ${OdmExporter.formatDateTime_(startTime)}`);
    lines.push(`STOP_TIME = ${OdmExporter.formatDateTime_(stopTime)}`);
    lines.push(`INTERPOLATION = ${options.interpolation ?? 'LAGRANGE'}`);
    lines.push(`INTERPOLATION_DEGREE = ${options.interpolationDegree ?? 7}`);
    lines.push('META_STOP');
    lines.push('');

    // Ephemeris data
    for (const sv of stateVectors) {
      const epoch = OdmExporter.formatDateTime_(sv.epoch.toDateTime());

      lines.push([
        epoch,
        OdmExporter.formatNumber_(sv.position.x),
        OdmExporter.formatNumber_(sv.position.y),
        OdmExporter.formatNumber_(sv.position.z),
        OdmExporter.formatNumber_(sv.velocity.x),
        OdmExporter.formatNumber_(sv.velocity.y),
        OdmExporter.formatNumber_(sv.velocity.z),
      ].join('  '));
    }

    return lines.join('\n');
  }

  // ==========================================================================
  // OMM — Orbit Mean-Elements Message
  // ==========================================================================

  /**
   * Export a satellite's mean elements as OMM KVN.
   * @param satellite - The satellite to export
   * @param options - Export configuration
   * @returns OMM KVN format string
   */
  static formatOmm(satellite: Satellite, options: OmmExportOptions = {}): string {
    const lines: string[] = [];

    // Header
    lines.push('CCSDS_OMM_VERS = 2.0');
    OdmExporter.appendComments_(lines, options.comments);
    lines.push(`CREATION_DATE = ${OdmExporter.formatDateTime_(new Date())}`);
    lines.push(`ORIGINATOR = ${options.originator ?? 'KeepTrack'}`);
    if (options.messageId) {
      lines.push(`MESSAGE_ID = ${options.messageId}`);
    }
    lines.push('');

    // Metadata
    lines.push('META_START');
    lines.push(`OBJECT_NAME = ${satellite.name}`);
    lines.push(`OBJECT_ID = ${satellite.intlDes}`);
    lines.push('CENTER_NAME = EARTH');
    lines.push('REF_FRAME = TEME');
    lines.push('TIME_SYSTEM = UTC');
    lines.push('MEAN_ELEMENT_THEORY = SGP4');
    lines.push('META_STOP');
    lines.push('');

    // Mean elements
    const epochDate = OdmExporter.tleEpochToDate_(satellite.epochYear, satellite.epochDay);

    lines.push(`EPOCH = ${OdmExporter.formatDateTime_(epochDate)}`);
    lines.push(`MEAN_MOTION = ${satellite.meanMotion.toFixed(8)} [rev/day]`);
    lines.push(`ECCENTRICITY = ${satellite.eccentricity.toFixed(7)}`);
    lines.push(`INCLINATION = ${satellite.inclination.toFixed(4)} [deg]`);
    lines.push(`RA_OF_ASC_NODE = ${satellite.rightAscension.toFixed(4)} [deg]`);
    lines.push(`ARG_OF_PERICENTER = ${satellite.argOfPerigee.toFixed(4)} [deg]`);
    lines.push(`MEAN_ANOMALY = ${satellite.meanAnomaly.toFixed(4)} [deg]`);
    lines.push('');

    // TLE parameters
    lines.push(`EPHEMERIS_TYPE = ${OdmExporter.getEphemerisType_(satellite)}`);
    lines.push(`CLASSIFICATION_TYPE = ${OdmExporter.getClassificationType_(satellite)}`);
    lines.push(`NORAD_CAT_ID = ${satellite.sccNum}`);
    lines.push(`ELEMENT_SET_NO = ${OdmExporter.getElementSetNo_(satellite)}`);
    lines.push(`REV_AT_EPOCH = ${OdmExporter.getRevAtEpoch_(satellite)}`);
    lines.push(`BSTAR = ${satellite.bstar.toExponential(5)} [1/ER]`);
    lines.push(`MEAN_MOTION_DOT = ${satellite.meanMoDev1.toExponential(5)} [rev/day2]`);
    lines.push(`MEAN_MOTION_DDOT = ${satellite.meanMoDev2.toExponential(5)} [rev/day3]`);

    return lines.join('\n');
  }

  /**
   * Export multiple satellites' mean elements as concatenated OMM KVN blocks.
   * @param satellites - Array of satellites
   * @param options - Export configuration
   * @returns OMM KVN format string with all satellites
   */
  static formatOmmCatalog(satellites: Satellite[], options: OmmExportOptions = {}): string {
    return satellites
      .map((sat, i) => {
        const satOptions = { ...options };

        if (options.messageId) {
          satOptions.messageId = `${options.messageId}-${i + 1}`;
        }

        return OdmExporter.formatOmm(sat, satOptions);
      })
      .join('\n\n');
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /**
   * Format Date to CCSDS datetime string: YYYY-MM-DDTHH:MM:SS.ssssss
   */
  private static formatDateTime_(date: Date): string {
    const y = date.getUTCFullYear();
    const mo = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = date.getUTCDate().toString().padStart(2, '0');
    const h = date.getUTCHours().toString().padStart(2, '0');
    const mi = date.getUTCMinutes().toString().padStart(2, '0');
    const s = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');

    return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}000`;
  }

  /**
   * Format number with 9 decimal places.
   */
  private static formatNumber_(value: number): string {
    return value.toFixed(9);
  }

  /**
   * Append COMMENT lines if provided.
   */
  private static appendComments_(lines: string[], comments?: string[]): void {
    if (comments) {
      for (const comment of comments) {
        lines.push(`COMMENT ${comment}`);
      }
    }
  }

  /**
   * Convert TLE epoch (2-digit year + fractional day) to a Date object.
   */
  private static tleEpochToDate_(epochYear: number, epochDay: number): Date {
    const fullYear = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear;
    const jan1 = new Date(Date.UTC(fullYear, 0, 1));

    return new Date(jan1.getTime() + (epochDay - 1) * 86400000);
  }

  /**
   * Extract ephemeris type from TLE line 1 column 62 (0-indexed).
   */
  private static getEphemerisType_(satellite: Satellite): number {
    if (satellite.tle1) {
      const val = parseInt(satellite.tle1.charAt(62), 10);

      return isNaN(val) ? 0 : val;
    }

    return 0;
  }

  /**
   * Extract classification type from TLE line 1 column 7 (0-indexed).
   */
  private static getClassificationType_(satellite: Satellite): string {
    if (satellite.tle1) {
      const c = satellite.tle1.charAt(7);

      return c === 'C' || c === 'S' ? c : 'U';
    }

    return 'U';
  }

  /**
   * Extract element set number from TLE line 1 columns 64-67 (0-indexed).
   */
  private static getElementSetNo_(satellite: Satellite): number {
    if (satellite.tle1) {
      const val = parseInt(satellite.tle1.substring(64, 68).trim(), 10);

      return isNaN(val) ? 999 : val;
    }

    return 999;
  }

  /**
   * Extract revolution number at epoch from TLE line 2 columns 63-67 (0-indexed).
   */
  private static getRevAtEpoch_(satellite: Satellite): number {
    if (satellite.tle2) {
      const val = parseInt(satellite.tle2.substring(63, 68).trim(), 10);

      return isNaN(val) ? 0 : val;
    }

    return 0;
  }
}
