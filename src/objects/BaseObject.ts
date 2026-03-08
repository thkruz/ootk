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

import { BaseObjectParams } from '../interfaces/BaseObjectParams';
import { SpaceObjectType } from '../types/types';
import { History, HistoryConfig } from './History';
import { HistoricalState, SerializedObject } from './ObjectTypes';

// Re-export for convenience
export type { BaseObjectParams } from '../interfaces/BaseObjectParams';

/**
 * Abstract base class for all objects in the ootk system.
 * Provides common functionality for identification, type checking,
 * history tracking, and serialization.
 */
export abstract class BaseObject {
  /** Unique identifier for the object */
  id: number;
  /** Human-readable name */
  name: string;
  /** Type classification of the object */
  type: SpaceObjectType;
  /** Whether the object is currently active */
  active: boolean;
  /** Additional metadata for the object */
  metadata?: Record<string, unknown>;

  /** History tracking (null until enabled) */
  private history_: History<HistoricalState> | null = null;

  constructor(info: BaseObjectParams) {
    this.type = info.type ?? SpaceObjectType.UNKNOWN;
    this.name = info.name ?? 'Unknown';
    this.id = info.id ?? -1;
    this.active = info.active ?? true;
    this.metadata = info.metadata;
  }

  // ==================== History Methods ====================

  /**
   * Enables history tracking for this object.
   * @param config - Optional configuration for history behavior
   */
  enableHistory(config?: HistoryConfig): void {
    this.history_ ??= new History<HistoricalState>(config);
  }

  /**
   * Disables history tracking and clears existing history.
   */
  disableHistory(): void {
    this.history_ = null;
  }

  /**
   * Returns the history object if enabled, null otherwise.
   */
  get history(): History<HistoricalState> | null {
    return this.history_;
  }

  /**
   * Returns true if history tracking is enabled.
   */
  get isHistoryEnabled(): boolean {
    return this.history_ !== null;
  }

  /**
   * Records a state to history if history tracking is enabled.
   * @param time - The timestamp for this state
   * @param state - The state to record
   */
  protected recordToHistory(time: Date, state: HistoricalState): void {
    if (this.history_) {
      this.history_.add(time, state);
    }
  }

  // ==================== Serialization Methods ====================

  /**
   * Serializes the object to a plain object for persistence.
   */
  serialize(): SerializedObject {
    return {
      type: this.constructor.name,
      id: this.id,
      name: this.name,
      objectType: this.type,
      active: this.active,
      metadata: this.metadata,
      ...this.serializeSpecific(),
    };
  }

  /**
   * Returns type-specific serialization data.
   * Subclasses must implement this to add their specific properties.
   */
  protected abstract serializeSpecific(): Record<string, unknown>;

  // ==================== Type Checking Methods ====================

  /**
   * Checks if the object is a satellite.
   * @returns True if the object is a satellite, false otherwise.
   */
  isSatellite(): boolean {
    return false;
  }

  /**
   * Checks if the object is a ground object.
   * @returns True if the object is a ground object, false otherwise.
   */
  isGroundObject(): boolean {
    return false;
  }

  /**
   * Returns whether the object is a sensor.
   * @returns True if the object is a sensor, false otherwise.
   */
  isSensor(): boolean {
    return false;
  }

  /**
   * Checks if the object is a marker.
   * @returns True if the object is a marker, false otherwise.
   */
  isMarker(): boolean {
    return false;
  }

  /**
   * Returns whether the object's position is static.
   * @returns True if the object is static, false otherwise.
   */
  isStatic(): boolean {
    return true; // Default to static; SpaceObject overrides to false
  }

  isPayload(): boolean {
    return this.type === SpaceObjectType.PAYLOAD;
  }

  isRocketBody(): boolean {
    return this.type === SpaceObjectType.ROCKET_BODY;
  }

  isDebris(): boolean {
    return this.type === SpaceObjectType.DEBRIS;
  }

  isStar(): boolean {
    return this.type === SpaceObjectType.STAR;
  }

  isMissile(): boolean {
    return this.type === SpaceObjectType.BALLISTIC_MISSILE;
  }

  isNotional(): boolean {
    return this.type === SpaceObjectType.NOTIONAL;
  }

  getTypeString(): string {
    const typeToStringMap: { [key in SpaceObjectType]?: string } = {
      [SpaceObjectType.UNKNOWN]: 'Unknown',
      [SpaceObjectType.PAYLOAD]: 'Payload',
      [SpaceObjectType.ROCKET_BODY]: 'Rocket Body',
      [SpaceObjectType.DEBRIS]: 'Debris',
      [SpaceObjectType.SPECIAL]: 'Special',
      [SpaceObjectType.BALLISTIC_MISSILE]: 'Ballistic Missile',
      [SpaceObjectType.STAR]: 'Star',
      [SpaceObjectType.INTERGOVERNMENTAL_ORGANIZATION]: 'Intergovernmental Organization',
      [SpaceObjectType.SUBORBITAL_PAYLOAD_OPERATOR]: 'Suborbital Payload Operator',
      [SpaceObjectType.PAYLOAD_OWNER]: 'Payload Owner',
      [SpaceObjectType.METEOROLOGICAL_ROCKET_LAUNCH_AGENCY_OR_MANUFACTURER]:
        'Meteorological Rocket Launch Agency or Manufacturer',
      [SpaceObjectType.PAYLOAD_MANUFACTURER]: 'Payload Manufacturer',
      [SpaceObjectType.LAUNCH_AGENCY]: 'Launch Agency',
      [SpaceObjectType.LAUNCH_SITE]: 'Launch Site',
      [SpaceObjectType.LAUNCH_POSITION]: 'Launch Position',
      [SpaceObjectType.LAUNCH_FACILITY]: 'Launch Facility',
      [SpaceObjectType.CONTROL_FACILITY]: 'Control Facility',
      [SpaceObjectType.GROUND_SENSOR_STATION]: 'Ground Sensor Station',
      [SpaceObjectType.OPTICAL]: 'Optical',
      [SpaceObjectType.MECHANICAL]: 'Mechanical',
      [SpaceObjectType.PHASED_ARRAY_RADAR]: 'Phased Array Radar',
      [SpaceObjectType.OBSERVER]: 'Observer',
      [SpaceObjectType.BISTATIC_RADIO_TELESCOPE]: 'Bistatic Radio Telescope',
      [SpaceObjectType.COUNTRY]: 'Country',
      [SpaceObjectType.LAUNCH_VEHICLE_MANUFACTURER]: 'Launch Vehicle Manufacturer',
      [SpaceObjectType.ENGINE_MANUFACTURER]: 'Engine Manufacturer',
    };

    return typeToStringMap[this.type] ?? 'Unknown';
  }

  // ==================== Validation Helpers ====================

  /**
   * Validates a parameter value against a minimum and maximum value.
   * @param value - The value to be validated.
   * @param minValue - The minimum allowed value.
   * @param maxValue - The maximum allowed value.
   * @param errorMessage - The error message to be thrown if the value is invalid.
   */
  validateParameter<T>(value: T, minValue: T | null, maxValue: T | null, errorMessage: string): void {
    if (minValue !== null && minValue !== undefined && (value as number) < (minValue as number)) {
      throw new Error(errorMessage);
    }
    if (maxValue !== null && maxValue !== undefined && (value as number) > (maxValue as number)) {
      throw new Error(errorMessage);
    }
  }
}
