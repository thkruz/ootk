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
import { DataHandler } from '../data/DataHandler';
import { ParseError } from '../errors';
import { InterpolatorType } from '../objects/InterpolatorType';
import { EpochUTC } from '../time/EpochUTC';
import { Kilometers, KilometersPerSecond, Seconds } from '../types/types';
import { Vector3D } from '../operations/Vector3D';
import type { OemCovarianceMatrix, OemDataBlock, OemHeader, OemMetadata, ParsedOem } from './OemTypes';

/** Mutable state for one pass over the OEM body. */
interface OemBlockState_ {
  blocks: OemDataBlock[];
  block: OemDataBlock | null;
  meta: Partial<OemMetadata>;
  metaComments: string[];
  userDefined: Record<string, string>;
  section: 'none' | 'meta' | 'data' | 'covariance';
  cov: { matrices: OemCovarianceMatrix[]; epoch: Date | null; refFrame?: string; values: number[] };
}

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

  /**
   * Walk the body of an OEM and build its data blocks.
   *
   * CCSDS 502.0-B-3 section 5.2 (KVN): each block is `META_START ... META_STOP`, then the
   * ephemeris data lines directly, then an optional `COVARIANCE_START ... COVARIANCE_STOP`
   * section; the block ends at the next `META_START` or the end of the file. `DATA_START` /
   * `DATA_STOP` and `EPHEMERIS_DATA_BLOCK_START` / `_STOP` are not in the standard but are
   * written by some tools, so they are accepted as optional markers.
   * @param lines Trimmed, non-empty lines of the file.
   * @returns The parsed data blocks in file order.
   * @throws ParseError for an unsupported TIME_SYSTEM or a malformed covariance section.
   */
  private static parseDataBlocks_(lines: string[]): OemDataBlock[] {
    const st: OemBlockState_ = {
      blocks: [],
      block: null,
      meta: {},
      metaComments: [],
      userDefined: {},
      section: 'none',
      cov: { matrices: [], epoch: null, values: [] },
    };

    for (const line of lines) {
      if (!OemParser.handleMarker_(st, line)) {
        OemParser.handleContent_(st, line);
      }
    }

    OemParser.closeBlock_(st);

    return st.blocks;
  }

  /**
   * Apply a section marker line to the parse state.
   * @param st Parse state.
   * @param line The line.
   * @returns True when the line was a marker.
   */
  private static handleMarker_(st: OemBlockState_, line: string): boolean {
    if (line === 'META_START') {
      OemParser.closeBlock_(st);
      st.meta = {};
      st.metaComments = [];
      st.userDefined = {};
      st.section = 'meta';
    } else if (line === 'META_STOP') {
      if (st.metaComments.length > 0) {
        st.meta.COMMENT = st.metaComments;
      }
      if (Object.keys(st.userDefined).length > 0) {
        st.meta.USER_DEFINED = st.userDefined;
      }
      // Validate the time system once, so a data line is never silently read on the wrong scale
      OemParser.secondsToTai_(st.meta.TIME_SYSTEM);
      st.block = { metadata: st.meta as OemMetadata, ephemeris: [] };
      // Spec-compliant OEM: data lines follow META_STOP directly
      st.section = 'data';
    } else if (line === 'DATA_STOP' || (/^EPHEMERIS_DATA_BLOCK\w*STOP$/iu).test(line)) {
      // Optional non-standard markers. STOP is tested first: "..._STOP" also starts with the START prefix
      st.section = 'none';
    } else if (line === 'DATA_START' || (/^EPHEMERIS_DATA_BLOCK\w*START$/iu).test(line)) {
      st.section = st.block ? 'data' : 'none';
    } else if (line === 'COVARIANCE_START') {
      st.section = 'covariance';
      st.cov.epoch = null;
      st.cov.refFrame = undefined;
      st.cov.values = [];
    } else if (line === 'COVARIANCE_STOP') {
      OemParser.assertNoPartialCovariance_(st);
      st.section = 'none';
    } else {
      return false;
    }

    return true;
  }

  /**
   * Apply a metadata, data or covariance content line to the parse state.
   * @param st Parse state.
   * @param line The line.
   */
  private static handleContent_(st: OemBlockState_, line: string): void {
    if (st.section === 'meta') {
      OemParser.handleMetaLine_(st, line);

      return;
    }
    if (line.startsWith('COMMENT') || !st.block) {
      return;
    }
    if (st.section === 'covariance') {
      OemParser.handleCovarianceLine_(st, st.block, line);
    } else if (st.section === 'data') {
      const state = OemParser.parseStateVector_(line, st.block.metadata.TIME_SYSTEM);

      if (state) {
        st.block.ephemeris.push(state);
      }
    }
  }

  private static handleMetaLine_(st: OemBlockState_, line: string): void {
    if (line.startsWith('COMMENT')) {
      st.metaComments.push(line.substring(7).trim());

      return;
    }
    if (!line.includes('=')) {
      return;
    }

    const eqIndex = line.indexOf('=');
    const key = line.substring(0, eqIndex).trim();
    const value = line.substring(eqIndex + 1).trim();

    if (key.startsWith('USER_DEFINED_')) {
      // CCSDS 502.0-B-3 Section 7.5.1: store without prefix
      st.userDefined[key.substring(13)] = value;
    } else if (key === 'INTERPOLATION_DEGREE') {
      st.meta[key] = parseInt(value, 10);
    } else {
      (st.meta as Record<string, string | number>)[key] = value;
    }
  }

  /**
   * CCSDS 502.0-B-3 section 5.2.5: EPOCH, optional COV_REF_FRAME, then the 21 lower-triangular
   * terms, which may be spread over any number of lines (normally 6 rows of 1 to 6 values).
   */
  private static handleCovarianceLine_(st: OemBlockState_, block: OemDataBlock, line: string): void {
    const cov = st.cov;

    if (line.includes('=')) {
      const eqIndex = line.indexOf('=');
      const key = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 1).trim();

      if (key === 'EPOCH') {
        OemParser.assertNoPartialCovariance_(st);
        cov.epoch = OemParser.parseEpoch_(value, block.metadata.TIME_SYSTEM).toDateTime();
        cov.refFrame = undefined;
      } else if (key === 'COV_REF_FRAME') {
        cov.refFrame = value;
      }

      return;
    }

    const values = line.split(/\s+/u).map((p) => Number(p));

    if (values.some((v) => !Number.isFinite(v))) {
      throw new ParseError(`Malformed OEM covariance line: "${line}"`, 'OEM');
    }
    cov.values.push(...values);

    if (cov.values.length < 21) {
      return;
    }
    if (!cov.epoch) {
      throw new ParseError('OEM covariance matrix has no EPOCH', 'OEM');
    }

    const matrix: OemCovarianceMatrix = { epoch: cov.epoch, values: cov.values.slice(0, 21) };

    if (cov.refFrame) {
      matrix.refFrame = cov.refFrame;
    }
    cov.matrices.push(matrix);
    cov.epoch = null;
    cov.refFrame = undefined;
    cov.values = [];
  }

  private static assertNoPartialCovariance_(st: OemBlockState_): void {
    if (st.cov.values.length > 0) {
      throw new ParseError(`OEM covariance matrix has ${st.cov.values.length} of 21 lower-triangular terms`, 'OEM');
    }
  }

  private static closeBlock_(st: OemBlockState_): void {
    if (st.block) {
      if (st.cov.matrices.length > 0) {
        st.block.covariance = st.cov.matrices;
      }
      st.blocks.push(st.block);
    }
    st.block = null;
    st.cov = { matrices: [], epoch: null, values: [] };
    st.section = 'none';
  }

  /**
   * Seconds to add to a time on the given scale to reach TAI.
   *
   * Supported: UTC (default when absent; returns null because UTC needs the leap-second table),
   * TAI (0), GPS (+19 s, constant since 1980) and TT (-32.184 s). TDB is treated as TT:
   * |TDB - TT| < 1.7 ms (Vallado 4th ed. eq. 3-48), under 13 m along-track in LEO.
   * @param timeSystem The TIME_SYSTEM value.
   * @returns The offset in seconds, or null for UTC.
   * @throws ParseError for any other time system.
   */
  private static secondsToTai_(timeSystem?: string): number | null {
    switch ((timeSystem ?? 'UTC').trim().toUpperCase()) {
      case 'UTC':
        return null;
      case 'TAI':
        return 0;
      case 'GPS':
        return 19;
      case 'TT':
      case 'TDB':
        return -32.184;
      default:
        throw new ParseError(`Unsupported OEM TIME_SYSTEM "${timeSystem}"; use UTC, TAI, TT, TDB or GPS`, 'OEM');
    }
  }

  /**
   * Parse a CCSDS epoch (502.0-B-3 section 7.5.10): calendar `YYYY-MM-DDThh:mm:ss[.d]` or
   * day-of-year `YYYY-DDDThh:mm:ss[.d]`, with an optional trailing `Z`, on the block's
   * `TIME_SYSTEM` (see {@link secondsToTai_}), converted to UTC.
   * @param text The epoch text.
   * @param timeSystem The block's TIME_SYSTEM value.
   * @returns The epoch on the UTC scale.
   * @throws ParseError for a malformed epoch or an unsupported time system.
   */
  private static parseEpoch_(text: string, timeSystem?: string): EpochUTC {
    const trimmed = text.trim().replace(/Z$/iu, '');
    const doy = (/^(\d{4})-(\d{3})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)$/u).exec(trimmed);
    let ms = NaN;

    if (doy) {
      ms = Date.UTC(Number(doy[1]), 0, Number(doy[2]), Number(doy[3]), Number(doy[4])) + Number(doy[5]) * 1000;
    } else if ((/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d*)?)?$/u).test(trimmed)) {
      ms = EpochUTC.fromDateTimeString(trimmed).toDateTime().getTime();
    }

    if (!Number.isFinite(ms)) {
      throw new ParseError(`Malformed OEM epoch: "${text}"`, 'OEM');
    }

    const toTai = OemParser.secondsToTai_(timeSystem);

    if (toTai === null) {
      return new EpochUTC(ms / 1000 as Seconds);
    }

    // UTC = TAI - (TAI - UTC), the leap-second count looked up on the TAI scale
    const taiSec = ms / 1000 + toTai;
    const leap = DataHandler.getInstance().getLeapSecondsFromTai(taiSec / 86400 + 2440587.5);

    return new EpochUTC(taiSec - leap as Seconds);
  }

  /**
   * Parse one ephemeris data line: epoch, X, Y, Z (km), X_DOT, Y_DOT, Z_DOT (km/s), with optional
   * accelerations that are ignored.
   * @param line The data line.
   * @param timeSystem The block's TIME_SYSTEM (validated at META_STOP).
   * @returns The state, or null for a malformed line.
   */
  private static parseStateVector_(line: string, timeSystem?: string): J2000 | null {
    const parts = line.trim().split(/\s+/u);

    if (parts.length < 7) {
      return null;
    }

    try {
      const epoch = OemParser.parseEpoch_(parts[0], timeSystem);
      const nums = parts.slice(1, 7).map((p) => Number(p));

      if (nums.some((n) => !Number.isFinite(n))) {
        return null;
      }
      const position = new Vector3D(nums[0] as Kilometers, nums[1] as Kilometers, nums[2] as Kilometers);
      const velocity = new Vector3D(
        nums[3] as KilometersPerSecond,
        nums[4] as KilometersPerSecond,
        nums[5] as KilometersPerSecond,
      );

      return new J2000(epoch, position, velocity);
    } catch {
      // Skip malformed lines
      return null;
    }
  }
}
