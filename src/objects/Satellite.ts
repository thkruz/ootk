/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Many of the classes are based off of the work of @david-rc-dayton and his
 * Pious Squid library (https://github.com/david-rc-dayton/pious_squid) which
 * is licensed under the MIT license.
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

import { PayloadStatus } from '../types/PayloadStatus';
import { Sun } from '../body/SunBody';
import { CommunicationDevice } from '../comm/CommunicationDevice';
import { FormatTle } from '../coordinate/FormatTle';
import { Geodetic } from '../coordinate/Geodetic';
import type { ClassicalElements } from '../coordinate/index';
import { ITRF } from '../coordinate/ITRF';
import { J2000 } from '../coordinate/J2000';
import { RIC } from '../coordinate/RIC';
import { TEME } from '../coordinate/TEME';
import { Tle } from '../coordinate/Tle';
import { CatalogSource } from '../enums/CatalogSource';
import { PropagatorType } from '../enums/PropagatorType';
import { SunStatus } from '../enums/SunStatus';
import { ForceModel } from '../force/ForceModel';
import { OmmDataFormat, OmmParsedDataFormat } from '../interfaces/OmmFormat';
import { NumericalPropagatorOptions } from '../interfaces/NumericalPropagatorOptions';
import { OptionsParams } from '../interfaces/OptionsParams';
import { SatelliteParams } from '../interfaces/SatelliteParams';
import { Sgp4 } from '../sgp4/sgp4';
import { RAE } from '../observation/RAE';
import { DormandPrince54Propagator } from '../propagator/DormandPrince54Propagator';
import { KeplerPropagator } from '../propagator/KeplerPropagator';
import { Propagator } from '../propagator/Propagator';
import { RungeKutta4Propagator } from '../propagator/RungeKutta4Propagator';
import { RungeKutta89Propagator } from '../propagator/RungeKutta89Propagator';
import { Sgp4Propagator } from '../propagator/Sgp4Propagator';
import { Vector3D } from '../operations/Vector3D';
import { Sensor } from '../sensor/Sensor';
import { EpochUTC } from '../time/EpochUTC';
import { ecef2rae, eci2ecef, eci2lla, jday } from '../transforms/index';
import type {
  Degrees,
  DegreesPerDay,
  EcefVec3,
  GreenwichMeanSiderealTime,
  Kilometers,
  LaunchDetails,
  LlaVec3,
  Minutes,
  OperationsDetails,
  PosVel,
  Radians,
  RaeVec3,
  SatelliteRecord,
  Seconds,
  SpaceCraftDetails,
  TleLine1,
  TleLine2,
} from '../types/types';
import { DEG2RAD, MILLISECONDS_TO_DAYS, MINUTES_PER_DAY } from '../utils/constants';
import { dopplerFactor } from './../utils/functions';
import { GroundObject } from './GroundObject';
import { SpaceObject } from './SpaceObject';

/**
 * Options for the Satellite.clone() method.
 */
export interface SatelliteCloneOptions {
  /** If true, clone history entries. If false (default), start with empty history but same config. */
  cloneHistory?: boolean;
}

/**
 * Represents a satellite object with orbital information and methods for
 * calculating its position and other properties.
 */
export class Satellite extends SpaceObject {
  apogee!: Kilometers;
  argOfPerigee!: Degrees;
  bstar!: number;
  eccentricity!: number;
  epochDay!: number;
  epochYear!: number;
  inclination!: Degrees;
  intlDes!: string;
  meanAnomaly!: Degrees;
  meanMoDev1!: number;
  meanMoDev2!: number;
  meanMotion!: number;
  options: OptionsParams;
  perigee!: Kilometers;
  period!: Minutes;
  rightAscension!: Degrees;
  satrec!: SatelliteRecord;
  /** The canonical satellite catalog number. May be a 5-digit numeric, alpha-5,
   * 6-digit numeric, or an extended (7+ digit) ID such as CelesTrak supplemental
   * 9-digit IDs. */
  sccNum!: string;
  /** The 5-character alpha-5 representation, or `null` when {@link sccNum} is
   * an extended ID that exceeds the alpha-5 capacity (max numeric value 339 999). */
  sccNum5!: string | null;
  /** The 6-digit numeric representation, or `null` when {@link sccNum} is
   * an extended ID that exceeds the alpha-5 capacity (max numeric value 339 999). */
  sccNum6!: string | null;
  tle1!: TleLine1;
  tle2!: TleLine2;
  /** The semi-major axis of the satellite's orbit. */
  semiMajorAxis!: Kilometers;
  /** The semi-minor axis of the satellite's orbit. */
  semiMinorAxis!: Kilometers;

  // ==================== Detailed Properties (merged from DetailedSatellite) ====================

  // Launch details
  /** Launch date (ISO string or human-readable) */
  launchDate: string = '';
  /** Launch mass in kg */
  launchMass: string = '';
  /** Launch site name/code */
  launchSite: string = '';
  /** Launch pad identifier */
  launchPad: string = '';
  /** Launch vehicle name */
  launchVehicle: string = '';

  // Spacecraft details
  /** Satellite bus/platform */
  bus: string = '';
  /** Satellite configuration */
  configuration: string = '';
  /** Dry mass in kg */
  dryMass: string = '';
  /** Equipment list */
  equipment: string = '';
  /** Expected lifetime */
  lifetime: string | number = '';
  /** Maneuver capability */
  maneuver: string = '';
  /** Manufacturer name */
  manufacturer: string = '';
  /** Propulsion motor */
  motor: string = '';
  /** Payload description */
  payload: string = '';
  /** Power system description */
  power: string = '';
  /** Primary purpose/mission type */
  purpose: string = '';
  /** Physical shape */
  shape: string = '';
  /** Solar panel span */
  span: string = '';

  // Physical dimensions
  /** Length in meters */
  length: string = '';
  /** Diameter in meters */
  diameter: string = '';

  // Operations details
  /** Mission name */
  mission: string = '';
  /** Operating user/agency */
  user: string = '';
  /** Owner organization */
  owner: string = '';
  /** Country of origin/registration */
  country: string = '';

  // Catalog details
  /** Catalog source (e.g., VIMPEL) */
  source: string = '';
  /** Alternate catalog ID */
  altId: string = '';
  /** Alternate name */
  altName: string = '';
  /** Visual magnitude */
  vmag: number | null = null;
  /** Radar cross-section */
  rcs: number | null = null;
  /** Operational status */
  status: PayloadStatus = PayloadStatus.UNKNOWN;

  constructor(info: SatelliteParams, options?: OptionsParams) {
    // Handle VIMPEL source - zero out SCC number in TLE
    if (info.source === CatalogSource.VIMPEL && info.tle1 && info.tle2) {
      info = Satellite.setSccNumTo0_(info);
    }

    super(info);

    if (info.tle1 && info.tle2) {
      this.parseTleAndUpdateOrbit_(info.tle1, info.tle2, info.sccNum);
    } else if (info.omm) {
      this.parseOmmAndUpdateOrbit_(info.omm);
    } else {
      throw new Error('tle1 and tle2 or omm must be provided to create a Satellite object.');
    }

    this.options = options ?? {
      notes: '',
    };

    // Initialize detailed properties
    this.initDetailedProperties_(info);

    // Enable history tracking if config provided
    if (info.historyConfig) {
      this.enableHistory(info.historyConfig);
    }
  }

  /**
   * Initializes detailed properties from params.
   */
  private initDetailedProperties_(info: SatelliteParams): void {
    // Launch details
    this.launchDate = info.launchDate ?? '';
    this.launchMass = info.launchMass ?? '';
    this.launchSite = info.launchSite ?? '';
    this.launchPad = info.launchPad ?? '';
    this.launchVehicle = info.launchVehicle ?? '';

    // Spacecraft details
    this.bus = info.bus ?? '';
    this.configuration = info.configuration ?? '';
    this.dryMass = info.dryMass ?? '';
    this.equipment = info.equipment ?? '';
    this.lifetime = info.lifetime ?? '';
    this.maneuver = info.maneuver ?? '';
    this.manufacturer = info.manufacturer ?? '';
    this.motor = info.motor ?? '';
    this.payload = info.payload ?? '';
    this.power = info.power ?? '';
    this.purpose = info.purpose ?? '';
    this.shape = info.shape ?? '';
    this.span = info.span ?? '';

    // Physical dimensions
    this.length = info.length ?? '';
    this.diameter = info.diameter ?? '';

    // Operations details
    this.mission = info.mission ?? '';
    this.user = info.user ?? '';
    this.owner = info.owner ?? '';
    this.country = info.country ?? '';

    // Catalog details
    this.source = info.source ?? '';
    this.altId = info.altId ?? '';
    this.altName = info.altName ?? '';
    this.vmag = info.vmag ?? null;
    this.rcs = info.rcs ?? null;
    this.status = info.status ?? PayloadStatus.UNKNOWN;
  }

  /**
   * Zeroes out the SCC number in TLE for VIMPEL sources.
   */
  private static setSccNumTo0_(info: SatelliteParams): SatelliteParams {
    let tle1 = info.tle1 as string;
    let tle2 = info.tle2 as string;

    tle1 = FormatTle.setCharAt(tle1, 2, '0');
    tle1 = FormatTle.setCharAt(tle1, 3, '0');
    tle1 = FormatTle.setCharAt(tle1, 4, '0');
    tle1 = FormatTle.setCharAt(tle1, 5, '0');
    tle1 = FormatTle.setCharAt(tle1, 6, '0');
    tle2 = FormatTle.setCharAt(tle2, 2, '0');
    tle2 = FormatTle.setCharAt(tle2, 3, '0');
    tle2 = FormatTle.setCharAt(tle2, 4, '0');
    tle2 = FormatTle.setCharAt(tle2, 5, '0');
    tle2 = FormatTle.setCharAt(tle2, 6, '0');

    return {
      ...info,
      tle1: tle1 as TleLine1,
      tle2: tle2 as TleLine2,
    };
  }

  // ==================== Static Factory Methods ====================

  /**
   * Creates a Satellite from TLE lines.
   * @param tle1 - First line of TLE
   * @param tle2 - Second line of TLE
   * @param name - Optional satellite name
   */
  static fromTLE(tle1: TleLine1, tle2: TleLine2, name?: string): Satellite {
    return new Satellite({ tle1, tle2, name });
  }

  /**
   * Creates a Satellite from a Tle object.
   * @param tle - The Tle object
   * @param name - Optional satellite name (overrides TLE name)
   */
  static fromTle(tle: Tle, name?: string): Satellite {
    return new Satellite({
      tle1: tle.line1,
      tle2: tle.line2,
      name,
    });
  }

  /**
   * Creates a Satellite from an OMM (Orbit Mean-elements Message) data object.
   * @param omm - The OMM data in flat format
   * @param name - Optional satellite name (overrides OMM OBJECT_NAME)
   */
  static fromOmm(omm: OmmDataFormat, name?: string): Satellite {
    return new Satellite({ omm, name: name ?? omm.OBJECT_NAME });
  }

  // ==================== TLE/OMM Parsing ====================

  /**
   * Converts an OMM international designator (e.g. `"2026-114A"`) to the
   * TLE intl-des column format (cols 10-17, e.g. `"26114A"`). Inputs that
   * don't match the OMM `YYYY-NNNL...` pattern pass through unchanged.
   */
  private static ommObjectIdToTleIntlDes_(objectId: string | undefined): string {
    if (!objectId) {
      return '';
    }
    // OMM intl des: YYYY-NNNL[LL] → TLE intl des: YYNNNL[LL]
    const match = objectId.match(/^\d{4}-(?<rest>\d{3}[A-Z]{1,3})$/u);

    if (match?.groups?.rest) {
      return objectId.slice(2, 4) + match.groups.rest;
    }

    return objectId;
  }

  /**
   * Normalizes {@link sccNum} to the display-canonical numeric form and derives
   * {@link sccNum5} and {@link sccNum6}. The class invariant is that
   * `Satellite.sccNum` is always numeric — never an alpha-5 string. Alpha-5
   * inputs ("T0001") are converted to their 6-digit numeric equivalent
   * ("270001"); the alpha-5 form is preserved on {@link sccNum5}.
   *
   * Extended (7+ digit) IDs that exceed the alpha-5 capacity (max 339 999)
   * leave sccNum5/sccNum6 set to `null`.
   *
   * Invalid input (empty string, malformed token) is passed through unchanged
   * so callers can store placeholder sccNums on notional / debris stubs.
   */
  private assignAlpha5Forms_(): void {
    try {
      this.sccNum = Tle.convertA5to6Digit(this.sccNum);
    } catch {
      // Pass through invalid sccNum (e.g., "" on notional debris).
    }

    // Strip leading zeros from purely-numeric sccNums so the display form is
    // consistent across widths: "00005" → "5", "025544" → "25544",
    // "0270001" → "270001", "799500766" → "799500766" (no zeros to strip).
    // Without this, the TLE-construction path produces "5" via parseInt
    // while the OMM path produces "00005" via padStart, and the catalog
    // would carry two different display strings for the same satellite.
    // Alpha-5 strings (e.g. "T0001") have no leading zeros and are untouched.
    if ((/^0+\d/u).test(this.sccNum)) {
      this.sccNum = this.sccNum.replace(/^0+/u, '');
    }

    const kind = Tle.classifySatNum(this.sccNum);

    if (kind === 'numeric5' || kind === 'numeric6') {
      this.sccNum5 = Tle.convert6DigitToA5(this.sccNum);
      this.sccNum6 = this.sccNum;
    } else {
      this.sccNum5 = null;
      this.sccNum6 = null;
    }
  }

  private parseTleAndUpdateOrbit_(tle1: TleLine1, tle2: TleLine2, sccNum?: string) {
    const tleData = Tle.parse(tle1, tle2);

    this.tle1 = tle1;
    this.tle2 = tle2;

    this.sccNum = sccNum ?? tleData.satNum.toString();
    this.assignAlpha5Forms_();
    this.intlDes = tleData.intlDes;
    this.epochYear = tleData.epochYear;
    this.epochDay = tleData.epochDay;
    this.meanMoDev1 = tleData.meanMoDev1;
    this.meanMoDev2 = tleData.meanMoDev2;
    this.bstar = tleData.bstar;
    this.inclination = tleData.inclination;
    this.rightAscension = tleData.rightAscension;
    this.eccentricity = tleData.eccentricity;
    this.argOfPerigee = tleData.argOfPerigee;
    this.meanAnomaly = tleData.meanAnomaly;
    this.meanMotion = tleData.meanMotion;
    this.period = tleData.period;
    this.semiMajorAxis = ((8681663.653 / this.meanMotion) ** (2 / 3)) as Kilometers;
    this.semiMinorAxis = (this.semiMajorAxis * Math.sqrt(1 - this.eccentricity ** 2)) as Kilometers;
    this.apogee = (this.semiMajorAxis * (1 + this.eccentricity) - 6371) as Kilometers;
    this.perigee = (this.semiMajorAxis * (1 - this.eccentricity) - 6371) as Kilometers;
    this.satrec = Sgp4.createSatrec(tle1, tle2);
  }

  private parseOmmAndUpdateOrbit_(omm: OmmDataFormat) {
    const noradStr = String(omm.NORAD_CAT_ID);

    this.sccNum = noradStr.padStart(5, '0');
    this.assignAlpha5Forms_();
    this.intlDes = omm.OBJECT_ID;
    const YYYY = omm.EPOCH.slice(0, 4);
    const MM = omm.EPOCH.slice(5, 7);
    const DD = omm.EPOCH.slice(8, 10);
    const hh = omm.EPOCH.slice(11, 13);
    const mm = omm.EPOCH.slice(14, 16);
    const ss = omm.EPOCH.slice(17, 23);
    const epochDateObj = Date.UTC(Number(YYYY), Number(MM) - 1, Number(DD), Number(hh), Number(mm), Number(ss));
    const dayOfYear = (epochDateObj - Date.UTC(Number(YYYY), 0, 0)) / 86400000;

    const ommParsed: OmmParsedDataFormat = {
      ...omm,
      NORAD_CAT_ID: noradStr,
      MEAN_MOTION: String(omm.MEAN_MOTION),
      ECCENTRICITY: String(omm.ECCENTRICITY),
      INCLINATION: String(omm.INCLINATION),
      RA_OF_ASC_NODE: String(omm.RA_OF_ASC_NODE),
      ARG_OF_PERICENTER: String(omm.ARG_OF_PERICENTER),
      MEAN_ANOMALY: String(omm.MEAN_ANOMALY),
      EPHEMERIS_TYPE: String(omm.EPHEMERIS_TYPE),
      ELEMENT_SET_NO: String(omm.ELEMENT_SET_NO),
      REV_AT_EPOCH: String(omm.REV_AT_EPOCH),
      BSTAR: String(omm.BSTAR),
      MEAN_MOTION_DOT: String(omm.MEAN_MOTION_DOT),
      MEAN_MOTION_DDOT: String(omm.MEAN_MOTION_DDOT),
      epoch: {
        year: Number(YYYY),
        month: Number(MM),
        day: Number(DD),
        hour: Number(hh),
        minute: Number(mm),
        second: Number(ss),
        doy: dayOfYear,
      },
    };

    this.epochYear = parseInt(YYYY.slice(2, 4));
    this.epochDay = dayOfYear;
    this.meanMoDev1 = Number(omm.MEAN_MOTION_DOT);
    this.meanMoDev2 = Number(omm.MEAN_MOTION_DDOT);
    this.bstar = Number(omm.BSTAR);
    this.inclination = Number(omm.INCLINATION) as Degrees;
    this.rightAscension = Number(omm.RA_OF_ASC_NODE) as Degrees;
    this.eccentricity = Number(omm.ECCENTRICITY);
    this.argOfPerigee = Number(omm.ARG_OF_PERICENTER) as Degrees;
    this.meanAnomaly = Number(omm.MEAN_ANOMALY) as Degrees;
    this.meanMotion = Number(omm.MEAN_MOTION);
    this.period = (1440 / this.meanMotion) as Minutes;
    this.semiMajorAxis = ((8681663.653 / this.meanMotion) ** (2 / 3)) as Kilometers;
    this.semiMinorAxis = (this.semiMajorAxis * Math.sqrt(1 - this.eccentricity ** 2)) as Kilometers;
    this.apogee = (this.semiMajorAxis * (1 + this.eccentricity) - 6371) as Kilometers;
    this.perigee = (this.semiMajorAxis * (1 - this.eccentricity) - 6371) as Kilometers;

    // Generate TLE lines from OMM data so tle1/tle2 are always available
    const { tle1, tle2 } = FormatTle.createTle({
      inc: this.inclination,
      meanmo: this.meanMotion,
      rasc: this.rightAscension,
      argPe: this.argOfPerigee,
      meana: this.meanAnomaly,
      ecen: this.eccentricity,
      epochyr: this.epochYear,
      epochday: this.epochDay,
      intl: Satellite.ommObjectIdToTleIntlDes_(omm.OBJECT_ID),
      // Extended (7+ digit) IDs don't fit TLE cols 3-7. Truncate to the last 5
      // digits for the TLE string; the canonical ID stays on this.sccNum.
      scc: Tle.classifySatNum(this.sccNum) === 'extended' ? this.sccNum.slice(-5) : this.sccNum,
      bstar: this.bstar,
      meanMotionDot: this.meanMoDev1,
      meanMotionDdot: this.meanMoDev2,
      classification: String(omm.CLASSIFICATION_TYPE) || 'U',
      revAtEpoch: Number(omm.REV_AT_EPOCH) || 0,
      elementSetNo: Number(omm.ELEMENT_SET_NO) || 999,
      ephemerisType: Number(omm.EPHEMERIS_TYPE) || 0,
    });

    this.tle1 = tle1;
    this.tle2 = tle2;
    this.satrec = Sgp4.createSatrecFromOmm(ommParsed);
  }

  // ==================== Type Checking ====================

  /**
   * Checks if the object is a satellite.
   * @returns True if the object is a satellite, false otherwise.
   */
  override isSatellite(): boolean {
    return true;
  }

  /**
   * Returns whether the satellite is static or not.
   * @returns True if the satellite is static, false otherwise.
   */
  override isStatic(): boolean {
    return false;
  }

  // ==================== Static Validation ====================

  /**
   * Checks if the given SatelliteRecord object is valid by checking if its properties are all numbers.
   * @param satrec - The SatelliteRecord object to check.
   * @returns True if the SatelliteRecord object is valid, false otherwise.
   */
  static isValidSatrec(satrec: SatelliteRecord): boolean {
    if (
      isNaN(satrec.a) ||
      isNaN(satrec.am) ||
      isNaN(satrec.alta) ||
      isNaN(satrec.em) ||
      isNaN(satrec.mo) ||
      isNaN(satrec.ecco) ||
      isNaN(satrec.no)
    ) {
      return false;
    }

    return true;
  }

  // ==================== TLE Methods ====================

  ageOfElset(nowInput?: Date, outputUnits: 'days' | 'hours' | 'minutes' | 'seconds' = 'days'): number {
    return Tle.calcElsetAge(this.tle1, nowInput, outputUnits);
  }

  editTle(tle1: TleLine1, tle2: TleLine2, sccNum?: string): void {
    this.parseTleAndUpdateOrbit_(tle1, tle2, sccNum);
  }

  /**
   * Converts the satellite object to a TLE (Two-Line Element) object.
   * @returns The TLE object representing the satellite.
   */
  toTle(): Tle {
    return new Tle(this.tle1, this.tle2);
  }

  // ==================== Position Methods ====================

  /**
   * Calculates the azimuth angle of the satellite relative to the given sensor at the specified date. If no date is
   * provided, the current time of the satellite is used.
   * @variation optimized
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the azimuth angle. Optional, defaults to the current date.
   * @returns The azimuth angle of the satellite relative to the given sensor at the specified date.
   */
  override az(observer: GroundObject, date: Date = new Date()): Degrees | null {
    const rae = this.rae(observer, date);

    if (!rae) {
      return null;
    }

    return rae.az;
  }

  /**
   * Calculates the RAE (Range, Azimuth, Elevation) values for a given sensor and date. If no date is provided, the
   * current time is used.
   * @variation expanded
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the RAE values. Optional, defaults to the current date.
   * @returns The RAE values for the given sensor and date.
   */
  toRae(observer: GroundObject, date: Date = new Date()): RAE | null {
    const rae = this.rae(observer, date);

    if (!rae) {
      return null;
    }

    const rae2 = this.rae(observer, new Date(date.getTime() + 1000));

    if (!rae2) {
      return null;
    }

    const epoch = new EpochUTC((date.getTime() / 1000) as Seconds);
    const rangeRate = rae2.rng - rae.rng;
    const azimuthRate = rae2.az - rae.az;
    const elevationRate = rae2.el - rae.el;

    return new RAE(
      epoch,
      rae.rng,
      (rae.az * DEG2RAD) as Radians,
      (rae.el * DEG2RAD) as Radians,
      rangeRate,
      azimuthRate,
      elevationRate,
    );
  }

  /**
   * Calculates position in the ECEF (Earth-Centered Earth-Fixed) frame at a given time.
   *
   * **Coordinate Frame: ECEF (pseudo-ITRF)**
   *
   * Returns Earth-fixed coordinates that rotate with the Earth. The transformation
   * from TEME to ECEF uses a simplified rotation based on GMST (Greenwich Mean Sidereal Time).
   *
   * For higher precision Earth-fixed coordinates that account for precession, nutation,
   * and polar motion, use `toITRF()` instead.
   *
   * @variation optimized
   * @param date - The date at which to calculate the ECEF position. Optional, defaults to the current date.
   * @returns The ECEF position at the specified date, or null if propagation fails.
   */
  override ecef(date: Date = new Date()): EcefVec3<Kilometers> | null {
    const { gmst } = Satellite.calculateTimeVariables_(date);
    const eci = this.eci(date);

    if (!eci) {
      return null;
    }

    return eci2ecef(eci.position, gmst);
  }

  /**
   * Calculates position and velocity in the TEME (True Equator Mean Equinox) frame at a given time.
   *
   * **Coordinate Frame: TEME**
   *
   * TEME is the native output frame of SGP4/SDP4 propagation. It uses the true equator of date
   * and a mean equinox that accounts for precession but uses a simplified nutation model.
   *
   * **When to use TEME vs J2000:**
   * - Use TEME (`eci()`) for quick calculations, visualization, and when frame accuracy isn't critical
   * - Use J2000 (`toJ2000()`) for precise calculations, force modeling, and interoperability with
   *   other systems that expect J2000 coordinates
   *
   * To convert to other frames:
   * - J2000: Use `toJ2000()` method
   * - ITRF/ECEF: Use `toITRF()` or `ecef()` methods
   * - Geodetic: Use `lla()` or `toGeodetic()` methods
   *
   * @variation optimized
   * @param date - The date at which to calculate the position. Optional, defaults to the current date.
   * @param j - Julian date. Optional, defaults to null.
   * @param gmst - Greenwich Mean Sidereal Time. Optional, defaults to null.
   * @example
   * ```typescript
   * import { Satellite, Tle } from 'ootk';
   *
   * const tle = new Tle(
   *   '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002',
   *   '2 25544  51.6400 208.9163 0006730 358.5720 122.3372 15.50104550 10001'
   * );
   * const satellite = new Satellite({ tle });
   *
   * // Get current position in TEME frame
   * const pv = satellite.eci();
   * if (pv) {
   *   console.log(`Position: ${pv.position.x.toFixed(2)}, ${pv.position.y.toFixed(2)}, ${pv.position.z.toFixed(2)} km`);
   *   console.log(`Velocity: ${pv.velocity.x.toFixed(4)} km/s`);
   * }
   *
   * // For J2000 frame, use toJ2000() instead
   * const j2000 = satellite.toJ2000();
   * ```
   * @returns Position and velocity in TEME frame, or null if propagation fails.
   */
  override eci(date?: Date, j?: number, gmst?: GreenwichMeanSiderealTime): PosVel | null {
    date ??= new Date();
    const { m } = Satellite.calculateTimeVariables_(date, this.satrec, j, gmst);

    if (m === null) {
      return null;
    }
    const pv = Sgp4.propagate(this.satrec, m);

    if (!pv.position || !pv.velocity) {
      return null;
    }

    // Record to history if enabled
    if (this.isHistoryEnabled) {
      this.recordToHistory(date, { position: pv.position, velocity: pv.velocity });
    }

    return pv as PosVel;
  }

  /**
   * Calculates the position and velocity in the J2000 (EME2000) frame at a given time.
   *
   * **Coordinate Frame: J2000**
   *
   * J2000 (also called EME2000) is an Earth-Centered Inertial (ECI) frame defined by:
   * - Origin: Earth's center of mass
   * - X-axis: Mean vernal equinox at J2000.0 epoch (Jan 1, 2000 12:00 TT)
   * - Z-axis: Earth's mean rotation axis at J2000.0
   * - Y-axis: Completes right-handed system
   *
   * This is the standard ECI frame for precise calculations and interoperability.
   *
   * **Internally:** SGP4 outputs TEME, which is then converted to J2000 via precession
   * and nutation transformations.
   *
   * @variation expanded
   * @param date - The date for which to calculate the J2000 coordinates, defaults to the current date.
   * @returns The J2000 state vector (position and velocity).
   * @throws Error if propagation fails.
   */
  override toJ2000(date: Date = new Date()): J2000 {
    const { m } = Satellite.calculateTimeVariables_(date, this.satrec);

    if (m === null) {
      throw new Error('Propagation failed!');
    }
    const pv = Sgp4.propagate(this.satrec, m);

    if (!pv.position || !pv.velocity) {
      throw new Error('Propagation failed!');
    }
    const p = pv.position;
    const v = pv.velocity;

    const epoch = new EpochUTC((date.getTime() / 1000) as Seconds);
    const pos = new Vector3D(p.x, p.y, p.z);
    const vel = new Vector3D(v.x, v.y, v.z);

    return new TEME(epoch, pos, vel).toJ2000();
  }

  /**
   * Returns the elevation angle of the satellite as seen by the given sensor at the specified time.
   * @variation optimized
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the elevation angle. Optional, defaults to the current date.
   * @returns The elevation angle of the satellite as seen by the given sensor at the specified time.
   */
  override el(observer: GroundObject, date: Date = new Date()): Degrees | null {
    const rae = this.rae(observer, date);

    if (!rae) {
      return null;
    }

    return rae.el;
  }

  /**
   * Calculates LLA position at a given time.
   * @variation optimized
   * @param date - The date at which to calculate the LLA position. Optional, defaults to the current date.
   * @param j - Julian date. Optional, defaults to null.
   * @param gmst - Greenwich Mean Sidereal Time. Optional, defaults to null.
   * @returns The LLA position at the specified date.
   */
  override lla(date?: Date, j?: number, gmst?: GreenwichMeanSiderealTime): LlaVec3<Degrees, Kilometers> | null {
    date ??= new Date();
    if (!j || !gmst) {
      const timeVar = Satellite.calculateTimeVariables_(date, this.satrec);

      j = timeVar.j;
      gmst = timeVar.gmst;
    }

    const eci = this.eci(date, j, gmst);

    if (!eci) {
      return null;
    }

    const pos = eci.position;

    return eci2lla(pos, gmst);
  }

  /**
   * Converts the satellite's position to geodetic coordinates.
   * @variation expanded
   * @param date The date for which to calculate the geodetic coordinates. Defaults to the current date.
   * @returns The geodetic coordinates of the satellite.
   */
  toGeodetic(date: Date = new Date()): Geodetic {
    return this.toJ2000(date).toITRF().toGeodetic();
  }

  /**
   * Converts the satellite's position to the ITRF (International Terrestrial Reference Frame) at the specified date.
   *
   * **Coordinate Frame: ITRF (Earth-Fixed)**
   *
   * ITRF is the standard Earth-fixed geocentric reference frame. Unlike the simplified ECEF
   * transformation in `ecef()`, this method performs the full transformation chain:
   * TEME → J2000 → ITRF, accounting for precession, nutation, and Earth rotation.
   *
   * Use ITRF when you need:
   * - Precise Earth-fixed coordinates
   * - Interoperability with GPS/GNSS systems
   * - Accurate ground track calculations
   *
   * @variation expanded
   * @param date The date for which to convert the position. Defaults to the current date.
   * @returns The satellite's position in the ITRF at the specified date.
   */
  override toITRF(date: Date = new Date()): ITRF {
    return this.toJ2000(date).toITRF();
  }

  /**
   * Converts the current satellite's position to the Reference-Inertial-Celestial (RIC) frame
   * relative to the specified reference satellite at the given date.
   * @variation expanded
   * @param reference The reference satellite.
   * @param date The date for which to calculate the RIC frame. Defaults to the current date.
   * @returns The RIC frame representing the current satellite's position relative to the reference satellite.
   */
  toRIC(reference: Satellite, date: Date = new Date()): RIC {
    return RIC.fromJ2000(this.toJ2000(date), reference.toJ2000(date));
  }

  /**
   * Converts the satellite's position to classical orbital elements.
   * @param date The date for which to calculate the classical elements. Defaults to the current date.
   * @returns The classical orbital elements of the satellite.
   */
  override toClassicalElements(date: Date = new Date()): ClassicalElements {
    return this.toJ2000(date).toClassicalElements();
  }

  /**
   * Calculates the RAE (Range, Azimuth, Elevation) vector for a given sensor and time.
   * @variation optimized
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the RAE vector. Optional, defaults to the current date.
   * @param j - Julian date. Optional, defaults to null.
   * @param gmst - Greenwich Mean Sidereal Time. Optional, defaults to null.
   * @example
   * ```typescript
   * import { Satellite, GroundObject, Tle, Degrees, Kilometers } from 'ootk';
   *
   * const tle = new Tle(line1, line2);
   * const satellite = new Satellite({ tle });
   *
   * // Define ground observer
   * const observer = new GroundObject({
   *   lat: 40.0 as Degrees,
   *   lon: -75.0 as Degrees,
   *   alt: 0.1 as Kilometers,
   * });
   *
   * // Get look angles
   * const rae = satellite.rae(observer);
   * if (rae) {
   *   console.log(`Range: ${rae.rng.toFixed(1)} km`);
   *   console.log(`Azimuth: ${rae.az.toFixed(2)}°`);
   *   console.log(`Elevation: ${rae.el.toFixed(2)}°`);
   *
   *   // Check if above horizon
   *   if (rae.el > 0) {
   *     console.log('Satellite is visible!');
   *   }
   * }
   * ```
   * @returns The RAE vector for the given sensor and time.
   */
  override rae(observer: GroundObject, date?: Date, j?: number, gmst?: GreenwichMeanSiderealTime): RaeVec3<Kilometers, Degrees> | null {
    date ??= new Date();
    if (typeof j !== 'number' || typeof gmst !== 'number') {
      const timeVariables = Satellite.calculateTimeVariables_(date, this.satrec, j, gmst);

      j = timeVariables.j;
      gmst = timeVariables.gmst;
    }
    const eci = this.eci(date, j, gmst);

    if (!eci) {
      return null;
    }

    const ecef = eci2ecef(eci.position, gmst);

    return ecef2rae(observer, ecef);
  }

  /**
   * Returns the range of the satellite from the given sensor at the specified time.
   * @variation optimized
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the range. Optional, defaults to the current date.
   * @returns The range of the satellite from the given sensor at the specified time.
   */
  override rng(observer: GroundObject, date: Date = new Date()): Kilometers | null {
    const rae = this.rae(observer, date);

    if (!rae) {
      return null;
    }

    return rae.rng;
  }

  // ==================== Doppler Methods ====================

  /**
   * Applies the Doppler effect to the given frequency based on the observer's position and the date.
   * @param freq - The frequency to apply the Doppler effect to.
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the Doppler effect. Optional, defaults to the current date.
   * @returns The frequency after applying the Doppler effect.
   */
  applyDoppler(freq: number, observer: GroundObject, date?: Date): number | null {
    const doppler = this.dopplerFactor(observer, date);

    if (!doppler) {
      return null;
    }

    return freq * doppler;
  }

  /**
   * Calculates the Doppler factor for the satellite.
   * @param observer The observer's ground position.
   * @param date The optional date for which to calculate the Doppler factor. If not provided, the current date is used.
   * @returns The calculated Doppler factor.
   */
  dopplerFactor(observer: GroundObject, date?: Date): number | null {
    const position = this.eci(date);

    if (!position) {
      return null;
    }

    return dopplerFactor(observer.eci(date), position.position, position.velocity);
  }

  // ==================== Detailed Property Getters ====================

  /**
   * Returns the launch details of the satellite.
   * @returns An object containing the launch date, launch mass, launch site, launch pad, and launch vehicle.
   */
  getLaunchDetails(): LaunchDetails {
    return {
      launchDate: this.launchDate,
      launchMass: this.launchMass,
      launchSite: this.launchSite,
      launchPad: this.launchPad,
      launchVehicle: this.launchVehicle,
    };
  }

  /**
   * Returns the operations details of the satellite.
   * @returns An object containing the user, mission, owner, and country details.
   */
  getOperationsDetails(): OperationsDetails {
    return {
      user: this.user,
      mission: this.mission,
      owner: this.owner,
      country: this.country,
    };
  }

  /**
   * Returns the spacecraft details.
   * @returns An object containing spacecraft configuration and physical details.
   */
  getSpaceCraftDetails(): SpaceCraftDetails {
    return {
      lifetime: this.lifetime,
      maneuver: this.maneuver,
      manufacturer: this.manufacturer,
      motor: this.motor,
      power: this.power,
      payload: this.payload,
      purpose: this.purpose,
      shape: this.shape,
      span: this.span,
      configuration: this.configuration,
      equipment: this.equipment,
      dryMass: this.dryMass,
      bus: this.bus,
    };
  }

  // ==================== Clone ====================

  /**
   * Creates a deep copy of this satellite.
   *
   * By default, history configuration is preserved but starts empty.
   * Pass `{ cloneHistory: true }` to also clone the history entries.
   *
   * Sensors and communication devices are deep cloned with their
   * parent references updated to point to the cloned satellite.
   *
   * @param options - Clone options
   * @returns A new Satellite instance
   */
  override clone(options?: SatelliteCloneOptions): Satellite {
    const cloned = new Satellite(
      {
        tle1: this.tle1,
        tle2: this.tle2,
        name: this.name,
        sccNum: this.sccNum,
        // Include detailed properties
        ...this.getLaunchDetails(),
        ...this.getOperationsDetails(),
        ...this.getSpaceCraftDetails(),
        length: this.length,
        diameter: this.diameter,
        source: this.source,
        altId: this.altId,
        altName: this.altName,
        vmag: this.vmag,
        rcs: this.rcs,
        status: this.status,
        // Preserve history config if enabled (starts with empty history)
        historyConfig: this.isHistoryEnabled ? this.history!.config : undefined,
      },
      { ...this.options },
    );

    cloned.id = this.id;
    cloned.active = this.active;
    cloned.metadata = this.metadata ? { ...this.metadata } : undefined;

    // Deep clone sensors with updated parent reference
    cloned.sensors = this.sensors.map((sensor) => {
      const clonedSensor = (sensor as Sensor).clone();

      clonedSensor.setParent(cloned);

      return clonedSensor;
    });

    // Deep clone comm devices with updated parent reference
    cloned.commDevices = this.commDevices.map((device) => {
      const clonedDevice = (device as CommunicationDevice).clone();

      clonedDevice.setParent(cloned);

      return clonedDevice;
    });

    // Clone history data if requested
    if (options?.cloneHistory && this.history) {
      cloned.disableHistory();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cloned as any).history_ = this.history.clone();
    }

    return cloned;
  }

  // ==================== Serialization ====================

  /**
   * Returns type-specific serialization data.
   */
  protected serializeSpecific(): Record<string, unknown> {
    return {
      tle1: this.tle1,
      tle2: this.tle2,
      sccNum: this.sccNum,
      options: this.options,
      sensorIds: this.sensors.map((s) => s.id),
      commDeviceIds: this.commDevices.map((d) => d.id),
      // Detailed properties
      ...this.getLaunchDetails(),
      ...this.getOperationsDetails(),
      ...this.getSpaceCraftDetails(),
      length: this.length,
      diameter: this.diameter,
      source: this.source,
      altId: this.altId,
      altName: this.altName,
      vmag: this.vmag,
      rcs: this.rcs,
      status: this.status,
    };
  }

  // ==================== Orbit Visualization Methods ====================

  /**
   * Calculates ECI positions along the satellite's current orbit.
   *
   * @param startDate - The start date for the orbit calculation.
   * @param points - Number of points to calculate (default: 180).
   * @param orbits - Number of orbits to calculate (default: 1).
   * @returns Array of ECI position vectors.
   * @example
   * ```typescript
   * const orbitPoints = satellite.getOrbitPointsEci(new Date(), 360);
   * orbitPoints.forEach(pt => console.log(`${pt.x}, ${pt.y}, ${pt.z}`));
   * ```
   */
  getOrbitPointsEci(startDate: Date = new Date(), points: number = 180, orbits: number = 1): Vector3D<Kilometers>[] {
    const result: Vector3D<Kilometers>[] = [];
    const periodMs = this.period * 60 * 1000; // Convert to milliseconds

    for (let i = 0; i < points; i++) {
      const offset = (i * periodMs * orbits) / points;
      const date = new Date(startDate.getTime() + offset);
      const pv = this.eci(date);

      if (pv) {
        result.push(new Vector3D(pv.position.x, pv.position.y, pv.position.z));
      }
    }

    return result;
  }

  /**
   * Calculates ECEF positions along the satellite's current orbit.
   *
   * @param startDate - The start date for the orbit calculation.
   * @param points - Number of points to calculate (default: 180).
   * @param orbits - Number of orbits to calculate (default: 1).
   * @returns Array of ECEF position vectors.
   */
  getOrbitPointsEcef(startDate: Date = new Date(), points: number = 180, orbits: number = 1): Vector3D<Kilometers>[] {
    const result: Vector3D<Kilometers>[] = [];
    const periodMs = this.period * 60 * 1000;

    for (let i = 0; i < points; i++) {
      const offset = (i * periodMs * orbits) / points;
      const date = new Date(startDate.getTime() + offset);
      const ecef = this.ecef(date);

      if (ecef) {
        result.push(new Vector3D(ecef.x, ecef.y, ecef.z));
      }
    }

    return result;
  }

  /**
   * Calculates LLA positions along the satellite's current orbit.
   *
   * @param startDate - The start date for the orbit calculation.
   * @param points - Number of points to calculate (default: 180).
   * @param orbits - Number of orbits to calculate (default: 1).
   * @returns Array of LLA positions with timestamps.
   * @example
   * ```typescript
   * const groundTrack = satellite.getOrbitPointsLla(new Date(), 360);
   * groundTrack.forEach(pt => console.log(`${pt.lat}°, ${pt.lon}° at ${pt.time}`));
   * ```
   */
  getOrbitPointsLla(
    startDate: Date = new Date(),
    points: number = 180,
    orbits: number = 1,
  ): { lat: Degrees; lon: Degrees; alt: Kilometers; time: Date }[] {
    const result: { lat: Degrees; lon: Degrees; alt: Kilometers; time: Date }[] = [];
    const periodMs = this.period * 60 * 1000;

    for (let i = 0; i < points; i++) {
      const offset = (i * periodMs * orbits) / points;
      const date = new Date(startDate.getTime() + offset);
      const lla = this.lla(date);

      if (lla) {
        result.push({ ...lla, time: date });
      }
    }

    return result;
  }

  /**
   * Calculates RIC (Radial, In-track, Cross-track) positions relative to another satellite along the orbit.
   *
   * @param reference - The reference satellite for RIC calculations.
   * @param startDate - The start date for the orbit calculation.
   * @param points - Number of points to calculate (default: 180).
   * @param orbits - Number of orbits to calculate (default: 1).
   * @returns Array of RIC state vectors.
   * @example
   * ```typescript
   * const relativeOrbit = sat1.getOrbitPointsRic(sat2, new Date(), 360);
   * relativeOrbit.forEach(ric => console.log(`R: ${ric.position.x}, I: ${ric.position.y}, C: ${ric.position.z}`));
   * ```
   */
  getOrbitPointsRic(reference: Satellite, startDate: Date = new Date(), points: number = 180, orbits: number = 1): RIC[] {
    const result: RIC[] = [];
    const periodMs = this.period * 60 * 1000;

    for (let i = 0; i < points; i++) {
      const offset = (i * periodMs * orbits) / points;
      const date = new Date(startDate.getTime() + offset);

      try {
        const ric = this.toRIC(reference, date);

        result.push(ric);
      } catch {
        // Skip failed propagations
      }
    }

    return result;
  }

  // ==================== Orbital Mechanics Methods ====================

  /**
   * Determines if the satellite is moving northward or southward.
   * @param date - The date at which to calculate the direction.
   * @returns 'N' for northward, 'S' for southward.
   * @throws Error if direction cannot be determined.
   * @example
   * ```typescript
   * const direction = satellite.getDirection(new Date());
   * console.log(`Satellite is moving ${direction === 'N' ? 'North' : 'South'}`);
   * ```
   */
  getDirection(date: Date = new Date()): 'N' | 'S' {
    const FIVE_SECONDS = 5000;

    const currentLla = this.lla(date);

    if (!currentLla) {
      throw new Error('Cannot determine current position');
    }

    const futureDate = new Date(date.getTime() + FIVE_SECONDS);
    const futureLla = this.lla(futureDate);

    if (!futureLla) {
      throw new Error('Cannot determine future position');
    }

    if (currentLla.lat < futureLla.lat) {
      return 'N';
    }
    if (currentLla.lat > futureLla.lat) {
      return 'S';
    }

    // Try 10 seconds if 5 seconds shows no change (near poles)
    const farFutureDate = new Date(date.getTime() + FIVE_SECONDS * 2);
    const farFutureLla = this.lla(farFutureDate);

    if (!farFutureLla) {
      throw new Error('Cannot determine far future position');
    }

    if (currentLla.lat < farFutureLla.lat) {
      return 'N';
    }

    return 'S';
  }

  /**
   * Calculates the nodal precession rate of the satellite's orbit.
   *
   * The nodal precession is caused by Earth's oblateness (J2 effect) and causes
   * the orbital plane to rotate around Earth's axis over time.
   *
   * @returns The nodal precession rate in degrees per day.
   * @example
   * ```typescript
   * const rate = satellite.getNodalPrecessionRate();
   * console.log(`RAAN precesses at ${rate.toFixed(4)} deg/day`);
   * ```
   */
  getNodalPrecessionRate(): DegreesPerDay {
    const Re = 6378137; // Earth radius in meters
    const J2 = 1.082626680e-3; // Earth's J2 coefficient
    const periodSeconds = this.period * 60; // Convert minutes to seconds
    const omega = (2 * Math.PI) / periodSeconds; // Angular velocity in rad/s
    const a = this.semiMajorAxis * 1000; // km to meters
    const e = this.eccentricity;
    const i = this.inclination * DEG2RAD;

    // Calculate precession rate in rad/s
    const omegaP = (-3 / 2) * (Re / a) ** 2 / (1 - e * e) ** 2 * J2 * omega * Math.cos(i);

    // Convert to degrees per day
    return (omegaP * (180 / Math.PI) * 86400) as DegreesPerDay;
  }

  /**
   * Calculates the normalized RAAN (Right Ascension of Ascending Node) accounting for nodal precession.
   *
   * This adjusts the RAAN from the TLE epoch to the specified date by applying
   * the precession rate over the elapsed time.
   *
   * @param date - The date for which to calculate the normalized RAAN.
   * @returns The normalized RAAN in degrees (0-360 range).
   * @example
   * ```typescript
   * const raan = satellite.normalizeRaan(new Date());
   * console.log(`Current RAAN: ${raan.toFixed(2)}°`);
   * ```
   */
  normalizeRaan(date: Date = new Date()): Degrees {
    const precessionRate = this.getNodalPrecessionRate();
    const daysSinceEpoch = this.ageOfElset(date, 'days');
    let normalizedRaan = this.rightAscension + precessionRate * daysSinceEpoch;

    // Ensure RAAN stays within 0-360 range
    normalizedRaan = ((normalizedRaan % 360) + 360) % 360;

    return normalizedRaan as Degrees;
  }

  /**
   * Calculates the angular separation between this satellite and another.
   *
   * Returns the azimuth and elevation angles of the relative position vector
   * in the orbital plane reference frame.
   *
   * @param other - The other satellite.
   * @param date - The date for the calculation.
   * @returns Object containing azimuth and elevation angles in degrees.
   * @throws Error if positions are undefined.
   * @example
   * ```typescript
   * const angle = sat1.angleTo(sat2, new Date());
   * console.log(`Az: ${angle.az.toFixed(2)}°, El: ${angle.el.toFixed(2)}°`);
   * ```
   */
  angleTo(other: Satellite, date: Date = new Date()): { az: Degrees; el: Degrees } {
    const pv1 = this.eci(date);
    const pv2 = other.eci(date);

    if (!pv1 || !pv2) {
      throw new Error('Cannot determine satellite positions');
    }

    const { position: pos1, velocity: vel1 } = pv1;
    const { position: pos2, velocity: vel2 } = pv2;

    // Identical positions
    if (pos1.x === pos2.x && pos1.y === pos2.y && pos1.z === pos2.z) {
      return { az: 0 as Degrees, el: 0 as Degrees };
    }

    const r1 = new Vector3D(pos1.x, pos1.y, pos1.z);
    const r2 = new Vector3D(pos2.x, pos2.y, pos2.z);
    const v1 = new Vector3D(vel1.x, vel1.y, vel1.z);
    const v2 = new Vector3D(vel2.x, vel2.y, vel2.z);

    const r = r1.subtract(r2);
    const v = v1.subtract(v2);
    const rcrossv = r.cross(v);
    const rcrossvmag = rcrossv.magnitude();

    const az = (Math.atan2(rcrossv.y, rcrossv.x) * (180 / Math.PI)) as Degrees;
    const el = (Math.asin(rcrossv.z / rcrossvmag) * (180 / Math.PI)) as Degrees;

    return { az, el };
  }

  /**
   * Calculates the angle between this satellite, another satellite, and the Sun.
   *
   * Returns the angle at this satellite between the vector to the other satellite
   * and the vector to the Sun.
   *
   * @param other - The other satellite.
   * @param sunPosition - The Sun's ECI position vector.
   * @param date - The date for the calculation.
   * @returns The angle in radians.
   * @throws Error if positions are undefined.
   */
  sunAngleTo(other: Satellite, sunPosition: Vector3D<Kilometers>, date: Date = new Date()): Radians {
    const pv1 = this.eci(date);
    const pv2 = other.eci(date);

    if (!pv1 || !pv2) {
      throw new Error('Cannot determine satellite positions');
    }

    const { position: pos1 } = pv1;
    const { position: pos2 } = pv2;

    // Check if positions are identical
    if (pos1.x === pos2.x && pos1.y === pos2.y && pos1.z === pos2.z) {
      return NaN as Radians;
    }

    // Compute vectors from sat2 to sun and sat2 to sat1
    const sat2ToSun = new Vector3D(
      sunPosition.x - pos2.x,
      sunPosition.y - pos2.y,
      sunPosition.z - pos2.z,
    );
    const sat2ToSat1 = new Vector3D(pos1.x - pos2.x, pos1.y - pos2.y, pos1.z - pos2.z);

    return sat2ToSun.angle(sat2ToSat1);
  }

  // ==================== Sun/Eclipse Methods ====================

  /**
   * Determines the illumination status of the satellite (sunlit, penumbra, or umbra).
   *
   * Uses the Sun's lighting ratio to determine if the satellite is in Earth's shadow.
   *
   * @param date - The date for the calculation.
   * @returns The sun status (UMBRAL, PENUMBRAL, SUN, or UNKNOWN).
   * @example
   * ```typescript
   * const status = satellite.getSunStatus(new Date());
   * if (status === SunStatus.SUN) {
   *   console.log('Satellite is sunlit');
   * } else if (status === SunStatus.UMBRAL) {
   *   console.log('Satellite is in full eclipse');
   * }
   * ```
   */
  getSunStatus(date: Date = new Date()): SunStatus {
    const pv = this.eci(date);

    if (!pv) {
      return SunStatus.UNKNOWN;
    }

    const satPos = new Vector3D<Kilometers>(pv.position.x, pv.position.y, pv.position.z);

    const sunPos = Sun.eci(date);
    const ratio = Sun.lightingRatio(satPos, sunPos);

    if (ratio === 0) {
      return SunStatus.UMBRAL;
    }
    if (ratio < 1) {
      return SunStatus.PENUMBRAL;
    }

    return SunStatus.SUN;
  }

  // ==================== Conjunction/Proximity Methods ====================

  /**
   * Result of closest approach calculation.
   */
  /**
   * Finds the closest approach between this satellite and another within a search window.
   *
   * Searches through the specified duration to find the minimum distance between
   * the two satellites using RIC (Radial, In-track, Cross-track) coordinates.
   *
   * @param other - The other satellite.
   * @param startDate - The start date for the search.
   * @param duration - Search duration in seconds (default: 86400 = 1 day).
   * @param stepSize - Time step in seconds (default: 1).
   * @returns Object containing offset, distance, RIC state, and date of closest approach.
   * @throws Error if no valid approach found.
   * @example
   * ```typescript
   * const result = sat1.findClosestApproach(sat2, new Date(), 86400);
   * console.log(`Closest: ${result.distance.toFixed(2)} km at ${result.date}`);
   * console.log(`RIC: R=${result.ric.position.x}, I=${result.ric.position.y}, C=${result.ric.position.z}`);
   * ```
   */
  findClosestApproach(
    other: Satellite,
    startDate: Date = new Date(),
    duration: number = 86400,
    stepSize: number = 1,
  ): { offset: number; distance: Kilometers; ric: RIC; date: Date } {
    let minDist = Infinity;
    let result: { offset: number; distance: Kilometers; ric: RIC; date: Date } | null = null;

    for (let t = 0; t < duration; t += stepSize) {
      const offset = t * 1000;
      const date = new Date(startDate.getTime() + offset);

      try {
        const ric = this.toRIC(other, date);
        const dist = ric.range;

        if (dist < minDist && dist > 0) {
          minDist = dist;
          result = {
            offset,
            distance: dist,
            ric,
            date,
          };
        }
      } catch {
        // Skip failed propagations
      }
    }

    if (!result) {
      throw new Error('No closest approach found in the search window');
    }

    return result;
  }

  // ==================== Propagator Factory Methods ====================

  /**
   * Creates a Propagator instance initialized from this satellite's state at the given date.
   *
   * Returns a fully-featured Propagator with the complete API including propagate(),
   * ephemeris(), maneuver(), checkpoint/restore, and orbital event finding.
   *
   * @param date - The date to initialize the propagator state. Defaults to current date.
   * @param options - Propagator configuration options.
   * @returns A Propagator instance.
   * @example
   * ```typescript
   * // Quick default (RK89 with point-mass gravity)
   * const prop = satellite.createPropagator();
   * const futureState = prop.propagate(futureEpoch);
   *
   * // Full customization
   * const forceModel = new ForceModel()
   *   .setGravity()
   *   .setThirdBodyGravity({ moon: true, sun: true });
   *
   * const prop = satellite.createPropagator(new Date(), {
   *   type: PropagatorType.DP54,
   *   forceModel,
   *   tolerance: 1e-12,
   * });
   *
   * const ephemeris = prop.ephemeris(start, stop, 60 as Seconds);
   * ```
   */
  createPropagator(date: Date = new Date(), options?: NumericalPropagatorOptions): Propagator {
    const type = options?.type ?? PropagatorType.RK89;

    switch (type) {
      case PropagatorType.SGP4:
        return new Sgp4Propagator(this.toTle());

      case PropagatorType.KEPLER: {
        const elements = this.toClassicalElements(date);

        return new KeplerPropagator(elements);
      }

      case PropagatorType.RK4: {
        const initState = this.toJ2000(date);
        const forceModel = options?.forceModel ?? new ForceModel().setGravity();
        const stepSize = options?.stepSize ?? 15.0;

        return new RungeKutta4Propagator(initState, forceModel, stepSize);
      }

      case PropagatorType.DP54: {
        const initState = this.toJ2000(date);
        const forceModel = options?.forceModel ?? new ForceModel().setGravity();
        const tolerance = options?.tolerance ?? 1e-9;

        return new DormandPrince54Propagator(initState, forceModel, tolerance);
      }

      case PropagatorType.RK89: {
        const initState = this.toJ2000(date);
        const forceModel = options?.forceModel ?? new ForceModel().setGravity();
        const tolerance = options?.tolerance ?? 1e-9;

        return new RungeKutta89Propagator(initState, forceModel, tolerance);
      }

      default:
        throw new Error(`Unknown propagator type: ${type as string}`);
    }
  }

  /**
   * Creates an Sgp4Propagator from this satellite's TLE.
   *
   * @returns An Sgp4Propagator instance.
   * @example
   * ```typescript
   * const prop = satellite.createSgp4Propagator();
   * const state = prop.propagate(futureEpoch);
   * ```
   */
  createSgp4Propagator(): Sgp4Propagator {
    return new Sgp4Propagator(this.toTle());
  }

  /**
   * Creates a high-accuracy numerical propagator (RK89) from this satellite's state.
   *
   * For other propagator types or RK4, use `createPropagator()` with options.
   *
   * @param date - The date to initialize the propagator state. Defaults to current date.
   * @param forceModel - The force model. Defaults to point-mass gravity.
   * @param tolerance - Adaptive step tolerance. Defaults to 1e-9.
   * @returns A RungeKutta89Propagator instance.
   * @example
   * ```typescript
   * const fm = new ForceModel()
   *   .setGravity()
   *   .setThirdBodyGravity({ moon: true, sun: true })
   *   .setSolarRadiationPressure(500, 10, 1.2);
   *
   * const prop = satellite.createNumericalPropagator(new Date(), fm);
   * const state = prop.propagate(futureEpoch);
   * ```
   */
  createNumericalPropagator(
    date: Date = new Date(),
    forceModel: ForceModel = new ForceModel().setGravity(),
    tolerance: number = 1e-9,
  ): RungeKutta89Propagator {
    const initState = this.toJ2000(date);

    return new RungeKutta89Propagator(initState, forceModel, tolerance);
  }

  // ==================== Private Helpers ====================

  /**
   * Calculates the time variables for a given date relative to the TLE epoch.
   * @param date Date to calculate
   * @param satrec Satellite orbital information
   * @param j Julian date
   * @param gmst Greenwich Mean Sidereal Time
   * @returns Time variables
   */
  private static calculateTimeVariables_(
    date: Date,
    satrec?: SatelliteRecord,
    j?: number,
    gmst?: GreenwichMeanSiderealTime,
  ) {
    if (typeof j !== 'number') {
      // Sweeping a whole catalog at one instant is the dominant call pattern,
      // so memoize the date-only work (jday + gstime) for the last date seen.
      const ms = date.getTime();

      if (Satellite.timeVariablesCacheMs_ !== ms) {
        const jNew =
          jday(
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
          ) +
          date.getUTCMilliseconds() * MILLISECONDS_TO_DAYS;

        Satellite.timeVariablesCacheMs_ = ms;
        Satellite.timeVariablesCacheJ_ = jNew;
        Satellite.timeVariablesCacheGmst_ = Sgp4.gstime(jNew);
      }
      j = Satellite.timeVariablesCacheJ_;
      gmst ??= Satellite.timeVariablesCacheGmst_;
    }
    gmst ??= Sgp4.gstime(j);

    const m = satrec ? (j - satrec.jdsatepoch) * MINUTES_PER_DAY : null;

    return { gmst, m, j };
  }

  /** Single-entry memo for calculateTimeVariables_, keyed on Date.getTime() */
  private static timeVariablesCacheMs_: number | null = null;
  private static timeVariablesCacheJ_ = 0;
  private static timeVariablesCacheGmst_ = 0 as GreenwichMeanSiderealTime;
}
