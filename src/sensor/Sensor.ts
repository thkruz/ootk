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
import { PassType } from '../enums/PassType';
import { SensorType } from '../enums/SensorType';
import { ValidationError } from '../errors';
import type { GroundObject } from '../objects/GroundObject';
import type { Satellite } from '../objects/Satellite';
import type { SpaceObject } from '../objects/SpaceObject';
import { Degrees, Kilometers, Lookangle, Milliseconds, RaeVec3 } from '../types/types';
import { FieldOfView, FieldOfViewParams } from './FieldOfView';

/**
 * Union type representing valid sensor platforms.
 * Sensors can be mounted on ground objects (stations) or space objects (satellites).
 */
export type SensorPlatform = GroundObject | SpaceObject;

/**
 * Parameters for constructing a Sensor.
 */
export interface SensorParams {
  /** Unique identifier for the sensor */
  id: number;
  /** Human-readable name */
  name: string;
  /** Type of sensor */
  sensorType: SensorType;
  /** Field of view constraints */
  fieldOfView: FieldOfViewParams;
  /** Short name or abbreviation */
  shortName?: string;
  /** Sensor system identifier */
  system?: string;
  /** Country of operation */
  country?: string;
  /** Operating organization */
  operator?: string;
  /** Dwell time for target acquisition */
  dwellTime?: Milliseconds;
  /** Frequency band (for RF sensors) */
  freqBand?: string;
  /** Whether sensor is volumetric */
  isVolumetric?: boolean;
  /** URL for more information */
  url?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Serialized representation of a sensor.
 */
export interface SerializedSensor {
  id: number;
  name: string;
  sensorType: SensorType;
  fieldOfView: ReturnType<FieldOfView['serialize']>;
  shortName?: string;
  system?: string;
  country?: string;
  operator?: string;
  dwellTime?: Milliseconds;
  freqBand?: string;
  isVolumetric?: boolean;
  url?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Abstract base class for all sensor types.
 *
 * Sensors are components that attach to platforms (ground stations or satellites)
 * rather than being location-based objects themselves. Position is delegated to
 * the parent platform.
 *
 * @example
 * ```typescript
 * // Create a sensor attached to a ground station
 * const radar = new PhasedArrayRadar({
 *   id: 'eglin-radar',
 *   name: 'Eglin SSPARS',
 *   sensorType: SensorType.PHASED_ARRAY_RADAR,
 *   fieldOfView: { ... },
 * });
 *
 * groundStation.addSensor(radar);
 * radar.setParent(groundStation);
 *
 * // Check if satellite is in FOV
 * if (radar.canObserve(satellite)) {
 *   const observation = radar.observe(satellite);
 * }
 * ```
 */
export abstract class Sensor {
  /** Unique identifier */
  readonly id: number;
  /** Human-readable name */
  name: string;
  /** Type of sensor */
  readonly sensorType: SensorType;
  /** Field of view constraints */
  fieldOfView: FieldOfView;

  // Metadata (from DetailedSensor)
  /** Short name or abbreviation */
  shortName?: string;
  /** Sensor system identifier */
  system?: string;
  /** Country of operation */
  country?: string;
  /** Operating organization */
  operator?: string;
  /** Dwell time for target acquisition */
  dwellTime?: Milliseconds;
  /** Frequency band (for RF sensors) */
  freqBand?: string;
  /** Whether sensor is volumetric */
  isVolumetric?: boolean;
  /** URL for more information */
  url?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Parent platform this sensor is attached to */
  private parent_?: SensorPlatform;

  constructor(params: SensorParams) {
    this.id = params.id;
    this.name = params.name;
    this.sensorType = params.sensorType;
    this.fieldOfView = new FieldOfView(params.fieldOfView);

    // Copy metadata
    this.shortName = params.shortName;
    this.system = params.system;
    this.country = params.country;
    this.operator = params.operator;
    this.dwellTime = params.dwellTime;
    this.freqBand = params.freqBand;
    this.isVolumetric = params.isVolumetric;
    this.url = params.url;
    this.metadata = params.metadata;
  }

  // ==================== Platform Reference ====================

  /**
   * Gets the parent platform this sensor is attached to.
   * @throws {ValidationError} If sensor has no parent assigned
   */
  get parent(): SensorPlatform {
    if (!this.parent_) {
      throw new ValidationError(
        `Sensor "${this.name}" has no parent platform assigned. Call setParent() first.`,
        'parent',
        undefined,
      );
    }

    return this.parent_;
  }

  /**
   * Sets the parent platform for this sensor.
   * @param platform - The ground object or space object to attach to
   */
  setParent(platform: SensorPlatform): void {
    this.parent_ = platform;
  }

  /**
   * Checks if this sensor has a parent platform assigned.
   */
  hasParent(): boolean {
    return this.parent_ !== undefined;
  }

  /**
   * Validates that this sensor has a parent platform.
   * Call at the start of methods that require a parent.
   * @param methodName - Name of the calling method (for error context)
   * @throws {ValidationError} If no parent is assigned
   */
  protected requireParent(methodName: string): SensorPlatform {
    if (!this.parent_) {
      throw new ValidationError(
        `Cannot call ${methodName}() on sensor "${this.name}" without a parent platform. Call setParent() first.`,
        'parent',
        undefined,
      );
    }

    return this.parent_;
  }

  // ==================== Position Methods ====================

  /**
   * Gets the sensor's position in J2000 coordinates.
   * Delegates to the parent platform.
   * @param date - Time for position calculation (defaults to now)
   * @returns J2000 state vector
   * @throws {ValidationError} If sensor has no parent platform assigned
   */
  getJ2000(date: Date = new Date()): J2000 {
    const parent = this.requireParent('getJ2000');

    return parent.toJ2000(date);
  }

  // ==================== FOV Methods ====================

  /**
   * Checks if RAE coordinates are within the sensor's field of view.
   * @param rae - Range, azimuth, elevation coordinates
   * @returns True if within FOV
   */
  isInFov(rae: RaeVec3<Kilometers, Degrees>): boolean {
    return this.fieldOfView.contains(rae);
  }

  /**
   * Checks if a target can be observed by this sensor at the given time.
   * @param target - The space object to check
   * @param date - Time for the calculation (defaults to now)
   * @returns True if target is in FOV
   */
  canObserve(target: SpaceObject, date: Date = new Date()): boolean {
    const rae = this.getRae(target, date);

    if (!rae) {
      return false;
    }

    return this.isInFov(rae);
  }

  /**
   * Gets the RAE (Range, Azimuth, Elevation) of a target relative to this sensor.
   * @param target - The space object to observe
   * @param date - Time for the calculation (defaults to now)
   * @returns RAE coordinates or null if calculation fails
   * @throws {ValidationError} If sensor has no parent platform assigned
   */
  getRae(target: SpaceObject, date: Date = new Date()): RaeVec3<Kilometers, Degrees> | null {
    const parent = this.requireParent('getRae');

    // Use Satellite's rae method if parent is a GroundObject
    if ('lat' in parent && 'rae' in target) {
      return (target as Satellite).rae(parent as GroundObject, date);
    }

    // For space-based sensors, would need different calculation
    // This will be implemented in the space-based sensor phase
    return null;
  }

  // ==================== Pass Calculation ====================

  /**
   * Calculates satellite passes over a planning interval.
   * Identifies when a satellite enters and exits the sensor's FOV.
   *
   * @param target - The satellite to track
   * @param planningInterval - Duration in seconds to plan
   * @param date - Start time (defaults to now)
   * @example
   * ```typescript
   * import { Sensor, Satellite, GroundObject, FieldOfView, PassType, Degrees, Kilometers } from 'ootk';
   *
   * // Create ground station with sensor
   * const station = new GroundObject({
   *   lat: 40.0 as Degrees,
   *   lon: -75.0 as Degrees,
   *   alt: 0.1 as Kilometers,
   * });
   *
   * const sensor = new Sensor({
   *   id: 'radar-1',
   *   name: 'Tracking Radar',
   *   fov: new FieldOfView({
   *     boresightEl: 45 as Degrees,
   *     halfAngle: 30 as Degrees,
   *     maxRange: 5000 as Kilometers,
   *   }),
   * });
   * sensor.setParent(station);
   *
   * // Find all passes in next 24 hours (86400 seconds)
   * const passes = sensor.calculatePasses(satellite, 86400);
   *
   * // Process pass events
   * passes.forEach(event => {
   *   if (event.type === PassType.ENTER) {
   *     console.log(`Pass starts at ${event.time.toISOString()}`);
   *     console.log(`  AOS Az/El: ${event.az.toFixed(1)}° / ${event.el.toFixed(1)}°`);
   *   } else if (event.type === PassType.EXIT) {
   *     console.log(`Pass ends at ${event.time.toISOString()}`);
   *     console.log(`  Max elevation: ${event.maxElPass?.toFixed(1)}°`);
   *   }
   * });
   * ```
   * @returns Array of lookangle events (ENTER/EXIT with RAE data)
   * @throws {ValidationError} If sensor has no parent platform assigned
   */
  calculatePasses(
    target: Satellite,
    planningInterval: number,
    date: Date = new Date(),
  ): Lookangle[] {
    let isInViewLast = false;
    let maxElThisPass = 0 as Degrees;
    const passes: Lookangle[] = [];
    const startTime = date.getTime();

    for (let timeOffset = 0; timeOffset < planningInterval; timeOffset++) {
      const curTime = new Date(startTime + timeOffset * 1000);
      const rae = this.getRae(target, curTime);

      if (!rae) {
        continue;
      }

      const isInView = this.isInFov(rae);

      // Check previous visibility on first iteration
      if (timeOffset === 0) {
        const oldRae = this.getRae(target, new Date(date.getTime() - 1000));

        if (oldRae) {
          isInViewLast = this.isInFov(oldRae);
        }
      }

      const type = Sensor.getPassType_(isInView, isInViewLast);

      maxElThisPass = Math.max(maxElThisPass, rae.el) as Degrees;

      if (type === PassType.ENTER || type === PassType.EXIT) {
        const pass: Lookangle = {
          type,
          time: curTime,
          az: rae.az,
          el: rae.el,
          rng: rae.rng,
        };

        // Only set maxEl for EXIT passes
        if (type === PassType.EXIT) {
          pass.maxElPass = maxElThisPass;
        }

        passes.push(pass);
        maxElThisPass = 0 as Degrees;
      }

      isInViewLast = isInView;
    }

    return passes;
  }

  // ==================== Abstract Methods ====================

  /**
   * Creates an observation of a target space object.
   * Each sensor type implements this to return the appropriate observation type.
   * @param target - The space object to observe
   * @param date - Time of observation (defaults to now)
   * @returns Observation data or null if observation not possible
   */
  abstract observe(target: SpaceObject, date?: Date): unknown | null;

  /**
   * Creates a deep copy of this sensor.
   * The cloned sensor will not have a parent assigned.
   * @returns A new Sensor instance with the same properties
   */
  abstract clone(): Sensor;

  // ==================== Convenience Methods ====================

  /**
   * Checks if this sensor is configured for deep space observation.
   */
  isDeepSpace(): boolean {
    return this.fieldOfView.isDeepSpace();
  }

  /**
   * Checks if this sensor is configured for near-Earth observation.
   */
  isNearEarth(): boolean {
    return this.fieldOfView.isNearEarth();
  }

  // ==================== Serialization ====================

  /**
   * Creates a serializable representation of this sensor.
   */
  serialize(): SerializedSensor {
    const base: SerializedSensor = {
      id: this.id,
      name: this.name,
      sensorType: this.sensorType,
      fieldOfView: this.fieldOfView.serialize(),
      shortName: this.shortName,
      system: this.system,
      country: this.country,
      operator: this.operator,
      dwellTime: this.dwellTime,
      freqBand: this.freqBand,
      isVolumetric: this.isVolumetric,
      url: this.url,
      metadata: this.metadata,
    };

    // Add sensor-specific data
    const specific = this.serializeSpecific();

    return { ...base, ...specific };
  }

  /**
   * Returns sensor-type-specific serialization data.
   * Override in subclasses to add additional fields.
   */
  protected serializeSpecific(): Record<string, unknown> {
    return {};
  }

  /**
   * Returns a string representation of this sensor.
   */
  toString(): string {
    const lines = [
      `[${this.constructor.name}]`,
      `  ID: ${this.id}`,
      `  Name: ${this.name}`,
      `  Type: ${this.sensorType}`,
    ];

    if (this.hasParent()) {
      lines.push(`  Parent: ${this.parent.name}`);
    }

    lines.push(this.fieldOfView.toString().split('\n').map((l) => `  ${l}`).join('\n'));

    return lines.join('\n');
  }

  // ==================== Private Methods ====================

  /**
   * Determines the pass type based on current and previous visibility.
   */
  private static getPassType_(isInView: boolean, isInViewLast: boolean): PassType {
    if (isInView && !isInViewLast) {
      return PassType.ENTER;
    } else if (!isInView && isInViewLast) {
      return PassType.EXIT;
    } else if (isInView && isInViewLast) {
      return PassType.IN_VIEW;
    }

    return PassType.OUT_OF_VIEW;
  }
}
