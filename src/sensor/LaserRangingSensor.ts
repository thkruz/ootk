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
import { ObservationRadar } from '../observation/ObservationRadar';
import { RAE } from '../observation/RAE';
import type { SpaceObject } from '../objects/SpaceObject';
import { Sensor, SensorParams } from './Sensor';

/**
 * Common SLR wavelengths in nanometers.
 */
export const SLR_WAVELENGTHS = {
  /** Green laser (most common for SLR) */
  GREEN_532: 532,
  /** Near-infrared laser */
  NIR_1064: 1064,
} as const;

/**
 * Parameters for constructing a LaserRangingSensor.
 */
export interface LaserRangingSensorParams extends SensorParams {
  /** Laser wavelength in nanometers (532nm or 1064nm typical) */
  wavelength?: number;
  /** Pulse energy in Joules */
  pulseEnergy?: number;
  /** Pulse repetition rate in Hz */
  pulseRate?: number;
  /** Telescope aperture in meters */
  aperture?: number;
  /** Timing precision in picoseconds */
  timingPrecision?: number;
}

/**
 * Satellite Laser Ranging (SLR) sensor.
 *
 * Produces high-precision range observations by measuring the round-trip
 * time of laser pulses reflected from retroreflectors on satellites.
 *
 * @example
 * ```typescript
 * const slr = new LaserRangingSensor({
 *   id: 'mlrs',
 *   name: 'McDonald Laser Ranging Station',
 *   sensorType: SensorType.LASER_RANGING,
 *   wavelength: SLR_WAVELENGTHS.GREEN_532,
 *   pulseEnergy: 0.1,       // 100 mJ
 *   pulseRate: 20,          // 20 Hz
 *   timingPrecision: 30,    // 30 ps timing
 *   fieldOfView: {
 *     minRange: 500 as Kilometers,
 *     maxRange: 40000 as Kilometers,
 *     minAzimuth: 0 as Degrees,
 *     maxAzimuth: 360 as Degrees,
 *     minElevation: 20 as Degrees,
 *     maxElevation: 90 as Degrees,
 *   },
 * });
 * ```
 */
export class LaserRangingSensor extends Sensor {
  /** Laser wavelength in nanometers */
  wavelength?: number;
  /** Pulse energy in Joules */
  pulseEnergy?: number;
  /** Pulse repetition rate in Hz */
  pulseRate?: number;
  /** Telescope aperture in meters */
  aperture?: number;
  /** Timing precision in picoseconds */
  timingPrecision?: number;

  constructor(params: LaserRangingSensorParams) {
    const paramsWithType = {
      ...params,
      sensorType: SensorType.LASER_RANGING,
    };

    super(paramsWithType);

    this.wavelength = params.wavelength;
    this.pulseEnergy = params.pulseEnergy;
    this.pulseRate = params.pulseRate;
    this.aperture = params.aperture;
    this.timingPrecision = params.timingPrecision;
  }

  /**
   * Converts timing precision to range precision.
   * Range precision = (c * timing_precision) / 2
   * (divide by 2 because round-trip measurement)
   *
   * @returns Range precision in meters, or undefined if timingPrecision not set
   */
  get rangePrecisionMeters(): number | undefined {
    if (this.timingPrecision === undefined) {
      return undefined;
    }

    const SPEED_OF_LIGHT = 299792458; // m/s
    const timingSeconds = this.timingPrecision * 1e-12; // ps to seconds

    return (SPEED_OF_LIGHT * timingSeconds) / 2;
  }

  /**
   * Creates a radar-style observation (RAE) of a target.
   * SLR provides range data along with pointing angles.
   * @param target - The space object to observe
   * @param date - Time of observation (defaults to now)
   * @returns ObservationRadar or null if target not in FOV
   */
  observe(target: SpaceObject, date: Date = new Date()): ObservationRadar | null {
    if (!this.canObserve(target, date)) {
      return null;
    }

    const sensorJ2000 = this.getJ2000(date);
    const targetJ2000 = target.toJ2000(date);

    const rae = RAE.fromStateVector(targetJ2000, sensorJ2000);

    return new ObservationRadar(sensorJ2000, rae);
  }

  /**
   * Creates a RAE observation without wrapping.
   * @param target - The space object to observe
   * @param date - Time of observation (defaults to now)
   * @returns RAE or null if target not in FOV
   */
  observeRae(target: SpaceObject, date: Date = new Date()): RAE | null {
    if (!this.canObserve(target, date)) {
      return null;
    }

    const sensorJ2000 = this.getJ2000(date);
    const targetJ2000 = target.toJ2000(date);

    return RAE.fromStateVector(targetJ2000, sensorJ2000);
  }

  /**
   * Checks if this is a green laser (532nm).
   */
  isGreenLaser(): boolean {
    return this.wavelength === SLR_WAVELENGTHS.GREEN_532;
  }

  /**
   * Checks if this is an infrared laser (1064nm).
   */
  isInfraredLaser(): boolean {
    return this.wavelength === SLR_WAVELENGTHS.NIR_1064;
  }

  protected override serializeSpecific(): Record<string, unknown> {
    return {
      wavelength: this.wavelength,
      pulseEnergy: this.pulseEnergy,
      pulseRate: this.pulseRate,
      aperture: this.aperture,
      timingPrecision: this.timingPrecision,
    };
  }

  /**
   * Creates a deep copy of this laser ranging sensor.
   * The cloned sensor will not have a parent assigned.
   * @returns A new LaserRangingSensor instance with the same properties
   */
  override clone(): LaserRangingSensor {
    return new LaserRangingSensor({
      id: this.id,
      name: this.name,
      sensorType: this.sensorType,
      fieldOfView: this.fieldOfView.serialize(),
      wavelength: this.wavelength,
      pulseEnergy: this.pulseEnergy,
      pulseRate: this.pulseRate,
      aperture: this.aperture,
      timingPrecision: this.timingPrecision,
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
