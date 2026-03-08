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
import type { GroundObject } from './GroundObject';
import type { SpaceObject } from './SpaceObject';

/**
 * Parameters for constructing an AccessWindow.
 */
export interface AccessWindowParams {
  /** Start time of the access window */
  start: Date;
  /** End time of the access window */
  end: Date;
  /** Duration in milliseconds */
  duration: number;
  /** Maximum elevation achieved during the pass */
  maxElevation: Degrees;
  /** Time of maximum elevation */
  maxElevationTime: Date;
  /** Range at maximum elevation */
  rangeAtMaxEl: Kilometers;
  /** The observing ground object */
  observer: GroundObject;
  /** The observed space object */
  target: SpaceObject;
}

/**
 * Represents a single access window (visibility period) between
 * a ground observer and a space object.
 */
export class AccessWindow {
  /** Start time of the access window */
  readonly start: Date;
  /** End time of the access window */
  readonly end: Date;
  /** Duration in milliseconds */
  readonly duration: number;
  /** Maximum elevation achieved during the pass */
  readonly maxElevation: Degrees;
  /** Time of maximum elevation */
  readonly maxElevationTime: Date;
  /** Range at maximum elevation */
  readonly rangeAtMaxEl: Kilometers;
  /** The observing ground object */
  readonly observer: GroundObject;
  /** The observed space object */
  readonly target: SpaceObject;

  constructor(params: AccessWindowParams) {
    this.start = params.start;
    this.end = params.end;
    this.duration = params.duration;
    this.maxElevation = params.maxElevation;
    this.maxElevationTime = params.maxElevationTime;
    this.rangeAtMaxEl = params.rangeAtMaxEl;
    this.observer = params.observer;
    this.target = params.target;
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
    const startTime = AccessWindow.formatTime_(this.start);
    const endTime = AccessWindow.formatTime_(this.end);
    const observerName = this.observer.name || this.observer.id;
    const targetName = this.target.name || this.target.id;

    return [
      `Pass: ${startTime} - ${endTime} (max el: ${this.maxElevation.toFixed(1)}°, range: ${this.rangeAtMaxEl.toFixed(1)} km)`,
      `  Observer: ${observerName}`,
      `  Target: ${targetName}`,
    ].join('\n');
  }
}

/**
 * Constraints for access window calculations.
 * All constraints are optional - if omitted, default values are used.
 */
export interface AccessConstraints {
  /** Minimum elevation angle above horizon (default: 0°) */
  minElevation?: Degrees;
  /** Maximum slant range (default: unlimited) */
  maxRange?: Kilometers;
  /** Minimum slant range (default: 0) */
  minRange?: Kilometers;
  /** Require target to be sunlit (not in Earth's shadow) */
  requireSunlit?: boolean;
  /** Require observer to be in darkness (for optical observations) */
  requireObserverDark?: boolean;
}

/**
 * Internal state tracker for access window detection.
 * @internal
 */
export interface AccessState {
  isInAccess: boolean;
  windowStart: Date | null;
  maxEl: Degrees;
  maxElTime: Date | null;
  rangeAtMaxEl: Kilometers;
}
