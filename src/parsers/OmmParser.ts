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

import { ParseError } from '../errors';
import type { OmmDataFormat } from '../interfaces/OmmFormat';
import type {
  OmmCovarianceMatrix,
  OmmHeader,
  OmmMeanElements,
  OmmMetadata,
  OmmSpacecraftParameters,
  OmmTleParameters,
  OmmUserDefined,
  ParsedOmm,
} from './OmmTypes';

/**
 * Parser for CCSDS Orbit Mean-Elements Message (OMM) KVN format.
 *
 * Parses text-based OMM files conforming to CCSDS 502.0-B-3 Section 4.
 * Supports TLE-compatible mean elements (SGP/SGP4/SGP4-XP) and other
 * mean element theories (DSST, USM).
 *
 * @see https://public.ccsds.org/Pubs/502x0b3e1.pdf CCSDS OMM Standard
 *
 * @example
 * ```typescript
 * const ommContent = fs.readFileSync('orbit.omm', 'utf-8');
 * const parsed = OmmParser.parse(ommContent);
 * console.log(parsed.meanElements.EPOCH);
 * console.log(parsed.meanElements.MEAN_MOTION);
 * ```
 */
export class OmmParser {
  private constructor() {
    // Static-only utility class
  }

  /**
   * Parse OMM KVN format text into structured data.
   * @param content - The raw OMM file content as a string
   * @returns Parsed OMM structure with all sections
   * @throws ParseError if the file cannot be parsed or is missing required fields
   */
  static parse(content: string): ParsedOmm {
    const lines = content
      .split(/\r?\n/u)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const keyValues = OmmParser.parseKeyValues_(lines);
    const comments = OmmParser.parseComments_(lines);

    const header = OmmParser.parseHeader_(keyValues, comments.header);
    const metadata = OmmParser.parseMetadata_(keyValues, comments.metadata);
    const meanElements = OmmParser.parseMeanElements_(keyValues, comments.meanElements);

    const result: ParsedOmm = { header, metadata, meanElements };

    const spacecraftParameters = OmmParser.parseSpacecraftParameters_(keyValues, comments.spacecraft);

    if (spacecraftParameters) {
      result.spacecraftParameters = spacecraftParameters;
    }

    const tleParameters = OmmParser.parseTleParameters_(keyValues, comments.tle);

    if (tleParameters) {
      result.tleParameters = tleParameters;
    }

    const covarianceMatrix = OmmParser.parseCovarianceMatrix_(keyValues, comments.covariance);

    if (covarianceMatrix) {
      result.covarianceMatrix = covarianceMatrix;
    }

    const userDefined = OmmParser.parseUserDefined_(keyValues);

    if (userDefined) {
      result.userDefined = userDefined;
    }

    OmmParser.validate_(result);

    return result;
  }

  /**
   * Check if a parsed OMM represents TLE-compatible data.
   * @param omm - Parsed OMM structure
   * @returns true if the OMM uses SGP, SGP4, or SGP4-XP mean element theory
   */
  static isTleCompatible(omm: ParsedOmm): boolean {
    const theory = omm.metadata.MEAN_ELEMENT_THEORY.toUpperCase();

    return theory === 'SGP' || theory === 'SGP4' || theory === 'SGP4-XP';
  }

  /**
   * Parse a CelesTrak-style flat JSON OMM object into the structured ParsedOmm format.
   *
   * CelesTrak's JSON OMM format is a flat object with all fields at the top level,
   * omitting metadata fields like CENTER_NAME, REF_FRAME, TIME_SYSTEM, and
   * MEAN_ELEMENT_THEORY (which are always EARTH/TEME/UTC/SGP4 for GP data).
   *
   * @param omm - A flat OMM JSON object from CelesTrak
   * @returns Parsed OMM structure with inferred metadata
   */
  static parseJson(omm: OmmDataFormat): ParsedOmm {
    const result: ParsedOmm = {
      header: {
        CCSDS_OMM_VERS: '3.0',
        CREATION_DATE: new Date().toISOString(),
        ORIGINATOR: 'CelesTrak',
      },
      metadata: {
        OBJECT_NAME: omm.OBJECT_NAME,
        OBJECT_ID: omm.OBJECT_ID,
        CENTER_NAME: 'EARTH',
        REF_FRAME: 'TEME',
        TIME_SYSTEM: 'UTC',
        MEAN_ELEMENT_THEORY: 'SGP4',
      },
      meanElements: {
        EPOCH: omm.EPOCH,
        MEAN_MOTION: Number(omm.MEAN_MOTION),
        ECCENTRICITY: Number(omm.ECCENTRICITY),
        INCLINATION: Number(omm.INCLINATION),
        RA_OF_ASC_NODE: Number(omm.RA_OF_ASC_NODE),
        ARG_OF_PERICENTER: Number(omm.ARG_OF_PERICENTER),
        MEAN_ANOMALY: Number(omm.MEAN_ANOMALY),
      },
      tleParameters: {
        EPHEMERIS_TYPE: Number(omm.EPHEMERIS_TYPE),
        CLASSIFICATION_TYPE: String(omm.CLASSIFICATION_TYPE),
        NORAD_CAT_ID: Number(omm.NORAD_CAT_ID),
        ELEMENT_SET_NO: Number(omm.ELEMENT_SET_NO),
        REV_AT_EPOCH: Number(omm.REV_AT_EPOCH),
        BSTAR: Number(omm.BSTAR),
        MEAN_MOTION_DOT: Number(omm.MEAN_MOTION_DOT),
        MEAN_MOTION_DDOT: Number(omm.MEAN_MOTION_DDOT),
      },
    };

    return result;
  }

  /**
   * Parse an array of CelesTrak-style flat JSON OMM objects.
   * @param ommArray - Array of flat OMM JSON objects from CelesTrak
   * @returns Array of parsed OMM structures
   */
  static parseJsonArray(ommArray: OmmDataFormat[]): ParsedOmm[] {
    return ommArray.map((omm) => OmmParser.parseJson(omm));
  }

  /**
   * Parse all key-value pairs from OMM lines (excluding COMMENT lines).
   */
  private static parseKeyValues_(lines: string[]): Map<string, string> {
    const keyValues = new Map<string, string>();

    for (const line of lines) {
      if (line.startsWith('COMMENT')) {
        continue;
      }
      if (!line.includes('=')) {
        continue;
      }

      const eqIndex = line.indexOf('=');
      const key = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 1).trim();

      keyValues.set(key, value);
    }

    return keyValues;
  }

  /**
   * Parse COMMENT lines and assign them to sections based on position.
   *
   * Comments are assigned to sections based on the keywords that follow them.
   * The OMM KVN format allows comments at the beginning of each section.
   */
  private static parseComments_(lines: string[]): {
    header: string[];
    metadata: string[];
    meanElements: string[];
    spacecraft: string[];
    tle: string[];
    covariance: string[];
  } {
    const result = {
      header: [] as string[],
      metadata: [] as string[],
      meanElements: [] as string[],
      spacecraft: [] as string[],
      tle: [] as string[],
      covariance: [] as string[],
    };

    let section = 'header';
    const pendingComments: string[] = [];

    for (const line of lines) {
      if (line.startsWith('COMMENT')) {
        pendingComments.push(line.substring(7).trim());
        continue;
      }

      if (!line.includes('=')) {
        continue;
      }

      const eqIndex = line.indexOf('=');
      const key = line.substring(0, eqIndex).trim();

      // Detect section transitions
      if (key === 'OBJECT_NAME') {
        section = 'metadata';
      } else if (key === 'EPOCH') {
        section = 'meanElements';
      } else if (key === 'MASS' || key === 'SOLAR_RAD_AREA') {
        section = 'spacecraft';
      } else if (key === 'EPHEMERIS_TYPE' || key === 'CLASSIFICATION_TYPE' || key === 'NORAD_CAT_ID') {
        section = 'tle';
      } else if (key === 'COV_REF_FRAME' || key === 'CX_X') {
        section = 'covariance';
      }

      // Flush pending comments to the current section
      if (pendingComments.length > 0) {
        (result as Record<string, string[]>)[section].push(...pendingComments);
        pendingComments.length = 0;
      }
    }

    // Flush any trailing comments
    if (pendingComments.length > 0) {
      (result as Record<string, string[]>)[section].push(...pendingComments);
    }

    return result;
  }

  /**
   * Parse header section.
   * @see CCSDS 502.0-B-3 Table 4-1
   */
  private static parseHeader_(kv: Map<string, string>, comments: string[]): OmmHeader {
    const version = kv.get('CCSDS_OMM_VERS');

    if (!version) {
      throw new ParseError('Missing required CCSDS_OMM_VERS field', 'OMM');
    }

    const creationDate = kv.get('CREATION_DATE');

    if (!creationDate) {
      throw new ParseError('Missing required CREATION_DATE field', 'OMM');
    }

    const originator = kv.get('ORIGINATOR');

    if (!originator) {
      throw new ParseError('Missing required ORIGINATOR field', 'OMM');
    }

    const header: OmmHeader = {
      CCSDS_OMM_VERS: version,
      CREATION_DATE: creationDate,
      ORIGINATOR: originator,
    };

    const messageId = kv.get('MESSAGE_ID');

    if (messageId) {
      header.MESSAGE_ID = messageId;
    }

    const classification = kv.get('CLASSIFICATION');

    if (classification) {
      header.CLASSIFICATION = classification;
    }

    if (comments.length > 0) {
      header.COMMENT = comments;
    }

    return header;
  }

  /**
   * Parse metadata section.
   * @see CCSDS 502.0-B-3 Table 4-2
   */
  private static parseMetadata_(kv: Map<string, string>, comments: string[]): OmmMetadata {
    const objectName = kv.get('OBJECT_NAME');

    if (!objectName) {
      throw new ParseError('Missing required OBJECT_NAME field', 'OMM');
    }

    const objectId = kv.get('OBJECT_ID');

    if (!objectId) {
      throw new ParseError('Missing required OBJECT_ID field', 'OMM');
    }

    const centerName = kv.get('CENTER_NAME');

    if (!centerName) {
      throw new ParseError('Missing required CENTER_NAME field', 'OMM');
    }

    const refFrame = kv.get('REF_FRAME');

    if (!refFrame) {
      throw new ParseError('Missing required REF_FRAME field', 'OMM');
    }

    const timeSystem = kv.get('TIME_SYSTEM');

    if (!timeSystem) {
      throw new ParseError('Missing required TIME_SYSTEM field', 'OMM');
    }

    const meanElementTheory = kv.get('MEAN_ELEMENT_THEORY');

    if (!meanElementTheory) {
      throw new ParseError('Missing required MEAN_ELEMENT_THEORY field', 'OMM');
    }

    const metadata: OmmMetadata = {
      OBJECT_NAME: objectName,
      OBJECT_ID: objectId,
      CENTER_NAME: centerName,
      REF_FRAME: refFrame,
      TIME_SYSTEM: timeSystem,
      MEAN_ELEMENT_THEORY: meanElementTheory,
    };

    const refFrameEpoch = kv.get('REF_FRAME_EPOCH');

    if (refFrameEpoch) {
      metadata.REF_FRAME_EPOCH = refFrameEpoch;
    }

    if (comments.length > 0) {
      metadata.COMMENT = comments;
    }

    return metadata;
  }

  /**
   * Parse mean Keplerian elements section.
   * @see CCSDS 502.0-B-3 Table 4-3
   */
  private static parseMeanElements_(kv: Map<string, string>, comments: string[]): OmmMeanElements {
    const epoch = kv.get('EPOCH');

    if (!epoch) {
      throw new ParseError('Missing required EPOCH field', 'OMM');
    }

    const semiMajorAxis = OmmParser.parseOptionalFloat_(kv, 'SEMI_MAJOR_AXIS');
    const meanMotion = OmmParser.parseOptionalFloat_(kv, 'MEAN_MOTION');

    if (semiMajorAxis === undefined && meanMotion === undefined) {
      throw new ParseError('Either SEMI_MAJOR_AXIS or MEAN_MOTION must be provided', 'OMM');
    }

    const eccentricity = OmmParser.parseRequiredFloat_(kv, 'ECCENTRICITY');
    const inclination = OmmParser.parseRequiredFloat_(kv, 'INCLINATION');
    const raOfAscNode = OmmParser.parseRequiredFloat_(kv, 'RA_OF_ASC_NODE');
    const argOfPericenter = OmmParser.parseRequiredFloat_(kv, 'ARG_OF_PERICENTER');
    const meanAnomaly = OmmParser.parseRequiredFloat_(kv, 'MEAN_ANOMALY');

    const elements: OmmMeanElements = {
      EPOCH: epoch,
      ECCENTRICITY: eccentricity,
      INCLINATION: inclination,
      RA_OF_ASC_NODE: raOfAscNode,
      ARG_OF_PERICENTER: argOfPericenter,
      MEAN_ANOMALY: meanAnomaly,
    };

    if (semiMajorAxis !== undefined) {
      elements.SEMI_MAJOR_AXIS = semiMajorAxis;
    }

    if (meanMotion !== undefined) {
      elements.MEAN_MOTION = meanMotion;
    }

    const gm = OmmParser.parseOptionalFloat_(kv, 'GM');

    if (gm !== undefined) {
      elements.GM = gm;
    }

    if (comments.length > 0) {
      elements.COMMENT = comments;
    }

    return elements;
  }

  /**
   * Parse optional spacecraft parameters section.
   * @see CCSDS 502.0-B-3 Table 4-3
   */
  private static parseSpacecraftParameters_(kv: Map<string, string>, comments: string[]): OmmSpacecraftParameters | null {
    const mass = OmmParser.parseOptionalFloat_(kv, 'MASS');
    const solarRadArea = OmmParser.parseOptionalFloat_(kv, 'SOLAR_RAD_AREA');
    const solarRadCoeff = OmmParser.parseOptionalFloat_(kv, 'SOLAR_RAD_COEFF');
    const dragArea = OmmParser.parseOptionalFloat_(kv, 'DRAG_AREA');
    const dragCoeff = OmmParser.parseOptionalFloat_(kv, 'DRAG_COEFF');

    if (
      mass === undefined &&
      solarRadArea === undefined &&
      solarRadCoeff === undefined &&
      dragArea === undefined &&
      dragCoeff === undefined &&
      comments.length === 0
    ) {
      return null;
    }

    const params: OmmSpacecraftParameters = {};

    if (mass !== undefined) {
      params.MASS = mass;
    }
    if (solarRadArea !== undefined) {
      params.SOLAR_RAD_AREA = solarRadArea;
    }
    if (solarRadCoeff !== undefined) {
      params.SOLAR_RAD_COEFF = solarRadCoeff;
    }
    if (dragArea !== undefined) {
      params.DRAG_AREA = dragArea;
    }
    if (dragCoeff !== undefined) {
      params.DRAG_COEFF = dragCoeff;
    }
    if (comments.length > 0) {
      params.COMMENT = comments;
    }

    return params;
  }

  /**
   * Parse optional TLE-related parameters section.
   * @see CCSDS 502.0-B-3 Table 4-3
   */
  private static parseTleParameters_(kv: Map<string, string>, comments: string[]): OmmTleParameters | null {
    const ephemerisType = OmmParser.parseOptionalInt_(kv, 'EPHEMERIS_TYPE');
    const classificationType = kv.get('CLASSIFICATION_TYPE');
    const noradCatId = OmmParser.parseOptionalInt_(kv, 'NORAD_CAT_ID');
    const elementSetNo = OmmParser.parseOptionalInt_(kv, 'ELEMENT_SET_NO');
    const revAtEpoch = OmmParser.parseOptionalInt_(kv, 'REV_AT_EPOCH');
    const bstar = OmmParser.parseOptionalFloat_(kv, 'BSTAR');
    const bterm = OmmParser.parseOptionalFloat_(kv, 'BTERM');
    const meanMotionDot = OmmParser.parseOptionalFloat_(kv, 'MEAN_MOTION_DOT');
    const meanMotionDdot = OmmParser.parseOptionalFloat_(kv, 'MEAN_MOTION_DDOT');
    const agom = OmmParser.parseOptionalFloat_(kv, 'AGOM');

    if (
      ephemerisType === undefined &&
      classificationType === undefined &&
      noradCatId === undefined &&
      elementSetNo === undefined &&
      revAtEpoch === undefined &&
      bstar === undefined &&
      bterm === undefined &&
      meanMotionDot === undefined &&
      meanMotionDdot === undefined &&
      agom === undefined &&
      comments.length === 0
    ) {
      return null;
    }

    const params: OmmTleParameters = {};

    if (ephemerisType !== undefined) {
      params.EPHEMERIS_TYPE = ephemerisType;
    }
    if (classificationType !== undefined) {
      params.CLASSIFICATION_TYPE = classificationType;
    }
    if (noradCatId !== undefined) {
      params.NORAD_CAT_ID = noradCatId;
    }
    if (elementSetNo !== undefined) {
      params.ELEMENT_SET_NO = elementSetNo;
    }
    if (revAtEpoch !== undefined) {
      params.REV_AT_EPOCH = revAtEpoch;
    }
    if (bstar !== undefined) {
      params.BSTAR = bstar;
    }
    if (bterm !== undefined) {
      params.BTERM = bterm;
    }
    if (meanMotionDot !== undefined) {
      params.MEAN_MOTION_DOT = meanMotionDot;
    }
    if (meanMotionDdot !== undefined) {
      params.MEAN_MOTION_DDOT = meanMotionDdot;
    }
    if (agom !== undefined) {
      params.AGOM = agom;
    }
    if (comments.length > 0) {
      params.COMMENT = comments;
    }

    return params;
  }

  /**
   * Parse optional covariance matrix section.
   * @see CCSDS 502.0-B-3 Table 4-3
   */
  private static parseCovarianceMatrix_(kv: Map<string, string>, comments: string[]): OmmCovarianceMatrix | null {
    const cxX = OmmParser.parseOptionalFloat_(kv, 'CX_X');

    // If CX_X is not present, no covariance data exists
    if (cxX === undefined) {
      return null;
    }

    const cov: OmmCovarianceMatrix = {
      CX_X: cxX,
      CY_X: OmmParser.parseOptionalFloat_(kv, 'CY_X'),
      CY_Y: OmmParser.parseOptionalFloat_(kv, 'CY_Y'),
      CZ_X: OmmParser.parseOptionalFloat_(kv, 'CZ_X'),
      CZ_Y: OmmParser.parseOptionalFloat_(kv, 'CZ_Y'),
      CZ_Z: OmmParser.parseOptionalFloat_(kv, 'CZ_Z'),
      CX_DOT_X: OmmParser.parseOptionalFloat_(kv, 'CX_DOT_X'),
      CX_DOT_Y: OmmParser.parseOptionalFloat_(kv, 'CX_DOT_Y'),
      CX_DOT_Z: OmmParser.parseOptionalFloat_(kv, 'CX_DOT_Z'),
      CX_DOT_X_DOT: OmmParser.parseOptionalFloat_(kv, 'CX_DOT_X_DOT'),
      CY_DOT_X: OmmParser.parseOptionalFloat_(kv, 'CY_DOT_X'),
      CY_DOT_Y: OmmParser.parseOptionalFloat_(kv, 'CY_DOT_Y'),
      CY_DOT_Z: OmmParser.parseOptionalFloat_(kv, 'CY_DOT_Z'),
      CY_DOT_X_DOT: OmmParser.parseOptionalFloat_(kv, 'CY_DOT_X_DOT'),
      CY_DOT_Y_DOT: OmmParser.parseOptionalFloat_(kv, 'CY_DOT_Y_DOT'),
      CZ_DOT_X: OmmParser.parseOptionalFloat_(kv, 'CZ_DOT_X'),
      CZ_DOT_Y: OmmParser.parseOptionalFloat_(kv, 'CZ_DOT_Y'),
      CZ_DOT_Z: OmmParser.parseOptionalFloat_(kv, 'CZ_DOT_Z'),
      CZ_DOT_X_DOT: OmmParser.parseOptionalFloat_(kv, 'CZ_DOT_X_DOT'),
      CZ_DOT_Y_DOT: OmmParser.parseOptionalFloat_(kv, 'CZ_DOT_Y_DOT'),
      CZ_DOT_Z_DOT: OmmParser.parseOptionalFloat_(kv, 'CZ_DOT_Z_DOT'),
    };

    const covRefFrame = kv.get('COV_REF_FRAME');

    if (covRefFrame) {
      cov.COV_REF_FRAME = covRefFrame;
    }

    if (comments.length > 0) {
      cov.COMMENT = comments;
    }

    return cov;
  }

  /**
   * Parse user-defined parameters section.
   */
  private static parseUserDefined_(kv: Map<string, string>): OmmUserDefined | null {
    const userDefined: OmmUserDefined = {};
    let found = false;

    for (const [key, value] of kv) {
      if (key.startsWith('USER_DEFINED_')) {
        userDefined[key] = value;
        found = true;
      }
    }

    return found ? userDefined : null;
  }

  /**
   * Parse a required float field.
   * @throws ParseError if the field is missing or not a valid number
   */
  private static parseRequiredFloat_(kv: Map<string, string>, key: string): number {
    const value = kv.get(key);

    if (value === undefined) {
      throw new ParseError(`Missing required ${key} field`, 'OMM');
    }

    const parsed = parseFloat(value);

    if (isNaN(parsed)) {
      throw new ParseError(`Invalid numeric value for ${key}: ${value}`, 'OMM');
    }

    return parsed;
  }

  /**
   * Parse an optional float field.
   */
  private static parseOptionalFloat_(kv: Map<string, string>, key: string): number | undefined {
    const value = kv.get(key);

    if (value === undefined) {
      return undefined;
    }

    const parsed = parseFloat(value);

    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Parse an optional integer field.
   */
  private static parseOptionalInt_(kv: Map<string, string>, key: string): number | undefined {
    const value = kv.get(key);

    if (value === undefined) {
      return undefined;
    }

    const parsed = parseInt(value, 10);

    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Validate parsed OMM for required fields and consistency.
   * @throws ParseError if validation fails
   */
  private static validate_(omm: ParsedOmm): void {
    const errors: string[] = [];

    // Header validation
    if (!omm.header.CCSDS_OMM_VERS) {
      errors.push('Missing CCSDS_OMM_VERS');
    }
    if (!omm.header.CREATION_DATE) {
      errors.push('Missing CREATION_DATE');
    }
    if (!omm.header.ORIGINATOR) {
      errors.push('Missing ORIGINATOR');
    }

    // Metadata validation
    if (!omm.metadata.OBJECT_NAME) {
      errors.push('Missing OBJECT_NAME');
    }
    if (!omm.metadata.OBJECT_ID) {
      errors.push('Missing OBJECT_ID');
    }
    if (!omm.metadata.CENTER_NAME) {
      errors.push('Missing CENTER_NAME');
    }
    if (!omm.metadata.REF_FRAME) {
      errors.push('Missing REF_FRAME');
    }
    if (!omm.metadata.TIME_SYSTEM) {
      errors.push('Missing TIME_SYSTEM');
    }
    if (!omm.metadata.MEAN_ELEMENT_THEORY) {
      errors.push('Missing MEAN_ELEMENT_THEORY');
    }

    // Mean elements validation
    if (!omm.meanElements.EPOCH) {
      errors.push('Missing EPOCH');
    }
    if (omm.meanElements.SEMI_MAJOR_AXIS === undefined && omm.meanElements.MEAN_MOTION === undefined) {
      errors.push('Either SEMI_MAJOR_AXIS or MEAN_MOTION must be provided');
    }

    // TLE-specific validation
    const theory = omm.metadata.MEAN_ELEMENT_THEORY?.toUpperCase();

    if (theory === 'SGP' || theory === 'SGP4') {
      if (omm.meanElements.MEAN_MOTION === undefined) {
        errors.push('MEAN_MOTION is required when MEAN_ELEMENT_THEORY is SGP/SGP4');
      }
    }

    // TLE Earth orbit conventions (4.2.4.6)
    if (theory === 'SGP' || theory === 'SGP4' || theory === 'SGP4-XP') {
      if (omm.metadata.CENTER_NAME !== 'EARTH') {
        errors.push('CENTER_NAME must be EARTH for SGP/SGP4/SGP4-XP mean element theory');
      }
      if (omm.metadata.REF_FRAME !== 'TEME') {
        errors.push('REF_FRAME must be TEME for SGP/SGP4/SGP4-XP mean element theory');
      }
      if (omm.metadata.TIME_SYSTEM !== 'UTC') {
        errors.push('TIME_SYSTEM must be UTC for SGP/SGP4/SGP4-XP mean element theory');
      }
    }

    // Covariance completeness check (all or none)
    if (omm.covarianceMatrix) {
      const covKeys = [
        'CX_X', 'CY_X', 'CY_Y', 'CZ_X', 'CZ_Y', 'CZ_Z',
        'CX_DOT_X', 'CX_DOT_Y', 'CX_DOT_Z', 'CX_DOT_X_DOT',
        'CY_DOT_X', 'CY_DOT_Y', 'CY_DOT_Z', 'CY_DOT_X_DOT', 'CY_DOT_Y_DOT',
        'CZ_DOT_X', 'CZ_DOT_Y', 'CZ_DOT_Z', 'CZ_DOT_X_DOT', 'CZ_DOT_Y_DOT', 'CZ_DOT_Z_DOT',
      ] as const;

      const missing = covKeys.filter((k) => (omm.covarianceMatrix as Record<string, unknown>)[k] === undefined);

      if (missing.length > 0 && missing.length < covKeys.length) {
        errors.push(`Incomplete covariance matrix: missing ${missing.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      throw new ParseError(`OMM validation failed: ${errors.join(', ')}`, 'OMM');
    }
  }
}
