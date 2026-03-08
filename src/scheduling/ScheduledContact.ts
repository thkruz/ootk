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

import type { Degrees, Kilometers } from '../types/types';
import type { AccessWindow } from '../objects/AccessWindow';
import type { GroundObject } from '../objects/GroundObject';
import type { GroundStation } from '../objects/GroundStation';
import type { Satellite } from '../objects/Satellite';
import type { SpaceObject } from '../objects/SpaceObject';

/**
 * Represents a time window with start and end dates.
 * Used for coverage gap analysis.
 */
export interface TimeWindow {
  /** Start of the time window */
  start: Date;
  /** End of the time window */
  end: Date;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Parameters for constructing a ScheduledContact.
 */
export interface ScheduledContactParams {
  /** The underlying access window from AccessCalculator */
  accessWindow: AccessWindow;
  /** Priority assigned to this contact (higher = more important) */
  priority: number;
  /** Scheduled start time (may differ from access window start for partial contacts) */
  scheduledStart?: Date;
  /** Scheduled end time (may differ from access window end for partial contacts) */
  scheduledEnd?: Date;
  /** Optional metadata for user-defined properties */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a scheduled contact between a ground station and satellite.
 *
 * ScheduledContact wraps an AccessWindow with scheduling-specific information
 * such as priority and potentially trimmed start/end times for partial contacts
 * or handovers.
 *
 * @example
 * ```typescript
 * const contact = new ScheduledContact({
 *   accessWindow: window,
 *   priority: 10,
 *   scheduledStart: window.start,
 *   scheduledEnd: window.end,
 * });
 *
 * console.log(contact.toString());
 * // [ScheduledContact]
 * //   Station: Goldstone
 * //   Satellite: ISS
 * //   Time: 10:00:00 - 10:15:00
 * //   Max Elevation: 45.2°
 * //   Priority: 10
 * ```
 */
export class ScheduledContact {
  /** The underlying access window */
  readonly accessWindow: AccessWindow;
  /** Priority assigned to this contact (higher = more important) */
  readonly priority: number;
  /** Scheduled start time (may be trimmed from access window) */
  readonly scheduledStart: Date;
  /** Scheduled end time (may be trimmed from access window) */
  readonly scheduledEnd: Date;
  /** Duration of the scheduled contact in milliseconds */
  readonly scheduledDuration: number;
  /** Optional metadata for user-defined properties */
  readonly metadata?: Record<string, unknown>;

  constructor(params: ScheduledContactParams) {
    this.accessWindow = params.accessWindow;
    this.priority = params.priority;
    this.scheduledStart = params.scheduledStart ?? params.accessWindow.start;
    this.scheduledEnd = params.scheduledEnd ?? params.accessWindow.end;
    this.scheduledDuration = this.scheduledEnd.getTime() - this.scheduledStart.getTime();
    this.metadata = params.metadata;
  }

  /**
   * Access window start time.
   */
  get start(): Date {
    return this.accessWindow.start;
  }

  /**
   * Access window end time.
   */
  get end(): Date {
    return this.accessWindow.end;
  }

  /**
   * Access window duration in milliseconds.
   */
  get duration(): number {
    return this.accessWindow.duration;
  }

  /**
   * Maximum elevation achieved during the pass.
   */
  get maxElevation(): Degrees {
    return this.accessWindow.maxElevation;
  }

  /**
   * Time of maximum elevation.
   */
  get maxElevationTime(): Date {
    return this.accessWindow.maxElevationTime;
  }

  /**
   * Range at maximum elevation.
   */
  get rangeAtMaxEl(): Kilometers {
    return this.accessWindow.rangeAtMaxEl;
  }

  /**
   * The observing ground object.
   */
  get observer(): GroundObject {
    return this.accessWindow.observer;
  }

  /**
   * The observed space object.
   */
  get target(): SpaceObject {
    return this.accessWindow.target;
  }

  /**
   * The ground station (convenience getter assuming observer is GroundStation).
   */
  get station(): GroundStation {
    return this.accessWindow.observer as GroundStation;
  }

  /**
   * The satellite (convenience getter assuming target is Satellite).
   */
  get satellite(): Satellite {
    return this.accessWindow.target as Satellite;
  }

  /**
   * Checks if this contact's scheduled time overlaps with another contact.
   * @param other - The other contact to check
   * @returns True if the scheduled times overlap
   */
  overlaps(other: ScheduledContact): boolean {
    return !(
      this.scheduledEnd.getTime() <= other.scheduledStart.getTime() ||
      this.scheduledStart.getTime() >= other.scheduledEnd.getTime()
    );
  }

  /**
   * Checks if this contact conflicts with another contact at the same station.
   * Two contacts conflict if they use the same station and overlap in time.
   * @param other - The other contact to check
   * @param handoverMs - Optional handover time buffer in milliseconds
   * @returns True if both contacts use the same station and overlap in time
   */
  conflictsWith(other: ScheduledContact, handoverMs: number = 0): boolean {
    // Different stations = no conflict
    if (this.station.id !== other.station.id) {
      return false;
    }

    // Check time overlap with handover buffer
    const thisEnd = this.scheduledEnd.getTime() + handoverMs;
    const otherEnd = other.scheduledEnd.getTime() + handoverMs;

    return !(
      thisEnd <= other.scheduledStart.getTime() ||
      this.scheduledStart.getTime() >= otherEnd
    );
  }

  /**
   * Creates a copy of this contact with adjusted scheduled times.
   * @param newStart - New scheduled start time
   * @param newEnd - New scheduled end time
   * @returns A new ScheduledContact with the updated times
   */
  withTimes(newStart: Date, newEnd: Date): ScheduledContact {
    return new ScheduledContact({
      accessWindow: this.accessWindow,
      priority: this.priority,
      scheduledStart: newStart,
      scheduledEnd: newEnd,
      metadata: this.metadata,
    });
  }

  /**
   * Formats a Date as HH:MM:SS.
   */
  private static formatTime_(date: Date): string {
    const h = date.getUTCHours().toString().padStart(2, '0');
    const m = date.getUTCMinutes().toString().padStart(2, '0');
    const s = date.getUTCSeconds().toString().padStart(2, '0');

    return `${h}:${m}:${s}`;
  }

  toString(): string {
    const startTime = ScheduledContact.formatTime_(this.scheduledStart);
    const endTime = ScheduledContact.formatTime_(this.scheduledEnd);
    const stationName = this.station.name || this.station.id;
    const satName = this.satellite.name || String(this.satellite.id);

    return [
      '[ScheduledContact]',
      `  Station: ${stationName}`,
      `  Satellite: ${satName}`,
      `  Time: ${startTime} - ${endTime}`,
      `  Max Elevation: ${this.maxElevation.toFixed(1)}°`,
      `  Priority: ${this.priority}`,
    ].join('\n');
  }
}
