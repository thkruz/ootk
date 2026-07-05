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

import { EpochUTC } from '../time/EpochUTC';
import { ObservationRadar } from '../observation/ObservationRadar';
import { RAE } from '../observation/RAE';
import type { SpaceObject } from '../objects/SpaceObject';
import { Degrees, Kilometers, Radians } from '../types/types';
import { DEG2RAD } from '../utils/constants';
import { Sensor, SensorParams } from './Sensor';

/**
 * Parameters for constructing a RadarSensor.
 */
export interface RadarSensorParams extends SensorParams {
  /** Radar beamwidth in degrees */
  beamwidth: Degrees;
  /** Radar frequency band (e.g., "X-band", "S-band") */
  frequency?: string;
  /** Peak transmit power in watts */
  peakPower?: number;
}

/**
 * Abstract base class for radar sensors.
 *
 * Provides common radar functionality including beamwidth handling
 * and default RAE-based observation generation.
 *
 * @example
 * ```typescript
 * // Concrete radar implementations extend this class
 * class MyRadar extends RadarSensor {
 *   observe(target: SpaceObject, date?: Date): ObservationRadar | null {
 *     return super.observe(target, date);
 *   }
 * }
 * ```
 */
export abstract class RadarSensor extends Sensor {
  /** Radar beamwidth in degrees */
  readonly beamwidth: Degrees;
  /** Radar frequency band */
  frequency?: string;
  /** Peak transmit power in watts */
  peakPower?: number;

  constructor(params: RadarSensorParams) {
    super(params);
    this.beamwidth = params.beamwidth;
    this.frequency = params.frequency;
    this.peakPower = params.peakPower;
  }

  /**
   * Gets the beamwidth in radians.
   */
  get beamwidthRad(): Radians {
    return (this.beamwidth * DEG2RAD) as Radians;
  }

  /**
   * Creates a radar observation (RAE) of a target.
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
   * Creates a RAE observation without wrapping in ObservationRadar.
   * Useful for simpler use cases that don't need the full observation class.
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
   * Creates a RAE object from epoch and raw values.
   * Convenience factory for creating observations programmatically.
   * @param epoch - Observation epoch
   * @param range - Range in kilometers
   * @param azimuth - Azimuth in degrees
   * @param elevation - Elevation in degrees
   * @returns RAE observation
   */
  protected createRae(
    epoch: EpochUTC,
    range: number,
    azimuth: Degrees,
    elevation: Degrees,
  ): RAE {
    return RAE.fromDegrees(
      epoch,
      range as Kilometers,
      azimuth,
      elevation,
    );
  }

  protected override serializeSpecific(): Record<string, unknown> {
    return {
      beamwidth: this.beamwidth,
      frequency: this.frequency,
      peakPower: this.peakPower,
    };
  }

  /**
   * Creates a deep copy of this radar sensor.
   * The cloned sensor will not have a parent assigned.
   * @returns A new RadarSensor instance with the same properties
   */
  abstract override clone(): RadarSensor;
}
