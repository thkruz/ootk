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

import { SensorType } from '../enums/SensorType';
import { DegreesPerSecond } from '../types/types';
import { RadarSensor, RadarSensorParams } from './RadarSensor';

/**
 * Parameters for constructing a MechanicalRadar.
 */
export interface MechanicalRadarParams extends RadarSensorParams {
  /** Antenna scan rate in degrees per second */
  scanRate?: DegreesPerSecond;
  /** Whether radar can track targets (vs just detect) */
  hasTracking?: boolean;
  /** Antenna diameter in meters */
  antennaDiameter?: number;
}

/**
 * Mechanical tracking radar (dish-based).
 *
 * Traditional radar with physically rotating antenna. May support
 * tracking mode where antenna follows a specific target.
 *
 * @example
 * ```typescript
 * const radar = new MechanicalRadar({
 *   id: 'tracking-radar-1',
 *   name: 'AN/FPQ-6',
 *   sensorType: SensorType.MECHANICAL_RADAR,
 *   beamwidth: 0.4 as Degrees,
 *   scanRate: 6 as DegreesPerSecond,
 *   hasTracking: true,
 *   fieldOfView: {
 *     minRange: 100 as Kilometers,
 *     maxRange: 40000 as Kilometers,
 *     minAzimuth: 0 as Degrees,
 *     maxAzimuth: 360 as Degrees,
 *     minElevation: 3 as Degrees,
 *     maxElevation: 85 as Degrees,
 *   },
 * });
 * ```
 */
export class MechanicalRadar extends RadarSensor {
  /** Antenna scan rate in degrees per second */
  scanRate?: DegreesPerSecond;
  /** Whether radar can track targets */
  hasTracking: boolean;
  /** Antenna diameter in meters */
  antennaDiameter?: number;

  constructor(params: MechanicalRadarParams) {
    const paramsWithType = {
      ...params,
      sensorType: SensorType.MECHANICAL_RADAR,
    };

    super(paramsWithType);

    this.scanRate = params.scanRate;
    this.hasTracking = params.hasTracking ?? false;
    this.antennaDiameter = params.antennaDiameter;
  }

  /**
   * Calculates the time to scan across the full azimuth range.
   * Only valid if scanRate is defined.
   * @returns Scan period in seconds, or undefined if no scan rate
   */
  get scanPeriod(): number | undefined {
    if (!this.scanRate) {
      return undefined;
    }

    const azCoverage = this.fieldOfView.angularCoverage;

    return azCoverage / this.scanRate;
  }

  /**
   * Estimates time until target enters beam during scanning.
   * Assumes continuous azimuth scanning at scanRate.
   *
   * @param targetAz - Target azimuth in degrees
   * @param currentAz - Current antenna azimuth in degrees
   * @returns Time in seconds, or undefined if no scan rate
   */
  timeToTarget(targetAz: number, currentAz: number): number | undefined {
    if (!this.scanRate) {
      return undefined;
    }

    let azDiff = targetAz - currentAz;

    // Ensure positive direction (assuming clockwise scan)
    if (azDiff < 0) {
      azDiff += 360;
    }

    return azDiff / this.scanRate;
  }

  protected override serializeSpecific(): Record<string, unknown> {
    return {
      ...super.serializeSpecific(),
      scanRate: this.scanRate,
      hasTracking: this.hasTracking,
      antennaDiameter: this.antennaDiameter,
    };
  }

  /**
   * Creates a deep copy of this mechanical radar.
   * The cloned sensor will not have a parent assigned.
   * @returns A new MechanicalRadar instance with the same properties
   */
  override clone(): MechanicalRadar {
    return new MechanicalRadar({
      id: this.id,
      name: this.name,
      sensorType: this.sensorType,
      fieldOfView: this.fieldOfView.serialize(),
      beamwidth: this.beamwidth,
      frequency: this.frequency,
      peakPower: this.peakPower,
      scanRate: this.scanRate,
      hasTracking: this.hasTracking,
      antennaDiameter: this.antennaDiameter,
      shortName: this.shortName,
      system: this.system,
      country: this.country,
      operator: this.operator,
      dwellTime: this.dwellTime,
      freqBand: this.freqBand,
      isVolumetric: this.isVolumetric,
      url: this.url,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }
}
