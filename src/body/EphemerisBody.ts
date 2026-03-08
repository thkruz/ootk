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
import { LagrangeInterpolator } from '../interpolator/LagrangeInterpolator';
import { StateInterpolator } from '../interpolator/StateInterpolator';
import { CubicSplineInterpolator } from '../interpolator/CubicSplineInterpolator';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { Kilometers, KilometersPerSecond, SpaceObjectType } from '../types/types';
import { CelestialBody, CelestialBodyParams } from './CelestialBody';
import { CelestialBodyType } from './CelestialBodyType';

/**
 * Ephemeris data point for a celestial body.
 */
export interface EphemerisDataPoint {
  /** Epoch for this state */
  epoch: EpochUTC;
  /** Position in J2000 heliocentric or geocentric coordinates (km) */
  position: Vector3D<Kilometers>;
  /** Velocity (km/s), optional */
  velocity?: Vector3D<KilometersPerSecond>;
}

/**
 * Interpolation method for ephemeris data.
 */
export type EphemerisInterpolationType = 'lagrange' | 'spline';

/**
 * Parameters for constructing an EphemerisBody.
 */
export interface EphemerisBodyParams extends Omit<CelestialBodyParams, 'astronomyBody'> {
  /** Array of ephemeris data points */
  ephemeris: EphemerisDataPoint[];
  /** Whether positions are heliocentric (true) or geocentric (false, default) */
  isHeliocentric?: boolean;
  /** Interpolation method (default: lagrange) */
  interpolationType?: EphemerisInterpolationType;
  /** Interpolation order for Lagrange (default: 8) */
  interpolationOrder?: number;
}

/**
 * A celestial body with position determined by interpolation of ephemeris data.
 *
 * EphemerisBody is used for objects that don't have analytical position models
 * in astronomy-engine, such as:
 * - Dwarf planets (Ceres, Makemake, Haumea, Eris)
 * - Asteroids
 * - Comets
 * - Any object with NASA Horizons ephemeris data
 *
 * @example
 * ```typescript
 * // Create from Horizons data
 * const ephemerisData = HorizonsParser.parse(horizonsOutput);
 * const ceres = new EphemerisBody({
 *   id: 'ceres',
 *   name: 'Ceres',
 *   bodyType: CelestialBodyType.DWARF_PLANET,
 *   ephemeris: ephemerisData,
 *   isHeliocentric: true,
 * });
 *
 * // Get position at specific time
 * const pos = ceres.heliocentric(new Date('2025-06-15T12:00:00Z'));
 * ```
 */
export class EphemerisBody extends CelestialBody {
  private readonly interpolator_: StateInterpolator;
  private readonly ephemeris_: EphemerisDataPoint[];
  private readonly isHeliocentric_: boolean;
  private readonly validityStart_: Date;
  private readonly validityEnd_: Date;

  constructor(params: EphemerisBodyParams) {
    if (!params.ephemeris || params.ephemeris.length === 0) {
      throw new Error('Ephemeris array cannot be empty');
    }

    // Determine SpaceObjectType from CelestialBodyType
    let spaceObjectType = SpaceObjectType.UNKNOWN;

    switch (params.bodyType) {
      case CelestialBodyType.DWARF_PLANET:
        spaceObjectType = SpaceObjectType.DWARF_PLANET;
        break;
      case CelestialBodyType.ASTEROID:
        spaceObjectType = SpaceObjectType.UNKNOWN; // No specific type for asteroids yet
        break;
      case CelestialBodyType.COMET:
        spaceObjectType = SpaceObjectType.UNKNOWN; // No specific type for comets yet
        break;
      default:
        spaceObjectType = SpaceObjectType.UNKNOWN;
    }

    super({
      ...params,
      type: spaceObjectType,
    });

    this.ephemeris_ = params.ephemeris;
    this.isHeliocentric_ = params.isHeliocentric ?? false;

    // Sort ephemeris by time
    this.ephemeris_.sort((a, b) => a.epoch.toDateTime().getTime() - b.epoch.toDateTime().getTime());

    // Set validity window
    this.validityStart_ = this.ephemeris_[0].epoch.toDateTime();
    this.validityEnd_ = this.ephemeris_[this.ephemeris_.length - 1].epoch.toDateTime();

    // Create interpolator
    this.interpolator_ = this.createInterpolator_(
      params.interpolationType ?? 'lagrange',
      params.interpolationOrder ?? 8,
    );
  }

  // ==================== Validity Methods ====================

  /**
   * Checks if a given time is within the ephemeris validity window.
   * @param date - The date to check
   * @returns True if the time is within the validity window
   */
  isValidAt(date: Date): boolean {
    return date >= this.validityStart_ && date <= this.validityEnd_;
  }

  /**
   * Gets the validity window for this ephemeris.
   * @returns Start and end dates of the validity window
   */
  getValidityWindow(): { start: Date; end: Date } {
    return {
      start: this.validityStart_,
      end: this.validityEnd_,
    };
  }

  /**
   * Validates that a time is within the ephemeris validity window.
   * @param date - The date to validate
   * @throws Error if the time is outside the validity window
   */
  private validateTime_(date: Date): void {
    if (!this.isValidAt(date)) {
      throw new Error(
        `Time ${date.toISOString()} outside ephemeris validity ` +
        `[${this.validityStart_.toISOString()}, ${this.validityEnd_.toISOString()}]`,
      );
    }
  }

  // ==================== Position Methods ====================

  /**
   * Gets the body's position in Earth-Centered Inertial (J2000) coordinates.
   * @param date - The date/time for the position calculation
   * @returns Position vector in kilometers
   */
  eci(date: Date = new Date()): Vector3D<Kilometers> {
    this.validateTime_(date);

    if (this.isHeliocentric_) {
      // Convert heliocentric to geocentric by subtracting Earth's position
      // This is a simplified conversion - for high precision, use proper transforms
      throw new Error('Heliocentric to geocentric conversion not yet implemented');
    }

    const epoch = EpochUTC.fromDateTime(date);
    const state = this.interpolator_.interpolate(epoch);

    if (!state) {
      throw new Error(`Failed to interpolate position at ${date.toISOString()}`);
    }

    return new Vector3D(
      state.position.x as Kilometers,
      state.position.y as Kilometers,
      state.position.z as Kilometers,
    );
  }

  /**
   * Gets the body's position in heliocentric coordinates.
   * @param date - The date/time for the position calculation
   * @returns Position vector in kilometers (Sun-centered)
   */
  heliocentric(date: Date = new Date()): Vector3D<Kilometers> {
    this.validateTime_(date);

    if (!this.isHeliocentric_) {
      // Convert geocentric to heliocentric by adding Sun's geocentric position
      // This is a simplified conversion
      throw new Error('Geocentric to heliocentric conversion not yet implemented');
    }

    const epoch = EpochUTC.fromDateTime(date);
    const state = this.interpolator_.interpolate(epoch);

    if (!state) {
      throw new Error(`Failed to interpolate position at ${date.toISOString()}`);
    }

    return new Vector3D(
      state.position.x as Kilometers,
      state.position.y as Kilometers,
      state.position.z as Kilometers,
    );
  }

  /**
   * Gets the body's velocity if available.
   * @param date - The date/time for the velocity calculation
   * @returns Velocity vector in km/s, or null if not available
   */
  velocity(date: Date = new Date()): Vector3D<KilometersPerSecond> | null {
    this.validateTime_(date);

    // Check if velocity data is available
    if (!this.ephemeris_[0].velocity) {
      return null;
    }

    const epoch = EpochUTC.fromDateTime(date);
    const state = this.interpolator_.interpolate(epoch);

    if (!state) {
      return null;
    }

    return new Vector3D(
      state.velocity.x as KilometersPerSecond,
      state.velocity.y as KilometersPerSecond,
      state.velocity.z as KilometersPerSecond,
    );
  }

  // ==================== Factory Methods ====================

  /**
   * Creates an EphemerisBody from an array of position/velocity data.
   * @param id - Unique identifier
   * @param name - Display name
   * @param bodyType - Type of celestial body
   * @param data - Array of { date, position, velocity? } objects
   * @param options - Additional options
   */
  static fromData(
    id: number,
    name: string,
    bodyType: CelestialBodyType,
    data: Array<{
      date: Date;
      position: { x: number; y: number; z: number };
      velocity?: { x: number; y: number; z: number };
    }>,
    options?: {
      isHeliocentric?: boolean;
      mu?: number;
      radius?: Kilometers;
      interpolationType?: EphemerisInterpolationType;
      interpolationOrder?: number;
    },
  ): EphemerisBody {
    const ephemeris: EphemerisDataPoint[] = data.map((d) => ({
      epoch: EpochUTC.fromDateTime(d.date),
      position: new Vector3D(d.position.x as Kilometers, d.position.y as Kilometers, d.position.z as Kilometers),
      velocity: d.velocity
        ? new Vector3D(
          d.velocity.x as KilometersPerSecond,
          d.velocity.y as KilometersPerSecond,
          d.velocity.z as KilometersPerSecond,
        )
        : undefined,
    }));

    return new EphemerisBody({
      id,
      name,
      bodyType,
      ephemeris,
      isHeliocentric: options?.isHeliocentric,
      mu: options?.mu,
      radius: options?.radius,
      interpolationType: options?.interpolationType,
      interpolationOrder: options?.interpolationOrder,
    });
  }

  // ==================== Private Methods ====================

  /**
   * Creates the appropriate interpolator for the ephemeris data.
   */
  private createInterpolator_(
    type: EphemerisInterpolationType,
    order: number,
  ): StateInterpolator {
    // Convert ephemeris to J2000 states for the interpolator
    const j2000States = this.ephemeris_.map((ep) => {
      const velocity = ep.velocity ?? new Vector3D(
        0 as KilometersPerSecond,
        0 as KilometersPerSecond,
        0 as KilometersPerSecond,
      );

      return new J2000(ep.epoch, ep.position, velocity);
    });

    switch (type) {
      case 'spline':
        return CubicSplineInterpolator.fromEphemeris(j2000States);
      case 'lagrange':
      default:
        return LagrangeInterpolator.fromEphemeris(j2000States, order);
    }
  }

  // ==================== Serialization ====================

  protected override serializeSpecific(): Record<string, unknown> {
    return {
      ...super.serializeSpecific(),
      isHeliocentric: this.isHeliocentric_,
      validityStart: this.validityStart_.toISOString(),
      validityEnd: this.validityEnd_.toISOString(),
      ephemerisCount: this.ephemeris_.length,
    };
  }
}
