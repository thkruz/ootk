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
import { RIC } from '../coordinate/RIC';
import { CovarianceFrame, StateCovariance } from '../covariance/StateCovariance';
import { ParseError } from '../errors';
import { ConjunctionEvent } from '../conjunction/ConjunctionEvent';
import { Matrix } from '../operations/Matrix';
import { EpochUTC } from '../time/EpochUTC';
import type { Kilometers, KilometersPerSecond } from '../types/types';
import { Vector3D } from '../operations/Vector3D';
import type {
  CdmHeader,
  CdmObjectData,
  CdmObjectMetadata,
  CdmRelativeData,
  ParsedCdm,
} from './CdmTypes';

/**
 * Parser for CCSDS Conjunction Data Message (CDM) KVN format.
 *
 * Parses text-based CDM files conforming to CCSDS 508.0-B-1 standard.
 * Supports both reading CDM data and converting to ConjunctionEvent objects.
 *
 * @see https://public.ccsds.org/Pubs/508x0b1e2c2.pdf CCSDS CDM Standard
 *
 * @example
 * ```typescript
 * const cdmContent = fs.readFileSync('conjunction.cdm', 'utf-8');
 * const parsed = CdmParser.parse(cdmContent);
 * const event = CdmParser.toConjunctionEvent(parsed);
 * console.log(event.toString());
 * ```
 */
export class CdmParser {
  private constructor() {
    // Static-only utility class
  }

  /**
   * Parse CDM KVN format text into structured data.
   * @param content - The raw CDM file content as a string
   * @returns Parsed CDM structure with all sections
   * @throws ParseError if the file cannot be parsed or is missing required fields
   */
  static parse(content: string): ParsedCdm {
    const lines = content
      .split(/\r?\n/u)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('COMMENT'));

    // Parse all key-value pairs
    const keyValues = CdmParser.parseKeyValues_(lines);

    // Extract sections
    const header = CdmParser.parseHeader_(keyValues);
    const relativeData = CdmParser.parseRelativeData_(keyValues);
    const object1Metadata = CdmParser.parseObjectMetadata_(keyValues, 'OBJECT1');
    const object1Data = CdmParser.parseObjectData_(keyValues, 'OBJECT1');
    const object2Metadata = CdmParser.parseObjectMetadata_(keyValues, 'OBJECT2');
    const object2Data = CdmParser.parseObjectData_(keyValues, 'OBJECT2');

    // Validate required fields
    CdmParser.validate_({
      header,
      relativeData,
      object1Metadata,
      object1Data,
      object2Metadata,
      object2Data,
    });

    return {
      header,
      relativeData,
      object1Metadata,
      object1Data,
      object2Metadata,
      object2Data,
    };
  }

  /**
   * Validate parsed CDM structure for required fields.
   * @param cdm - Parsed CDM to validate
   * @throws ParseError if required fields are missing
   */
  static validate(cdm: ParsedCdm): void {
    CdmParser.validate_(cdm);
  }

  /**
   * Convert parsed CDM to a ConjunctionEvent object.
   *
   * Reconstructs the conjunction event from CDM data, including
   * state vectors, relative state, and covariance if available.
   *
   * @param cdm - Parsed CDM structure
   * @returns ConjunctionEvent with data from CDM
   */
  static toConjunctionEvent(cdm: ParsedCdm): ConjunctionEvent {
    // Parse TCA
    const tca = EpochUTC.fromDateTimeString(cdm.relativeData.TCA);

    // Create primary state (Object 1)
    const primaryPos = new Vector3D(
      cdm.object1Data.X,
      cdm.object1Data.Y,
      cdm.object1Data.Z,
    );
    const primaryVel = new Vector3D(
      cdm.object1Data.X_DOT,
      cdm.object1Data.Y_DOT,
      cdm.object1Data.Z_DOT,
    );
    const primaryState = new J2000(tca, primaryPos, primaryVel);

    // Create secondary state (Object 2)
    const secondaryPos = new Vector3D(
      cdm.object2Data.X,
      cdm.object2Data.Y,
      cdm.object2Data.Z,
    );
    const secondaryVel = new Vector3D(
      cdm.object2Data.X_DOT,
      cdm.object2Data.Y_DOT,
      cdm.object2Data.Z_DOT,
    );
    const secondaryState = new J2000(tca, secondaryPos, secondaryVel);

    // Compute relative state in RIC frame
    const relativeState = RIC.fromJ2000(secondaryState, primaryState);

    // Extract relative position/velocity from CDM if available, otherwise compute
    let radialDistance: Kilometers;
    let intrackDistance: Kilometers;
    let crosstrackDistance: Kilometers;

    if (
      cdm.relativeData.RELATIVE_POSITION_R !== undefined &&
      cdm.relativeData.RELATIVE_POSITION_T !== undefined &&
      cdm.relativeData.RELATIVE_POSITION_N !== undefined
    ) {
      radialDistance = cdm.relativeData.RELATIVE_POSITION_R;
      intrackDistance = cdm.relativeData.RELATIVE_POSITION_T;
      crosstrackDistance = cdm.relativeData.RELATIVE_POSITION_N;
    } else {
      radialDistance = relativeState.position.x as Kilometers;
      intrackDistance = relativeState.position.y as Kilometers;
      crosstrackDistance = relativeState.position.z as Kilometers;
    }

    // Extract relative velocity
    const relativeVelocity = cdm.relativeData.RELATIVE_SPEED ??
      (relativeState.velocity.magnitude() as KilometersPerSecond);

    // Parse covariance if available
    let combinedCovariance: StateCovariance | undefined;
    const obj1Cov = CdmParser.parseCovariance_(cdm.object1Data);
    const obj2Cov = CdmParser.parseCovariance_(cdm.object2Data);

    if (obj1Cov && obj2Cov) {
      // Combine covariances (sum for independent objects)
      const combinedMatrix = new Matrix([
        [obj1Cov.elements[0][0] + obj2Cov.elements[0][0], obj1Cov.elements[0][1] + obj2Cov.elements[0][1], obj1Cov.elements[0][2] + obj2Cov.elements[0][2], 0, 0, 0],
        [obj1Cov.elements[1][0] + obj2Cov.elements[1][0], obj1Cov.elements[1][1] + obj2Cov.elements[1][1], obj1Cov.elements[1][2] + obj2Cov.elements[1][2], 0, 0, 0],
        [obj1Cov.elements[2][0] + obj2Cov.elements[2][0], obj1Cov.elements[2][1] + obj2Cov.elements[2][1], obj1Cov.elements[2][2] + obj2Cov.elements[2][2], 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ]);

      combinedCovariance = new StateCovariance(combinedMatrix, CovarianceFrame.RIC);
    }

    return new ConjunctionEvent({
      tca,
      primaryState,
      secondaryState,
      relativeState,
      missDistance: cdm.relativeData.MISS_DISTANCE,
      radialDistance,
      intrackDistance,
      crosstrackDistance,
      relativeVelocity,
      combinedCovariance,
      probabilityOfCollision: cdm.relativeData.COLLISION_PROBABILITY,
    });
  }

  /**
   * Parse all key-value pairs from CDM lines.
   */
  private static parseKeyValues_(lines: string[]): Map<string, string> {
    const keyValues = new Map<string, string>();
    let currentObject: string | null = null;

    for (const line of lines) {
      if (!line.includes('=')) {
        continue;
      }

      const eqIndex = line.indexOf('=');
      let key = line.substring(0, eqIndex).trim();
      let value = line.substring(eqIndex + 1).trim();

      // Remove units in brackets [km], [km/s], etc.
      value = value.replace(/\s*\[.*?\]\s*$/u, '').trim();

      // Track which object we're parsing
      if (key === 'OBJECT') {
        currentObject = value;
      }

      // Prefix object-specific keys
      if (currentObject && CdmParser.isObjectSpecificKey_(key)) {
        key = `${currentObject}_${key}`;
      }

      keyValues.set(key, value);
    }

    return keyValues;
  }

  /**
   * Check if a key is object-specific (should be prefixed).
   */
  private static isObjectSpecificKey_(key: string): boolean {
    const objectKeys = [
      'OBJECT_DESIGNATOR', 'CATALOG_NAME', 'OBJECT_NAME', 'INTERNATIONAL_DESIGNATOR',
      'OBJECT_TYPE', 'OPERATOR_CONTACT_POSITION', 'OPERATOR_ORGANIZATION',
      'OPERATOR_PHONE', 'OPERATOR_EMAIL', 'EPHEMERIS_NAME', 'COVARIANCE_METHOD',
      'MANEUVERABLE', 'REF_FRAME', 'GRAVITY_MODEL', 'ATMOSPHERIC_MODEL',
      'N_BODY_PERTURBATIONS', 'SOLAR_RAD_PRESSURE', 'EARTH_TIDES', 'INTRACK_THRUST',
      'X', 'Y', 'Z', 'X_DOT', 'Y_DOT', 'Z_DOT',
      'CR_R', 'CT_R', 'CT_T', 'CN_R', 'CN_T', 'CN_N',
      'CRDOT_R', 'CRDOT_T', 'CRDOT_N', 'CRDOT_RDOT',
      'CTDOT_R', 'CTDOT_T', 'CTDOT_N', 'CTDOT_RDOT', 'CTDOT_TDOT',
      'CNDOT_R', 'CNDOT_T', 'CNDOT_N', 'CNDOT_RDOT', 'CNDOT_TDOT', 'CNDOT_NDOT',
      'MASS', 'CD_AREA_OVER_MASS', 'CR_AREA_OVER_MASS', 'THRUST_ACCELERATION', 'SEDR',
      'TIME_LASTOB_START', 'TIME_LASTOB_END',
    ];

    return objectKeys.includes(key);
  }

  /**
   * Parse header section.
   */
  private static parseHeader_(kv: Map<string, string>): CdmHeader {
    return {
      CCSDS_CDM_VERS: kv.get('CCSDS_CDM_VERS') ?? '1.0',
      CREATION_DATE: kv.get('CREATION_DATE') ?? new Date().toISOString(),
      ORIGINATOR: kv.get('ORIGINATOR') ?? 'UNKNOWN',
      MESSAGE_FOR: kv.get('MESSAGE_FOR'),
      MESSAGE_ID: kv.get('MESSAGE_ID'),
    };
  }

  /**
   * Parse relative metadata/data section.
   */
  private static parseRelativeData_(kv: Map<string, string>): CdmRelativeData {
    const tca = kv.get('TCA');

    if (!tca) {
      throw new ParseError('Missing required TCA field', 'CDM');
    }

    const missDistance = kv.get('MISS_DISTANCE');

    if (!missDistance) {
      throw new ParseError('Missing required MISS_DISTANCE field', 'CDM');
    }

    return {
      TCA: tca,
      MISS_DISTANCE: parseFloat(missDistance) as Kilometers,
      RELATIVE_SPEED: CdmParser.parseOptionalFloat_(kv, 'RELATIVE_SPEED') as KilometersPerSecond | undefined,
      RELATIVE_POSITION_R: CdmParser.parseOptionalFloat_(kv, 'RELATIVE_POSITION_R') as Kilometers | undefined,
      RELATIVE_POSITION_T: CdmParser.parseOptionalFloat_(kv, 'RELATIVE_POSITION_T') as Kilometers | undefined,
      RELATIVE_POSITION_N: CdmParser.parseOptionalFloat_(kv, 'RELATIVE_POSITION_N') as Kilometers | undefined,
      RELATIVE_VELOCITY_R: CdmParser.parseOptionalFloat_(kv, 'RELATIVE_VELOCITY_R') as KilometersPerSecond | undefined,
      RELATIVE_VELOCITY_T: CdmParser.parseOptionalFloat_(kv, 'RELATIVE_VELOCITY_T') as KilometersPerSecond | undefined,
      RELATIVE_VELOCITY_N: CdmParser.parseOptionalFloat_(kv, 'RELATIVE_VELOCITY_N') as KilometersPerSecond | undefined,
      COLLISION_PROBABILITY: CdmParser.parseOptionalFloat_(kv, 'COLLISION_PROBABILITY'),
      COLLISION_PROBABILITY_METHOD: kv.get('COLLISION_PROBABILITY_METHOD'),
      START_SCREEN_PERIOD: kv.get('START_SCREEN_PERIOD'),
      STOP_SCREEN_PERIOD: kv.get('STOP_SCREEN_PERIOD'),
      SCREEN_ENTRY_TIME: kv.get('SCREEN_ENTRY_TIME'),
      SCREEN_EXIT_TIME: kv.get('SCREEN_EXIT_TIME'),
    };
  }

  /**
   * Parse object metadata section.
   */
  private static parseObjectMetadata_(kv: Map<string, string>, objectId: 'OBJECT1' | 'OBJECT2'): CdmObjectMetadata {
    const prefix = `${objectId}_`;

    const designator = kv.get(`${prefix}OBJECT_DESIGNATOR`);

    if (!designator) {
      throw new ParseError(`Missing required ${prefix}OBJECT_DESIGNATOR field`, 'CDM');
    }

    return {
      OBJECT: objectId,
      OBJECT_DESIGNATOR: designator,
      CATALOG_NAME: kv.get(`${prefix}CATALOG_NAME`),
      OBJECT_NAME: kv.get(`${prefix}OBJECT_NAME`),
      INTERNATIONAL_DESIGNATOR: kv.get(`${prefix}INTERNATIONAL_DESIGNATOR`),
      OBJECT_TYPE: kv.get(`${prefix}OBJECT_TYPE`) as CdmObjectMetadata['OBJECT_TYPE'],
      OPERATOR_CONTACT_POSITION: kv.get(`${prefix}OPERATOR_CONTACT_POSITION`),
      OPERATOR_ORGANIZATION: kv.get(`${prefix}OPERATOR_ORGANIZATION`),
      OPERATOR_PHONE: kv.get(`${prefix}OPERATOR_PHONE`),
      OPERATOR_EMAIL: kv.get(`${prefix}OPERATOR_EMAIL`),
      EPHEMERIS_NAME: kv.get(`${prefix}EPHEMERIS_NAME`),
      COVARIANCE_METHOD: kv.get(`${prefix}COVARIANCE_METHOD`),
      MANEUVERABLE: kv.get(`${prefix}MANEUVERABLE`) as CdmObjectMetadata['MANEUVERABLE'],
      REF_FRAME: kv.get(`${prefix}REF_FRAME`),
      GRAVITY_MODEL: kv.get(`${prefix}GRAVITY_MODEL`),
      ATMOSPHERIC_MODEL: kv.get(`${prefix}ATMOSPHERIC_MODEL`),
      N_BODY_PERTURBATIONS: kv.get(`${prefix}N_BODY_PERTURBATIONS`),
      SOLAR_RAD_PRESSURE: kv.get(`${prefix}SOLAR_RAD_PRESSURE`) as 'YES' | 'NO' | undefined,
      EARTH_TIDES: kv.get(`${prefix}EARTH_TIDES`) as 'YES' | 'NO' | undefined,
      INTRACK_THRUST: kv.get(`${prefix}INTRACK_THRUST`) as 'YES' | 'NO' | undefined,
    };
  }

  /**
   * Parse object state data section.
   */
  private static parseObjectData_(kv: Map<string, string>, objectId: 'OBJECT1' | 'OBJECT2'): CdmObjectData {
    const prefix = `${objectId}_`;

    const x = kv.get(`${prefix}X`);
    const y = kv.get(`${prefix}Y`);
    const z = kv.get(`${prefix}Z`);
    const xDot = kv.get(`${prefix}X_DOT`);
    const yDot = kv.get(`${prefix}Y_DOT`);
    const zDot = kv.get(`${prefix}Z_DOT`);

    if (!x || !y || !z || !xDot || !yDot || !zDot) {
      throw new ParseError(`Missing required state vector fields for ${objectId}`, 'CDM');
    }

    return {
      OBJECT: objectId,
      X: parseFloat(x) as Kilometers,
      Y: parseFloat(y) as Kilometers,
      Z: parseFloat(z) as Kilometers,
      X_DOT: parseFloat(xDot) as KilometersPerSecond,
      Y_DOT: parseFloat(yDot) as KilometersPerSecond,
      Z_DOT: parseFloat(zDot) as KilometersPerSecond,
      MASS: CdmParser.parseOptionalFloat_(kv, `${prefix}MASS`),
      CD_AREA_OVER_MASS: CdmParser.parseOptionalFloat_(kv, `${prefix}CD_AREA_OVER_MASS`),
      CR_AREA_OVER_MASS: CdmParser.parseOptionalFloat_(kv, `${prefix}CR_AREA_OVER_MASS`),
      THRUST_ACCELERATION: CdmParser.parseOptionalFloat_(kv, `${prefix}THRUST_ACCELERATION`),
      SEDR: CdmParser.parseOptionalFloat_(kv, `${prefix}SEDR`),
      TIME_LASTOB_START: kv.get(`${prefix}TIME_LASTOB_START`),
      TIME_LASTOB_END: kv.get(`${prefix}TIME_LASTOB_END`),
      // Position covariance
      CR_R: CdmParser.parseOptionalFloat_(kv, `${prefix}CR_R`),
      CT_R: CdmParser.parseOptionalFloat_(kv, `${prefix}CT_R`),
      CT_T: CdmParser.parseOptionalFloat_(kv, `${prefix}CT_T`),
      CN_R: CdmParser.parseOptionalFloat_(kv, `${prefix}CN_R`),
      CN_T: CdmParser.parseOptionalFloat_(kv, `${prefix}CN_T`),
      CN_N: CdmParser.parseOptionalFloat_(kv, `${prefix}CN_N`),
      // Velocity covariance
      CRDOT_R: CdmParser.parseOptionalFloat_(kv, `${prefix}CRDOT_R`),
      CRDOT_T: CdmParser.parseOptionalFloat_(kv, `${prefix}CRDOT_T`),
      CRDOT_N: CdmParser.parseOptionalFloat_(kv, `${prefix}CRDOT_N`),
      CRDOT_RDOT: CdmParser.parseOptionalFloat_(kv, `${prefix}CRDOT_RDOT`),
      CTDOT_R: CdmParser.parseOptionalFloat_(kv, `${prefix}CTDOT_R`),
      CTDOT_T: CdmParser.parseOptionalFloat_(kv, `${prefix}CTDOT_T`),
      CTDOT_N: CdmParser.parseOptionalFloat_(kv, `${prefix}CTDOT_N`),
      CTDOT_RDOT: CdmParser.parseOptionalFloat_(kv, `${prefix}CTDOT_RDOT`),
      CTDOT_TDOT: CdmParser.parseOptionalFloat_(kv, `${prefix}CTDOT_TDOT`),
      CNDOT_R: CdmParser.parseOptionalFloat_(kv, `${prefix}CNDOT_R`),
      CNDOT_T: CdmParser.parseOptionalFloat_(kv, `${prefix}CNDOT_T`),
      CNDOT_N: CdmParser.parseOptionalFloat_(kv, `${prefix}CNDOT_N`),
      CNDOT_RDOT: CdmParser.parseOptionalFloat_(kv, `${prefix}CNDOT_RDOT`),
      CNDOT_TDOT: CdmParser.parseOptionalFloat_(kv, `${prefix}CNDOT_TDOT`),
      CNDOT_NDOT: CdmParser.parseOptionalFloat_(kv, `${prefix}CNDOT_NDOT`),
    };
  }

  /**
   * Parse covariance matrix from object data.
   * Returns 3x3 position covariance or null if not available.
   */
  private static parseCovariance_(data: CdmObjectData): Matrix | null {
    if (
      data.CR_R === undefined ||
      data.CT_T === undefined ||
      data.CN_N === undefined
    ) {
      return null;
    }

    // Build symmetric 3x3 position covariance from lower triangular elements
    return new Matrix([
      [data.CR_R, data.CT_R ?? 0, data.CN_R ?? 0],
      [data.CT_R ?? 0, data.CT_T, data.CN_T ?? 0],
      [data.CN_R ?? 0, data.CN_T ?? 0, data.CN_N],
    ]);
  }

  /**
   * Parse optional float value from key-value map.
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
   * Validate parsed CDM for required fields.
   */
  private static validate_(cdm: ParsedCdm): void {
    const errors: string[] = [];

    if (!cdm.header.CCSDS_CDM_VERS) {
      errors.push('Missing CCSDS_CDM_VERS');
    }
    if (!cdm.header.CREATION_DATE) {
      errors.push('Missing CREATION_DATE');
    }
    if (!cdm.header.ORIGINATOR) {
      errors.push('Missing ORIGINATOR');
    }
    if (!cdm.relativeData.TCA) {
      errors.push('Missing TCA');
    }
    if (cdm.relativeData.MISS_DISTANCE === undefined) {
      errors.push('Missing MISS_DISTANCE');
    }
    if (!cdm.object1Metadata.OBJECT_DESIGNATOR) {
      errors.push('Missing OBJECT1 OBJECT_DESIGNATOR');
    }
    if (!cdm.object2Metadata.OBJECT_DESIGNATOR) {
      errors.push('Missing OBJECT2 OBJECT_DESIGNATOR');
    }

    if (errors.length > 0) {
      throw new ParseError(`CDM validation failed: ${errors.join(', ')}`, 'CDM');
    }
  }
}
