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
 * Parameters for constructing an OpticalSensor.
 */
export interface OpticalSensorParams extends SensorParams {
  /** Telescope aperture in meters */
  aperture?: number;
  /** Focal length in meters */
  focalLength?: number;
  /** Limiting magnitude (faintest detectable) */
  limitingMagnitude?: number;
  /** Operating wavelength in nanometers */
  wavelength?: number;
  /** Field of view in degrees (for camera/CCD) */
  ccdFov?: number;
}

/**
 * Optical/visual sensor (telescope, camera).
 *
 * Produces angle-only observations (right ascension and declination)
 * using the RadecTopocentric observation class.
 *
 * @example
 * ```typescript
 * const telescope = new OpticalSensor({
 *   id: 'geodss-1',
 *   name: 'GEODSS Site 1',
 *   sensorType: SensorType.OPTICAL,
 *   aperture: 1.0,           // 1 meter aperture
 *   limitingMagnitude: 16.5, // Can see objects dimmer than mag 16
 *   fieldOfView: {
 *     minRange: 5000 as Kilometers,
 *     maxRange: 50000 as Kilometers,
 *     minAzimuth: 0 as Degrees,
 *     maxAzimuth: 360 as Degrees,
 *     minElevation: 10 as Degrees,
 *     maxElevation: 90 as Degrees,
 *   },
 * });
 *
 * const observation = telescope.observe(satellite);
 * ```
 */
export class OpticalSensor extends Sensor {
  /** Telescope aperture in meters */
  aperture?: number;
  /** Focal length in meters */
  focalLength?: number;
  /** Limiting magnitude */
  limitingMagnitude?: number;
  /** Operating wavelength in nanometers */
  wavelength?: number;
  /** CCD field of view in degrees */
  ccdFov?: number;

  constructor(params: OpticalSensorParams) {
    const paramsWithType = {
      ...params,
      sensorType: SensorType.OPTICAL,
    };

    super(paramsWithType);

    this.aperture = params.aperture;
    this.focalLength = params.focalLength;
    this.limitingMagnitude = params.limitingMagnitude;
    this.wavelength = params.wavelength;
    this.ccdFov = params.ccdFov;
  }

  /**
   * Calculates the focal ratio (f/number) of the telescope.
   * @returns Focal ratio, or undefined if aperture or focalLength not set
   */
  get focalRatio(): number | undefined {
    if (!this.aperture || !this.focalLength) {
      return undefined;
    }

    return this.focalLength / this.aperture;
  }

  /**
   * Creates an optical observation (Ra/Dec) of a target.
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
   * Useful for simpler use cases.
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

  /**
   * Checks if a target's estimated magnitude is within sensor capability.
   * Note: This is a simplified check. Actual visibility depends on
   * illumination conditions, albedo, phase angle, etc.
   *
   * @param estimatedMagnitude - Estimated apparent magnitude of target
   * @returns True if target is potentially detectable
   */
  canDetectMagnitude(estimatedMagnitude: number): boolean {
    if (this.limitingMagnitude === undefined) {
      return true; // No limit specified, assume yes
    }

    // Higher magnitude = fainter object
    // Sensor can see objects up to limitingMagnitude
    return estimatedMagnitude <= this.limitingMagnitude;
  }

  protected override serializeSpecific(): Record<string, unknown> {
    return {
      aperture: this.aperture,
      focalLength: this.focalLength,
      limitingMagnitude: this.limitingMagnitude,
      wavelength: this.wavelength,
      ccdFov: this.ccdFov,
    };
  }

  /**
   * Creates a deep copy of this optical sensor.
   * The cloned sensor will not have a parent assigned.
   * @returns A new OpticalSensor instance with the same properties
   */
  override clone(): OpticalSensor {
    return new OpticalSensor({
      id: this.id,
      name: this.name,
      sensorType: this.sensorType,
      fieldOfView: this.fieldOfView.serialize(),
      aperture: this.aperture,
      focalLength: this.focalLength,
      limitingMagnitude: this.limitingMagnitude,
      wavelength: this.wavelength,
      ccdFov: this.ccdFov,
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
