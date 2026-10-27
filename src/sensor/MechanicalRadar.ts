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
import { Vector3D } from '../operations/Vector3D';
import { DegreesPerSecond, Kilometers, Radians } from '../types/types';
import { DEG2RAD, RAD2DEG } from '../utils/constants';
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
 *   id: 1,
 *   name: 'AN/FPQ-6',
 *   sensorType: SensorType.MECHANICAL_RADAR,
 *   beamwidth: 0.4 as Degrees,
 *   scanRate: 6 as DegreesPerSecond,
 *   hasTracking: true,
 *   fieldOfView: {
 *     halfAngle: 90 as Degrees, // zenith-pointing hemisphere
 *     minRange: 100 as Kilometers,
 *     maxRange: 40000 as Kilometers,
 *     minElevation: 3 as Degrees,
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
   * Calculates the time to scan across the full azimuth range of the field of view.
   * Only valid if scanRate is defined.
   *
   * The azimuth span is 360 deg when the FOV contains the zenith (for example a hemisphere).
   * Otherwise, for a circular cone of half-angle alpha around a boresight at elevation e, it is
   * 2 asin(sin(alpha) / cos(e)) (the azimuth half-width of a small circle on the sphere); for an
   * elliptical cone it is measured from the sampled cone boundary.
   *
   * @returns Scan period in seconds (azimuth span in degrees / scanRate in deg/s), or undefined
   *   if no scan rate
   */
  get scanPeriod(): number | undefined {
    if (!this.scanRate) {
      return undefined;
    }

    return this.azimuthSpan_() / this.scanRate;
  }

  /** Azimuth extent of the FOV cone in degrees, in (0, 360]. */
  private azimuthSpan_(): number {
    const fov = this.fieldOfView;
    const up = new Vector3D(0, 0, 1);
    const midRange = ((fov.minRange + fov.maxRange) / 2) as Kilometers;

    if (fov.containsDirection(up, midRange)) {
      return 360;
    }

    if (fov.isCircular) {
      const alpha = fov.halfAngle * DEG2RAD;
      const cosEl = Math.cos(fov.boresightEl * DEG2RAD);
      const s = Math.sin(alpha) / cosEl;

      return s >= 1 ? 360 : 2 * Math.asin(s) * RAD2DEG;
    }

    // Elliptical cone not containing the zenith: 360 minus the largest gap between boundary azimuths
    const n = 1440;
    const azs: number[] = [];

    for (let i = 0; i < n; i++) {
      const d = fov.directionAt(((2 * Math.PI * i) / n) as Radians);

      azs.push(((Math.atan2(d.x, d.y) * RAD2DEG) + 360) % 360);
    }
    azs.sort((a, b) => a - b);

    let maxGap = azs[0] + 360 - azs[n - 1];

    for (let i = 1; i < n; i++) {
      maxGap = Math.max(maxGap, azs[i] - azs[i - 1]);
    }

    return 360 - maxGap;
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
