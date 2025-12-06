/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
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

import { FormatTle } from '../coordinate/FormatTle';
import { Geodetic } from '../coordinate/Geodetic';
import type { ClassicalElements } from '../coordinate/index';
import { ITRF } from '../coordinate/ITRF';
import { J2000 } from '../coordinate/J2000';
import { RIC } from '../coordinate/RIC';
import { Tle } from '../coordinate/Tle';
import { CatalogSource } from '../enums/CatalogSource';
import { OmmDataFormat, OmmParsedDataFormat } from '../interfaces/OmmFormat';
import { OptionsParams } from '../interfaces/OptionsParams';
import { SatelliteParams } from '../interfaces/SatelliteParams';
import { Sgp4 } from '../main';
import { RAE } from '../observation/RAE';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { ecef2rae, eci2ecef, eci2lla, jday } from '../transforms/index';
import {
  Degrees,
  EcefVec3,
  GreenwichMeanSiderealTime,
  Kilometers,
  LaunchDetails,
  LlaVec3,
  Minutes,
  OperationsDetails,
  PayloadStatus,
  PosVel,
  Radians,
  RaeVec3,
  SatelliteRecord,
  Seconds,
  SpaceCraftDetails,
  TleLine1,
  TleLine2,
} from '../types/types';
import { DEG2RAD, MILLISECONDS_TO_DAYS, MINUTES_PER_DAY, RAD2DEG } from '../utils/constants';
import { dopplerFactor } from './../utils/functions';
import { GroundObject } from './GroundObject';
import { SpaceObject } from './SpaceObject';

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
  /** The satellite catalog number as listed in the TLE. */
  sccNum!: string;
  /** The 5 digit alpha-numeric satellite catalog number. */
  sccNum5!: string;
  /** The 6 digit numeric satellite catalog number. */
  sccNum6!: string;
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

  // ==================== TLE/OMM Parsing ====================

  private parseTleAndUpdateOrbit_(tle1: TleLine1, tle2: TleLine2, sccNum?: string) {
    const tleData = Tle.parse(tle1, tle2);

    this.tle1 = tle1;
    this.tle2 = tle2;

    this.sccNum = sccNum ?? tleData.satNum.toString();
    this.sccNum5 = Tle.convert6DigitToA5(this.sccNum);
    this.sccNum6 = Tle.convertA5to6Digit(this.sccNum5);
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
    this.sccNum = omm.NORAD_CAT_ID.padStart(5, '0');
    this.sccNum5 = Tle.convert6DigitToA5(omm.NORAD_CAT_ID);
    this.sccNum6 = Tle.convertA5to6Digit(this.sccNum5);
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
    this.meanMoDev1 = parseFloat(omm.MEAN_MOTION_DOT);
    this.meanMoDev2 = parseFloat(omm.MEAN_MOTION_DDOT);
    this.bstar = parseFloat(omm.BSTAR);
    this.inclination = parseFloat(omm.INCLINATION) as Degrees;
    this.rightAscension = parseFloat(omm.RA_OF_ASC_NODE) as Degrees;
    this.eccentricity = parseFloat(omm.ECCENTRICITY);
    this.argOfPerigee = parseFloat(omm.ARG_OF_PERICENTER) as Degrees;
    this.meanAnomaly = parseFloat(omm.MEAN_ANOMALY) as Degrees;
    this.meanMotion = parseFloat(omm.MEAN_MOTION);
    this.period = (1440 / this.meanMotion) as Minutes;
    this.semiMajorAxis = ((8681663.653 / this.meanMotion) ** (2 / 3)) as Kilometers;
    this.semiMinorAxis = (this.semiMajorAxis * Math.sqrt(1 - this.eccentricity ** 2)) as Kilometers;
    this.apogee = (this.semiMajorAxis * (1 + this.eccentricity) - 6371) as Kilometers;
    this.perigee = (this.semiMajorAxis * (1 - this.eccentricity) - 6371) as Kilometers;
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
  az(observer: GroundObject, date: Date = new Date()): Degrees | null {
    const rae = this.rae(observer, date);

    if (!rae) {
      return null;
    }

    return (rae.az * RAD2DEG) as Degrees;
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
   * Calculates ECEF position at a given time.
   * @variation optimized
   * @param date - The date at which to calculate the ECEF position. Optional, defaults to the current date.
   * @returns The ECEF position at the specified date.
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
   * Calculates ECI position at a given time.
   * @variation optimized
   * @param date - The date at which to calculate the ECI position. Optional, defaults to the current date.
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
   * // Get current position
   * const pv = satellite.eci();
   * if (pv) {
   *   console.log(`Position: ${pv.position.x.toFixed(2)}, ${pv.position.y.toFixed(2)}, ${pv.position.z.toFixed(2)} km`);
   *   console.log(`Velocity: ${pv.velocity.x.toFixed(4)} km/s`);
   * }
   *
   * // Get position at specific time
   * const futurePos = satellite.eci(new Date('2024-06-15T12:00:00Z'));
   * ```
   * @returns The ECI position at the specified date.
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
   * Calculates the J2000 coordinates for a given date. If no date is provided, the current time is used.
   * @variation expanded
   * @param date - The date for which to calculate the J2000 coordinates, defaults to the current date.
   * @returns The J2000 coordinates for the specified date.
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

    return new J2000(epoch, pos, vel);
  }

  /**
   * Returns the elevation angle of the satellite as seen by the given sensor at the specified time.
   * @variation optimized
   * @param observer - The observer's position on the ground.
   * @param date - The date at which to calculate the elevation angle. Optional, defaults to the current date.
   * @returns The elevation angle of the satellite as seen by the given sensor at the specified time.
   */
  el(observer: GroundObject, date: Date = new Date()): Degrees | null {
    const rae = this.rae(observer, date);

    if (!rae) {
      return null;
    }

    return (rae.el * RAD2DEG) as Degrees;
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
   * Converts the satellite's position to the International Terrestrial Reference Frame (ITRF) at the specified date.
   * If no date is provided, the current date is used.
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
  rae(observer: GroundObject, date?: Date, j?: number, gmst?: GreenwichMeanSiderealTime): RaeVec3<Kilometers, Degrees> | null {
    date ??= new Date();
    gmst ??= Satellite.calculateTimeVariables_(date, this.satrec).gmst;
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
  rng(observer: GroundObject, date: Date = new Date()): Kilometers | null {
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
   */
  override clone(): Satellite {
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
      },
      { ...this.options },
    );

    cloned.id = this.id;
    cloned.active = this.active;
    cloned.metadata = this.metadata ? { ...this.metadata } : undefined;
    cloned.sensors = [...this.sensors];
    cloned.commDevices = [...this.commDevices];

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
    j ??=
      jday(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      ) +
      date.getUTCMilliseconds() * MILLISECONDS_TO_DAYS;
    gmst ??= Sgp4.gstime(j);

    const m = satrec ? (j - satrec.jdsatepoch) * MINUTES_PER_DAY : null;

    return { gmst, m, j };
  }
}
