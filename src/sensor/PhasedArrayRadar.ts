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
import { ValidationError } from '../errors';
import { Degrees, Kilometers, Radians, RaeVec3, RuvVec3 } from '../types/types';
import { DEG2RAD, RAD2DEG } from '../utils/constants';
import { azel2uv, uv2azel } from '../transforms/transforms';
import { FieldOfView } from './FieldOfView';
import { RadarSensor, RadarSensorParams } from './RadarSensor';

/**
 * Parameters for constructing a PhasedArrayRadar.
 */
export interface PhasedArrayRadarParams extends RadarSensorParams {
  /** Boresight azimuth angles for each face (degrees) */
  boresightAz: Degrees[];
  /** Boresight elevation angles for each face (degrees) */
  boresightEl: Degrees[];
}

/**
 * Phased array radar sensor with electronic beam steering.
 *
 * Supports multi-face configurations with UV coordinate transformations
 * relative to boresight directions. Ported from the legacy RfSensor class.
 *
 * @example
 * ```typescript
 * const radar = new PhasedArrayRadar({
 *   id: 'pave-paws',
 *   name: 'PAVE PAWS',
 *   sensorType: SensorType.PHASED_ARRAY_RADAR,
 *   beamwidth: 2.0 as Degrees,
 *   boresightAz: [0 as Degrees, 180 as Degrees],  // Two faces
 *   boresightEl: [45 as Degrees, 45 as Degrees],
 *   fieldOfView: { ... },
 * });
 *
 * // Convert target Az/El to UV coordinates
 * const uv = radar.uvFromAzEl(45 as Degrees, 30 as Degrees, 0);
 * ```
 */
export class PhasedArrayRadar extends RadarSensor {
  /** Boresight azimuth angles for each face */
  readonly boresightAz: Degrees[];
  /** Boresight elevation angles for each face */
  readonly boresightEl: Degrees[];
  /** Number of radar faces */
  readonly faceCount: number;
  /** Field of view for each face */
  readonly faceFovs: FieldOfView[];

  constructor(params: PhasedArrayRadarParams) {
    // Ensure sensor type is correct
    const paramsWithType = {
      ...params,
      sensorType: SensorType.PHASED_ARRAY_RADAR,
    };

    super(paramsWithType);

    // Validate boresight arrays
    if (params.boresightAz.length !== params.boresightEl.length) {
      throw new Error('Boresight azimuth and elevation arrays must be the same length');
    }
    if (params.boresightAz.length === 0) {
      throw new Error('At least one boresight direction must be specified');
    }

    this.boresightAz = params.boresightAz;
    this.boresightEl = params.boresightEl;
    this.faceCount = params.boresightAz.length;

    // Build a FieldOfView for each face using the common FOV params but different boresights
    const baseFovParams = params.fieldOfView;

    this.faceFovs = params.boresightAz.map((az, i) => new FieldOfView({
      ...baseFovParams,
      boresightAz: az,
      boresightEl: params.boresightEl[i],
    }));
  }

  // ==================== FOV Override ====================

  /**
   * Checks if RAE coordinates are within any face's field of view.
   * @param rae - Range, azimuth, elevation coordinates
   * @returns True if within any face's FOV
   */
  override isInFov(rae: RaeVec3<Kilometers, Degrees>): boolean {
    return this.faceFovs.some((fov) => fov.contains(rae));
  }

  /**
   * Gets the indices of faces that can see the given RAE coordinates.
   * @param rae - Range, azimuth, elevation coordinates
   * @returns Array of face indices where target is in FOV
   */
  getFacesInFov(rae: RaeVec3<Kilometers, Degrees>): number[] {
    return this.faceFovs
      .map((fov, i) => (fov.contains(rae) ? i : -1))
      .filter((i) => i >= 0);
  }

  // ==================== UV Coordinate Methods ====================

  /**
   * Converts azimuth and elevation angles to UV coordinates relative to boresight.
   *
   * UV coordinates represent the angular deviation from the radar's boresight
   * direction, normalized by the beamwidth.
   *
   * @param az - Azimuth angle in degrees
   * @param el - Elevation angle in degrees
   * @param face - Face number (0-indexed), defaults to 0
   * @returns UV coordinates { u, v }
   * @throws Error if face number is invalid
   */
  uvFromAzEl(az: Degrees, el: Degrees, face: number = 0): { u: number; v: number } {
    this.validateFace_(face);

    const azRad = (az * DEG2RAD) as Radians;
    const elRad = (el * DEG2RAD) as Radians;
    const azDiff = (azRad - this.boresightAzRad(face)) as Radians;
    const elDiff = (elRad - this.boresightElRad(face)) as Radians;

    return azel2uv(azDiff, elDiff, this.beamwidthRad);
  }

  /**
   * Converts UV coordinates back to azimuth and elevation angles.
   *
   * @param u - U coordinate
   * @param v - V coordinate
   * @param face - Face number (0-indexed), required for multi-face sensors
   * @returns Az/El in degrees { az, el }
   * @throws Error if face number not specified for multi-face sensors
   */
  azElFromUV(u: number, v: number, face?: number): { az: Degrees; el: Degrees } {
    if (face === undefined && this.faceCount > 1) {
      throw new Error('Face number must be specified for multi-faced sensors');
    }

    const faceIndex = face ?? 0;

    this.validateFace_(faceIndex);

    const { az, el } = uv2azel(u, v, this.beamwidthRad);

    return {
      az: ((az * RAD2DEG) + this.boresightAz[faceIndex]) as Degrees,
      el: ((el * RAD2DEG) + this.boresightEl[faceIndex]) as Degrees,
    };
  }

  /**
   * Gets the boresight azimuth in radians for the specified face.
   * @param face - Face number (0-indexed)
   * @returns Boresight azimuth in radians
   */
  boresightAzRad(face: number = 0): Radians {
    this.validateFace_(face);

    return (this.boresightAz[face] * DEG2RAD) as Radians;
  }

  /**
   * Gets the boresight elevation in radians for the specified face.
   * @param face - Face number (0-indexed)
   * @returns Boresight elevation in radians
   */
  boresightElRad(face: number = 0): Radians {
    this.validateFace_(face);

    return (this.boresightEl[face] * DEG2RAD) as Radians;
  }

  // ==================== RUV Observation ====================

  /**
   * Generates an RUV (Range-U-V) observation vector for a target.
   *
   * RUV observations are commonly used in radar tracking as they
   * linearize near the boresight direction.
   *
   * @param range - Range to target in kilometers
   * @param az - Azimuth to target in degrees
   * @param el - Elevation to target in degrees
   * @param face - Face number for multi-face radar (defaults to 0)
   * @returns RUV vector { rng, u, v }
   */
  generateRuv(range: Kilometers, az: Degrees, el: Degrees, face: number = 0): RuvVec3<Kilometers> {
    const { u, v } = this.uvFromAzEl(az, el, face);

    return {
      rng: range,
      u,
      v,
    };
  }

  /**
   * Converts RUV observation back to RAE (Range-Azimuth-Elevation).
   *
   * @param ruv - RUV observation vector
   * @param face - Face number for multi-face radar
   * @returns RAE values { rng, az, el }
   */
  ruvToRae(ruv: RuvVec3<Kilometers>, face: number = 0): { rng: Kilometers; az: Degrees; el: Degrees } {
    const { az, el } = this.azElFromUV(ruv.u, ruv.v, face);

    return {
      rng: ruv.rng,
      az,
      el,
    };
  }

  // ==================== Multi-Face Methods ====================

  /**
   * Determines which face(s) can see a target at the given azimuth/elevation.
   *
   * A face can see a target if the angular deviation from its boresight
   * is within some multiple of the beamwidth (typically 60° for phased arrays).
   *
   * @param az - Target azimuth in degrees
   * @param el - Target elevation in degrees
   * @param maxAngle - Maximum angle from boresight in degrees (default: 60°)
   * @returns Array of face indices that can see the target
   */
  getVisibleFaces(az: Degrees, el: Degrees, maxAngle: Degrees = 60 as Degrees): number[] {
    const visibleFaces: number[] = [];

    for (let face = 0; face < this.faceCount; face++) {
      const azDiff = Math.abs(az - this.boresightAz[face]);
      const elDiff = Math.abs(el - this.boresightEl[face]);

      // Simple angular distance check (could use proper spherical distance)
      const angularDist = Math.sqrt(azDiff * azDiff + elDiff * elDiff);

      if (angularDist <= maxAngle) {
        visibleFaces.push(face);
      }
    }

    return visibleFaces;
  }

  /**
   * Gets the face with the smallest angular deviation from the target.
   * @param az - Target azimuth in degrees
   * @param el - Target elevation in degrees
   * @returns Best face index, or -1 if no face is within 90° of target
   */
  getBestFace(az: Degrees, el: Degrees): number {
    let bestFace = -1;
    let minDist = Infinity;

    for (let face = 0; face < this.faceCount; face++) {
      const azDiff = az - this.boresightAz[face];
      const elDiff = el - this.boresightEl[face];
      const dist = Math.sqrt(azDiff * azDiff + elDiff * elDiff);

      if (dist < minDist && dist < 90) {
        minDist = dist;
        bestFace = face;
      }
    }

    return bestFace;
  }

  // ==================== Serialization ====================

  protected override serializeSpecific(): Record<string, unknown> {
    return {
      ...super.serializeSpecific(),
      boresightAz: this.boresightAz,
      boresightEl: this.boresightEl,
      faceCount: this.faceCount,
    };
  }

  /**
   * Creates a deep copy of this phased array radar.
   * The cloned sensor will not have a parent assigned.
   * @returns A new PhasedArrayRadar instance with the same properties
   */
  override clone(): PhasedArrayRadar {
    return new PhasedArrayRadar({
      id: this.id,
      name: this.name,
      sensorType: this.sensorType,
      fieldOfView: this.fieldOfView.serialize(),
      beamwidth: this.beamwidth,
      frequency: this.frequency,
      peakPower: this.peakPower,
      boresightAz: [...this.boresightAz],
      boresightEl: [...this.boresightEl],
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

  override toString(): string {
    const base = super.toString();
    const faceInfo = this.boresightAz.map((az, i) =>
      `    Face ${i}: Az=${az.toFixed(1)}°, El=${this.boresightEl[i].toFixed(1)}°`,
    ).join('\n');

    return `${base}\n  Faces: ${this.faceCount}\n${faceInfo}`;
  }

  // ==================== Private Methods ====================

  /**
   * Validates that a face index is within bounds.
   */
  private validateFace_(face: number): void {
    if (face < 0 || face >= this.faceCount) {
      throw new ValidationError(
        `Face index must be between 0 and ${this.faceCount - 1}`,
        'face',
        face,
      );
    }
  }
}
