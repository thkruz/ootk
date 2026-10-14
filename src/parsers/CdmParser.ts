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

import { ITRF } from '../coordinate/ITRF';
import { J2000 } from '../coordinate/J2000';
import { RelativeState } from '../coordinate/RelativeState';
import { RIC } from '../coordinate/RIC';
import { TEME } from '../coordinate/TEME';
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
 * Units: CCSDS 508.0-B-1 Tables 3-3 and 3-4 give MISS_DISTANCE and RELATIVE_POSITION_* in m,
 * RELATIVE_SPEED and RELATIVE_VELOCITY_* in m/s, the state vector in km and km/s, and the
 * covariance in m**2, m**2/s and m**2/s**2. ootk works in km, so {@link CdmParser.parse}
 * converts every length to km, every speed to km/s and every covariance term to km**2,
 * km**2/s or km**2/s**2. A value with no unit tag is read in the standard's unit; an explicit
 * `[km]`, `[km/s]` or `[km**2...]` tag (as written by ootk before v8) is honoured.
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
  /** Suffix under which a value's unit tag is stored in the key-value map. */
  private static readonly UNITS_SUFFIX_ = '#UNITS';

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

    // States in J2000 (each object's REF_FRAME is honoured, see toJ2000_)
    const primaryState = CdmParser.toJ2000_(tca, cdm.object1Data, cdm.object1Metadata.REF_FRAME);
    const secondaryState = CdmParser.toJ2000_(tca, cdm.object2Data, cdm.object2Metadata.REF_FRAME);

    // Compute relative state in RIC frame
    const relativeState = RIC.fromJ2000(secondaryState, primaryState);

    /*
     * Signed relative position (and velocity) in OBJECT1's RTN frame. Taken from the CDM when all
     * three components are present, otherwise computed from the states. The velocity components
     * are stored only with a matching position source: CDM velocities only when the CDM position
     * is used, computed velocities only when the computed position is used.
     */
    let radialDistance: Kilometers;
    let intrackDistance: Kilometers;
    let crosstrackDistance: Kilometers;
    let radialVelocity: KilometersPerSecond | undefined;
    let intrackVelocity: KilometersPerSecond | undefined;
    let crosstrackVelocity: KilometersPerSecond | undefined;
    const rel = cdm.relativeData;

    if (rel.RELATIVE_POSITION_R !== undefined && rel.RELATIVE_POSITION_T !== undefined && rel.RELATIVE_POSITION_N !== undefined) {
      radialDistance = rel.RELATIVE_POSITION_R;
      intrackDistance = rel.RELATIVE_POSITION_T;
      crosstrackDistance = rel.RELATIVE_POSITION_N;
      if (rel.RELATIVE_VELOCITY_R !== undefined && rel.RELATIVE_VELOCITY_T !== undefined && rel.RELATIVE_VELOCITY_N !== undefined) {
        radialVelocity = rel.RELATIVE_VELOCITY_R;
        intrackVelocity = rel.RELATIVE_VELOCITY_T;
        crosstrackVelocity = rel.RELATIVE_VELOCITY_N;
      }
    } else {
      radialDistance = relativeState.position.x as Kilometers;
      intrackDistance = relativeState.position.y as Kilometers;
      crosstrackDistance = relativeState.position.z as Kilometers;
      radialVelocity = relativeState.velocity.x as KilometersPerSecond;
      intrackVelocity = relativeState.velocity.y as KilometersPerSecond;
      crosstrackVelocity = relativeState.velocity.z as KilometersPerSecond;
    }

    const hasScreenVolume = [
      rel.START_SCREEN_PERIOD, rel.STOP_SCREEN_PERIOD, rel.SCREEN_VOLUME_FRAME, rel.SCREEN_VOLUME_SHAPE,
      rel.SCREEN_VOLUME_X, rel.SCREEN_VOLUME_Y, rel.SCREEN_VOLUME_Z, rel.SCREEN_ENTRY_TIME, rel.SCREEN_EXIT_TIME,
    ].some((v) => v !== undefined);
    const screenVolume = hasScreenVolume
      ? {
        startScreenPeriod: rel.START_SCREEN_PERIOD,
        stopScreenPeriod: rel.STOP_SCREEN_PERIOD,
        frame: rel.SCREEN_VOLUME_FRAME,
        shape: rel.SCREEN_VOLUME_SHAPE,
        x: rel.SCREEN_VOLUME_X,
        y: rel.SCREEN_VOLUME_Y,
        z: rel.SCREEN_VOLUME_Z,
        entryTime: rel.SCREEN_ENTRY_TIME,
        exitTime: rel.SCREEN_EXIT_TIME,
      }
      : undefined;

    // Extract relative velocity
    const relativeVelocity = cdm.relativeData.RELATIVE_SPEED ??
      (relativeState.velocity.magnitude() as KilometersPerSecond);

    /*
     * Covariances. CCSDS 508.0-B-1 section 3.5.3: each object's covariance is in that object's
     * own RTN frame. OBJECT2 is rotated into OBJECT1's RTN before summing:
     * C2' = M C2 M^T with M = blockdiag(Q1 Q2^T, Q1 Q2^T), Q rows = R, T, N unit vectors in J2000.
     */
    let combinedCovariance: StateCovariance | undefined;
    let primaryCovariance: StateCovariance | undefined;
    let secondaryCovariance: StateCovariance | undefined;
    const obj1Cov = CdmParser.parseCovariance_(cdm.object1Data);
    const obj2Cov = CdmParser.parseCovariance_(cdm.object2Data);

    if (obj1Cov) {
      primaryCovariance = new StateCovariance(obj1Cov, CovarianceFrame.RIC);
    }
    if (obj2Cov) {
      secondaryCovariance = new StateCovariance(obj2Cov, CovarianceFrame.RIC);
    }

    if (obj1Cov && obj2Cov) {
      const q1 = RelativeState.createMatrix(primaryState.position, primaryState.velocity);
      const q2 = RelativeState.createMatrix(secondaryState.position, secondaryState.velocity);
      const m6 = CdmParser.blockDiag6_(q1.multiply(q2.transpose()));
      const obj2InObj1 = m6.multiply(obj2Cov).multiply(m6.transpose());

      combinedCovariance = new StateCovariance(obj1Cov.add(obj2InObj1), CovarianceFrame.RIC);
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
      radialVelocity,
      intrackVelocity,
      crosstrackVelocity,
      combinedCovariance,
      probabilityOfCollision: cdm.relativeData.COLLISION_PROBABILITY,
      primaryName: cdm.object1Metadata.OBJECT_NAME,
      secondaryName: cdm.object2Metadata.OBJECT_NAME,
      primaryDesignator: cdm.object1Metadata.OBJECT_DESIGNATOR,
      secondaryDesignator: cdm.object2Metadata.OBJECT_DESIGNATOR,
      primaryInternationalDesignator: cdm.object1Metadata.INTERNATIONAL_DESIGNATOR,
      secondaryInternationalDesignator: cdm.object2Metadata.INTERNATIONAL_DESIGNATOR,
      primaryManeuverable: cdm.object1Metadata.MANEUVERABLE,
      secondaryManeuverable: cdm.object2Metadata.MANEUVERABLE,
      primaryEphemerisName: cdm.object1Metadata.EPHEMERIS_NAME,
      secondaryEphemerisName: cdm.object2Metadata.EPHEMERIS_NAME,
      screenVolume,
      primaryCovariance,
      secondaryCovariance,
    });
  }

  /**
   * Build a J2000 state from a CDM object's state vector, honouring its REF_FRAME.
   *
   * CCSDS 508.0-B-1 Table 3-3 allows EME2000, GCRF and ITRF. EME2000, J2000, GCRF and ICRF are
   * used as J2000 (the frame-bias offset between them is about 23 mas, under 1 m at GEO). ITRF
   * states (as in 18 SDS CDMs) and TEME states are rotated to J2000. A missing REF_FRAME is
   * read as EME2000.
   * @param tca Time of closest approach (the state epoch).
   * @param data The object's state data (km, km/s).
   * @param refFrame The object's REF_FRAME value.
   * @returns The state in J2000.
   * @throws ParseError for an unsupported REF_FRAME.
   */
  private static toJ2000_(tca: EpochUTC, data: CdmObjectData, refFrame?: string): J2000 {
    const position = new Vector3D(data.X, data.Y, data.Z);
    const velocity = new Vector3D(data.X_DOT, data.Y_DOT, data.Z_DOT);
    const frame = (refFrame ?? 'EME2000').trim().toUpperCase();

    if (frame === 'EME2000' || frame === 'J2000' || frame === 'GCRF' || frame === 'ICRF') {
      return new J2000(tca, position, velocity);
    }
    if (frame.startsWith('ITRF')) {
      return new ITRF(tca, position, velocity).toJ2000();
    }
    if (frame === 'TEME') {
      return new TEME(tca, position, velocity).toJ2000();
    }

    throw new ParseError(`Unsupported CDM REF_FRAME "${refFrame}" for ${data.OBJECT}`, 'CDM');
  }

  /**
   * Block-diagonal 6x6 [[R, 0], [0, R]] from a 3x3 rotation.
   * @param r The 3x3 rotation.
   * @returns The 6x6 matrix.
   */
  private static blockDiag6_(r: Matrix): Matrix {
    const out = Matrix.zero(6, 6).elements.map((row) => [...row]);

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        out[i][j] = r.elements[i][j];
        out[i + 3][j + 3] = r.elements[i][j];
      }
    }

    return new Matrix(out);
  }

  /**
   * Parse all key-value pairs from CDM lines. The unit tag of each value (the text inside a
   * trailing `[...]`) is kept in the same map under the key suffixed with `UNITS_SUFFIX_`.
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

      // Split off the unit tag in brackets ([m], [m/s], [m**2], ...)
      const unitMatch = (/\s*\[(.*?)\]\s*$/u).exec(value);
      const unit = unitMatch ? unitMatch[1].trim() : undefined;

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
      if (unit !== undefined) {
        keyValues.set(`${key}${CdmParser.UNITS_SUFFIX_}`, unit);
      }
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
      // No defaults for mandatory fields, so validate_ can report them (CCSDS 508.0-B-1 Table 3-1)
      CCSDS_CDM_VERS: kv.get('CCSDS_CDM_VERS') ?? '',
      CREATION_DATE: kv.get('CREATION_DATE') ?? '',
      ORIGINATOR: kv.get('ORIGINATOR') ?? '',
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
      MISS_DISTANCE: CdmParser.parseScaled_(kv, 'MISS_DISTANCE', 'm') as Kilometers,
      RELATIVE_SPEED: CdmParser.parseScaled_(kv, 'RELATIVE_SPEED', 'm/s') as KilometersPerSecond | undefined,
      RELATIVE_POSITION_R: CdmParser.parseScaled_(kv, 'RELATIVE_POSITION_R', 'm') as Kilometers | undefined,
      RELATIVE_POSITION_T: CdmParser.parseScaled_(kv, 'RELATIVE_POSITION_T', 'm') as Kilometers | undefined,
      RELATIVE_POSITION_N: CdmParser.parseScaled_(kv, 'RELATIVE_POSITION_N', 'm') as Kilometers | undefined,
      RELATIVE_VELOCITY_R: CdmParser.parseScaled_(kv, 'RELATIVE_VELOCITY_R', 'm/s') as KilometersPerSecond | undefined,
      RELATIVE_VELOCITY_T: CdmParser.parseScaled_(kv, 'RELATIVE_VELOCITY_T', 'm/s') as KilometersPerSecond | undefined,
      RELATIVE_VELOCITY_N: CdmParser.parseScaled_(kv, 'RELATIVE_VELOCITY_N', 'm/s') as KilometersPerSecond | undefined,
      COLLISION_PROBABILITY: CdmParser.parseOptionalFloat_(kv, 'COLLISION_PROBABILITY'),
      COLLISION_PROBABILITY_METHOD: kv.get('COLLISION_PROBABILITY_METHOD'),
      START_SCREEN_PERIOD: kv.get('START_SCREEN_PERIOD'),
      STOP_SCREEN_PERIOD: kv.get('STOP_SCREEN_PERIOD'),
      SCREEN_VOLUME_FRAME: kv.get('SCREEN_VOLUME_FRAME') as CdmRelativeData['SCREEN_VOLUME_FRAME'],
      SCREEN_VOLUME_SHAPE: kv.get('SCREEN_VOLUME_SHAPE') as CdmRelativeData['SCREEN_VOLUME_SHAPE'],
      SCREEN_VOLUME_X: CdmParser.parseScaled_(kv, 'SCREEN_VOLUME_X', 'm') as Kilometers | undefined,
      SCREEN_VOLUME_Y: CdmParser.parseScaled_(kv, 'SCREEN_VOLUME_Y', 'm') as Kilometers | undefined,
      SCREEN_VOLUME_Z: CdmParser.parseScaled_(kv, 'SCREEN_VOLUME_Z', 'm') as Kilometers | undefined,
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
      X: CdmParser.parseScaled_(kv, `${prefix}X`, 'km') as Kilometers,
      Y: CdmParser.parseScaled_(kv, `${prefix}Y`, 'km') as Kilometers,
      Z: CdmParser.parseScaled_(kv, `${prefix}Z`, 'km') as Kilometers,
      X_DOT: CdmParser.parseScaled_(kv, `${prefix}X_DOT`, 'km/s') as KilometersPerSecond,
      Y_DOT: CdmParser.parseScaled_(kv, `${prefix}Y_DOT`, 'km/s') as KilometersPerSecond,
      Z_DOT: CdmParser.parseScaled_(kv, `${prefix}Z_DOT`, 'km/s') as KilometersPerSecond,
      MASS: CdmParser.parseOptionalFloat_(kv, `${prefix}MASS`),
      CD_AREA_OVER_MASS: CdmParser.parseOptionalFloat_(kv, `${prefix}CD_AREA_OVER_MASS`),
      CR_AREA_OVER_MASS: CdmParser.parseOptionalFloat_(kv, `${prefix}CR_AREA_OVER_MASS`),
      THRUST_ACCELERATION: CdmParser.parseOptionalFloat_(kv, `${prefix}THRUST_ACCELERATION`),
      SEDR: CdmParser.parseOptionalFloat_(kv, `${prefix}SEDR`),
      TIME_LASTOB_START: kv.get(`${prefix}TIME_LASTOB_START`),
      TIME_LASTOB_END: kv.get(`${prefix}TIME_LASTOB_END`),
      // Position covariance
      CR_R: CdmParser.parseScaled_(kv, `${prefix}CR_R`, 'm**2'),
      CT_R: CdmParser.parseScaled_(kv, `${prefix}CT_R`, 'm**2'),
      CT_T: CdmParser.parseScaled_(kv, `${prefix}CT_T`, 'm**2'),
      CN_R: CdmParser.parseScaled_(kv, `${prefix}CN_R`, 'm**2'),
      CN_T: CdmParser.parseScaled_(kv, `${prefix}CN_T`, 'm**2'),
      CN_N: CdmParser.parseScaled_(kv, `${prefix}CN_N`, 'm**2'),
      // Velocity covariance
      CRDOT_R: CdmParser.parseScaled_(kv, `${prefix}CRDOT_R`, 'm**2/s'),
      CRDOT_T: CdmParser.parseScaled_(kv, `${prefix}CRDOT_T`, 'm**2/s'),
      CRDOT_N: CdmParser.parseScaled_(kv, `${prefix}CRDOT_N`, 'm**2/s'),
      CRDOT_RDOT: CdmParser.parseScaled_(kv, `${prefix}CRDOT_RDOT`, 'm**2/s**2'),
      CTDOT_R: CdmParser.parseScaled_(kv, `${prefix}CTDOT_R`, 'm**2/s'),
      CTDOT_T: CdmParser.parseScaled_(kv, `${prefix}CTDOT_T`, 'm**2/s'),
      CTDOT_N: CdmParser.parseScaled_(kv, `${prefix}CTDOT_N`, 'm**2/s'),
      CTDOT_RDOT: CdmParser.parseScaled_(kv, `${prefix}CTDOT_RDOT`, 'm**2/s**2'),
      CTDOT_TDOT: CdmParser.parseScaled_(kv, `${prefix}CTDOT_TDOT`, 'm**2/s**2'),
      CNDOT_R: CdmParser.parseScaled_(kv, `${prefix}CNDOT_R`, 'm**2/s'),
      CNDOT_T: CdmParser.parseScaled_(kv, `${prefix}CNDOT_T`, 'm**2/s'),
      CNDOT_N: CdmParser.parseScaled_(kv, `${prefix}CNDOT_N`, 'm**2/s'),
      CNDOT_RDOT: CdmParser.parseScaled_(kv, `${prefix}CNDOT_RDOT`, 'm**2/s**2'),
      CNDOT_TDOT: CdmParser.parseScaled_(kv, `${prefix}CNDOT_TDOT`, 'm**2/s**2'),
      CNDOT_NDOT: CdmParser.parseScaled_(kv, `${prefix}CNDOT_NDOT`, 'm**2/s**2'),
    };
  }

  /**
   * Build an object's 6x6 RTN covariance (km**2, km**2/s, km**2/s**2) from its lower-triangular
   * CDM terms, in R, T, N, Rdot, Tdot, Ndot order. Velocity terms the CDM omits are zero.
   * @param data The object's state data (already converted to km units by parse).
   * @returns The symmetric 6x6 covariance, or null when CR_R, CT_T or CN_N is missing.
   */
  private static parseCovariance_(data: CdmObjectData): Matrix | null {
    if (
      data.CR_R === undefined ||
      data.CT_T === undefined ||
      data.CN_N === undefined
    ) {
      return null;
    }

    // Lower triangle, row by row (CCSDS 508.0-B-1 Table 3-4)
    const lower: (number | undefined)[][] = [
      [data.CR_R],
      [data.CT_R, data.CT_T],
      [data.CN_R, data.CN_T, data.CN_N],
      [data.CRDOT_R, data.CRDOT_T, data.CRDOT_N, data.CRDOT_RDOT],
      [data.CTDOT_R, data.CTDOT_T, data.CTDOT_N, data.CTDOT_RDOT, data.CTDOT_TDOT],
      [data.CNDOT_R, data.CNDOT_T, data.CNDOT_N, data.CNDOT_RDOT, data.CNDOT_TDOT, data.CNDOT_NDOT],
    ];
    const m: number[][] = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j <= i; j++) {
        const v = lower[i][j] ?? 0;

        m[i][j] = v;
        m[j][i] = v;
      }
    }

    return new Matrix(m);
  }

  /**
   * Parse a numeric value and convert it to ootk's km-based unit.
   *
   * `standardUnit` is the CCSDS 508.0-B-1 unit for the keyword; it is used when the value has no
   * unit tag. A tag that names the km-based unit (`km`, `km/s`, `km**2`, `km**2/s`,
   * `km**2/s**2`) is honoured with no scaling.
   * @param kv The key-value map (with unit tags).
   * @param key The keyword (object-prefixed where applicable).
   * @param standardUnit The CCSDS unit for this keyword.
   * @returns The value in km, km/s, km**2, km**2/s or km**2/s**2, or undefined when absent.
   * @throws ParseError when the unit tag is not one this keyword can carry.
   */
  private static parseScaled_(
    kv: Map<string, string>,
    key: string,
    standardUnit: 'm' | 'm/s' | 'km' | 'km/s' | 'm**2' | 'm**2/s' | 'm**2/s**2',
  ): number | undefined {
    const value = CdmParser.parseOptionalFloat_(kv, key);

    if (value === undefined) {
      return undefined;
    }

    const unit = (kv.get(`${key}${CdmParser.UNITS_SUFFIX_}`) ?? standardUnit).replace(/\s+/gu, '').toLowerCase();
    const scales: Record<string, number> = {
      m: 1e-3,
      km: 1,
      'm/s': 1e-3,
      'km/s': 1,
      'm**2': 1e-6,
      'km**2': 1,
      'm**2/s': 1e-6,
      'km**2/s': 1,
      'm**2/s**2': 1e-6,
      'km**2/s**2': 1,
    };
    const family = (u: string): string => u.replace(/^k?m/u, 'L');
    const scale = scales[unit];

    if (scale === undefined || family(unit) !== family(standardUnit)) {
      throw new ParseError(`Unexpected unit [${unit}] for ${key}; CCSDS 508.0-B-1 gives [${standardUnit}]`, 'CDM');
    }

    return value * scale;
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
