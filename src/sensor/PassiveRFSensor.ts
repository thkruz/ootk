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
import { ObservationOptical } from '../observation/ObservationOptical';
import { RadecTopocentric } from '../observation/RadecTopocentric';
import type { SpaceObject } from '../objects/SpaceObject';
import { Sensor, SensorParams } from './Sensor';

/**
 * Parameters for constructing a PassiveRFSensor.
 */
export interface PassiveRFSensorParams extends SensorParams {
  /** Frequency bands the sensor can receive */
  frequencyBands?: string[];
  /** Minimum receivable frequency in Hz */
  minFrequency?: number;
  /** Maximum receivable frequency in Hz */
  maxFrequency?: number;
  /** Receiver sensitivity in dBm */
  sensitivity?: number;
  /** Antenna gain in dB */
  antennaGain?: number;
}

/**
 * Passive RF sensor (SIGINT, no transmission).
 *
 * Receives radio frequency emissions from satellites without transmitting.
 * Produces angle-only observations (like optical) based on received signal
 * direction of arrival.
 *
 * @example
 * ```typescript
 * const sigint = new PassiveRFSensor({
 *   id: 'rf-collector-1',
 *   name: 'RF Collection Site',
 *   sensorType: SensorType.PASSIVE_RF,
 *   frequencyBands: ['UHF', 'L-band', 'S-band'],
 *   minFrequency: 300e6,    // 300 MHz
 *   maxFrequency: 4e9,      // 4 GHz
 *   sensitivity: -120,      // -120 dBm
 *   fieldOfView: {
 *     minRange: 500 as Kilometers,
 *     maxRange: 45000 as Kilometers,
 *     minAzimuth: 0 as Degrees,
 *     maxAzimuth: 360 as Degrees,
 *     minElevation: 5 as Degrees,
 *     maxElevation: 90 as Degrees,
 *   },
 * });
 * ```
 */
export class PassiveRFSensor extends Sensor {
  /** Frequency bands the sensor can receive */
  frequencyBands: string[];
  /** Minimum receivable frequency in Hz */
  minFrequency?: number;
  /** Maximum receivable frequency in Hz */
  maxFrequency?: number;
  /** Receiver sensitivity in dBm */
  sensitivity?: number;
  /** Antenna gain in dB */
  antennaGain?: number;

  constructor(params: PassiveRFSensorParams) {
    const paramsWithType = {
      ...params,
      sensorType: SensorType.PASSIVE_RF,
    };

    super(paramsWithType);

    this.frequencyBands = params.frequencyBands ?? [];
    this.minFrequency = params.minFrequency;
    this.maxFrequency = params.maxFrequency;
    this.sensitivity = params.sensitivity;
    this.antennaGain = params.antennaGain;
  }

  /**
   * Gets the bandwidth of the receiver in Hz.
   * @returns Bandwidth in Hz, or undefined if frequencies not set
   */
  get bandwidth(): number | undefined {
    if (this.minFrequency === undefined || this.maxFrequency === undefined) {
      return undefined;
    }

    return this.maxFrequency - this.minFrequency;
  }

  /**
   * Checks if a given frequency is within the sensor's receivable range.
   * @param frequency - Frequency in Hz to check
   * @returns True if frequency can be received
   */
  canReceiveFrequency(frequency: number): boolean {
    if (this.minFrequency === undefined || this.maxFrequency === undefined) {
      return true; // No limits defined
    }

    return frequency >= this.minFrequency && frequency <= this.maxFrequency;
  }

  /**
   * Checks if the sensor covers a specific frequency band.
   * @param band - Band name to check (e.g., "S-band", "UHF")
   * @returns True if band is in the list
   */
  hasBand(band: string): boolean {
    return this.frequencyBands.some((b) =>
      b.toLowerCase() === band.toLowerCase(),
    );
  }

  /**
   * Creates an angle-only observation (Ra/Dec) of a target.
   * Passive RF provides direction-of-arrival data similar to optical.
   * @param target - The space object to observe
   * @param date - Time of observation (defaults to now)
   * @returns ObservationOptical or null if target not in FOV
   */
  observe(target: SpaceObject, date: Date = new Date()): ObservationOptical | null {
    if (!this.canObserve(target, date)) {
      return null;
    }

    const sensorJ2000 = this.getJ2000(date);
    const targetJ2000 = target.toJ2000(date);

    const radec = RadecTopocentric.fromStateVector(targetJ2000, sensorJ2000);

    return new ObservationOptical(sensorJ2000, radec);
  }

  /**
   * Creates a RadecTopocentric observation without wrapping.
   * @param target - The space object to observe
   * @param date - Time of observation (defaults to now)
   * @returns RadecTopocentric or null if target not in FOV
   */
  observeRadec(target: SpaceObject, date: Date = new Date()): RadecTopocentric | null {
    if (!this.canObserve(target, date)) {
      return null;
    }

    const sensorJ2000 = this.getJ2000(date);
    const targetJ2000 = target.toJ2000(date);

    return RadecTopocentric.fromStateVector(targetJ2000, sensorJ2000);
  }

  protected override serializeSpecific(): Record<string, unknown> {
    return {
      frequencyBands: this.frequencyBands,
      minFrequency: this.minFrequency,
      maxFrequency: this.maxFrequency,
      sensitivity: this.sensitivity,
      antennaGain: this.antennaGain,
    };
  }

  /**
   * Creates a deep copy of this passive RF sensor.
   * The cloned sensor will not have a parent assigned.
   * @returns A new PassiveRFSensor instance with the same properties
   */
  override clone(): PassiveRFSensor {
    return new PassiveRFSensor({
      id: this.id,
      name: this.name,
      sensorType: this.sensorType,
      fieldOfView: this.fieldOfView.serialize(),
      frequencyBands: [...this.frequencyBands],
      minFrequency: this.minFrequency,
      maxFrequency: this.maxFrequency,
      sensitivity: this.sensitivity,
      antennaGain: this.antennaGain,
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
