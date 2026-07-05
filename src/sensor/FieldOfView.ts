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

import { FovFrame, FovShape } from '../enums';
import { ValidationError } from '../errors';
import { Vector3D } from '../operations/Vector3D';
import { Degrees, Kilometers, Radians, RaeVec3 } from '../types/types';

/** Conversion factor from degrees to radians */
const DEG2RAD = (Math.PI / 180) as Radians;
/** Conversion factor from radians to degrees */
const RAD2DEG = (180 / Math.PI) as Degrees;
/** Half pi (90 degrees) in radians */
const HALF_PI = (Math.PI / 2) as Radians;
/** Small epsilon for floating point comparisons */
const EPS = 1e-10;

/**
 * Deep space range threshold in kilometers.
 * Objects beyond this distance are considered deep space.
 */
const DEEP_SPACE_THRESHOLD_KM = 6000 as Kilometers;

/**
 * Azimuth-dependent elevation mask for terrain/obstructions.
 * Used to define regions where the minimum elevation is higher than the global minimum
 * due to buildings, mountains, or other obstructions.
 */
export interface ElevationMask {
  /** Start of azimuth range in degrees (inclusive) */
  startAz: Degrees;
  /** End of azimuth range in degrees (inclusive), handles wraparound */
  stopAz: Degrees;
  /** Minimum elevation in degrees for this azimuth range */
  minEl: Degrees;
}

/**
 * Parameters for constructing a FieldOfView.
 */
export interface FieldOfViewParams {
  /** Boresight azimuth in degrees (default: 0° = North) */
  boresightAz?: Degrees;
  /** Boresight elevation in degrees (default: 90° = zenith) */
  boresightEl?: Degrees;

  /** Half-angle of FOV cone in degrees (major axis for elliptical) */
  halfAngle: Degrees;
  /** Minor half-angle for elliptical cone (defaults to halfAngle for circular) */
  minorHalfAngle?: Degrees;
  /** Roll angle for elliptical cone orientation in degrees (default: 0°) */
  rollAngle?: Degrees;

  /** Minimum range in kilometers */
  minRange: Kilometers;
  /** Maximum range in kilometers */
  maxRange: Kilometers;

  /** Global minimum elevation in degrees (default: 0°) */
  minElevation?: Degrees;
  /** Azimuth-specific elevation masks for terrain/buildings */
  elevationMasks?: ElevationMask[];

  /** FOV shape type (default: ELLIPTICAL_CONE) */
  shape?: FovShape;
  /** Reference frame for boresight (default: TOPOCENTRIC) */
  frame?: FovFrame;
}

/**
 * Orthonormal basis representing the boresight frame.
 * Used for transforming target directions into boresight-relative coordinates.
 */
export interface BoresightFrame {
  /** Boresight direction (unit vector) */
  b: Vector3D;
  /** Major axis direction (unit vector, perpendicular to boresight) */
  u: Vector3D;
  /** Minor axis direction (unit vector, perpendicular to both b and u) */
  v: Vector3D;
}

/**
 * Constructs a boresight frame from azimuth, elevation, and roll angles.
 *
 * The frame is constructed using the ENU (East-North-Up) convention:
 * - Azimuth 0° is North, 90° is East
 * - Elevation 0° is horizontal, 90° is zenith
 * - Roll 0° means major axis aligns with the projection of "up" onto the
 *   plane perpendicular to boresight
 *
 * @param az - Boresight azimuth in radians
 * @param el - Boresight elevation in radians
 * @param roll - Roll angle in radians
 * @returns Orthonormal boresight frame
 */
export function boresightFrameFromAzElRoll(az: Radians, el: Radians, roll: Radians): BoresightFrame {
  // Convert az/el to unit vector in ENU frame
  // ENU: x=East, y=North, z=Up
  // az=0 is North (+y), az=90 is East (+x)
  const cosEl = Math.cos(el);
  const sinEl = Math.sin(el);
  const cosAz = Math.cos(az);
  const sinAz = Math.sin(az);

  const b = new Vector3D(
    cosEl * sinAz, // East component
    cosEl * cosAz, // North component
    sinEl, // Up component
  );

  // Handle zenith singularity (elevation = 90°)
  if (Math.abs(el - HALF_PI) < EPS) {
    // Boresight is straight up - use roll to define frame orientation
    // At zenith, major axis direction is determined by roll from North
    const u = new Vector3D(Math.sin(roll), Math.cos(roll), 0);
    const v = new Vector3D(Math.cos(roll), -Math.sin(roll), 0);

    return { b, u, v };
  }

  // Normal case: construct frame using "up" as reference
  const up = Vector3D.zAxis;

  // v_temp points "right" when looking along boresight (perpendicular to both boresight and up)
  let vTemp = up.cross(b).normalize();

  // u points in the "up" direction relative to boresight (perpendicular to both boresight and v_temp)
  let u = b.cross(vTemp).normalize();

  // Apply roll rotation around boresight
  if (Math.abs(roll) > EPS) {
    const cosRoll = Math.cos(roll);
    const sinRoll = Math.sin(roll);

    // Rotate u and v around b by roll angle
    const uNew = new Vector3D(
      cosRoll * u.x + sinRoll * vTemp.x,
      cosRoll * u.y + sinRoll * vTemp.y,
      cosRoll * u.z + sinRoll * vTemp.z,
    );
    const vNew = new Vector3D(
      cosRoll * vTemp.x - sinRoll * u.x,
      cosRoll * vTemp.y - sinRoll * u.y,
      cosRoll * vTemp.z - sinRoll * u.z,
    );

    u = uNew;
    vTemp = vNew;
  }

  return { b, u, v: vTemp };
}

/**
 * Converts azimuth/elevation to a unit vector in ENU (East-North-Up) frame.
 *
 * @param az - Azimuth in radians (0 = North, π/2 = East)
 * @param el - Elevation in radians (0 = horizon, π/2 = zenith)
 * @returns Unit vector in ENU frame
 */
function azElToUnitVector(az: Radians, el: Radians): Vector3D {
  const cosEl = Math.cos(el);

  return new Vector3D(
    cosEl * Math.sin(az), // East
    cosEl * Math.cos(az), // North
    Math.sin(el), // Up
  );
}

/**
 * Boresight-centric field of view using elliptical cone geometry.
 *
 * Defines a sensor's FOV as an elliptical cone around a boresight direction,
 * with optional azimuth-dependent elevation masking for terrain/obstructions.
 *
 * @example
 * ```typescript
 * // Circular cone pointing at zenith
 * const fov = new FieldOfView({
 *   halfAngle: 45 as Degrees,
 *   minRange: 100 as Kilometers,
 *   maxRange: 50000 as Kilometers,
 * });
 *
 * // Elliptical fan-shaped FOV (phased array radar)
 * const fanFov = new FieldOfView({
 *   boresightEl: 90 as Degrees,
 *   halfAngle: 90 as Degrees,       // 90° in major direction
 *   minorHalfAngle: 2 as Degrees,   // 2° in minor direction
 *   rollAngle: 0 as Degrees,        // Major axis aligned N-S
 *   minRange: 100 as Kilometers,
 *   maxRange: 50000 as Kilometers,
 * });
 *
 * // Check if target is visible
 * const rae = { rng: 1000, az: 45, el: 30 };
 * if (fov.contains(rae)) {
 *   console.log('Target is in FOV');
 * }
 * ```
 */
export class FieldOfView {
  /** Boresight azimuth in degrees */
  readonly boresightAz: Degrees;
  /** Boresight elevation in degrees */
  readonly boresightEl: Degrees;
  /** Major half-angle in degrees */
  readonly halfAngle: Degrees;
  /** Minor half-angle in degrees */
  readonly minorHalfAngle: Degrees;
  /** Roll angle in degrees */
  readonly rollAngle: Degrees;
  /** Minimum range in kilometers */
  readonly minRange: Kilometers;
  /** Maximum range in kilometers */
  readonly maxRange: Kilometers;
  /** Global minimum elevation in degrees */
  readonly minElevation: Degrees;
  /** Azimuth-specific elevation masks */
  readonly elevationMasks: ElevationMask[];
  /** FOV shape type */
  readonly shape: FovShape;
  /** Reference frame for boresight */
  readonly frame: FovFrame;

  /** Cached boresight frame for performance */
  private readonly boresightFrame_: BoresightFrame;
  /** Cached half angles in radians */
  private readonly halfAngleRad_: Radians;
  private readonly minorHalfAngleRad_: Radians;

  constructor(params: FieldOfViewParams) {
    this.validate(params);

    this.boresightAz = params.boresightAz ?? (0 as Degrees);
    this.boresightEl = params.boresightEl ?? (90 as Degrees);
    this.halfAngle = params.halfAngle;
    this.minorHalfAngle = params.minorHalfAngle ?? params.halfAngle;
    this.rollAngle = params.rollAngle ?? (0 as Degrees);
    this.minRange = params.minRange;
    this.maxRange = params.maxRange;
    this.minElevation = params.minElevation ?? (0 as Degrees);
    this.elevationMasks = params.elevationMasks ?? [];
    this.shape = params.shape ?? FovShape.ELLIPTICAL_CONE;
    this.frame = params.frame ?? FovFrame.TOPOCENTRIC;

    // Cache boresight frame
    this.boresightFrame_ = boresightFrameFromAzElRoll(
      (this.boresightAz * DEG2RAD) as Radians,
      (this.boresightEl * DEG2RAD) as Radians,
      (this.rollAngle * DEG2RAD) as Radians,
    );

    // Cache half angles in radians
    this.halfAngleRad_ = (this.halfAngle * DEG2RAD) as Radians;
    this.minorHalfAngleRad_ = (this.minorHalfAngle * DEG2RAD) as Radians;
  }

  /**
   * Creates a hemisphere FOV (all-sky coverage above minimum elevation).
   * @param minRange - Minimum range in kilometers
   * @param maxRange - Maximum range in kilometers
   * @param minEl - Minimum elevation (default: 0°)
   * @returns FieldOfView covering the hemisphere
   */
  static hemisphere(
    minRange: Kilometers,
    maxRange: Kilometers,
    minEl: Degrees = 0 as Degrees,
  ): FieldOfView {
    return new FieldOfView({
      boresightAz: 0 as Degrees,
      boresightEl: 90 as Degrees,
      halfAngle: 90 as Degrees,
      minRange,
      maxRange,
      minElevation: minEl,
    });
  }

  /**
   * Creates a circular cone FOV.
   * @param boresightAz - Boresight azimuth in degrees
   * @param boresightEl - Boresight elevation in degrees
   * @param halfAngle - Cone half-angle in degrees
   * @param minRange - Minimum range in kilometers
   * @param maxRange - Maximum range in kilometers
   * @returns FieldOfView with circular cone
   */
  static circularCone(
    boresightAz: Degrees,
    boresightEl: Degrees,
    halfAngle: Degrees,
    minRange: Kilometers,
    maxRange: Kilometers,
  ): FieldOfView {
    return new FieldOfView({
      boresightAz,
      boresightEl,
      halfAngle,
      minRange,
      maxRange,
      shape: FovShape.CIRCULAR_CONE,
    });
  }

  /**
   * Checks if the given RAE coordinates are within this field of view.
   *
   * Performs the following checks in order:
   * 1. Range bounds
   * 2. Elevation masking (global and azimuth-specific)
   * 3. Elliptical cone containment
   *
   * @param rae - The RAE coordinates to check
   * @returns True if the coordinates are within the FOV
   */
  contains(rae: RaeVec3<Kilometers, Degrees>): boolean {
    // Check range bounds
    if (rae.rng < this.minRange || rae.rng > this.maxRange) {
      return false;
    }

    // Check elevation against effective minimum at this azimuth
    const effectiveMinEl = this.getMinElevation(rae.az);

    if (rae.el < effectiveMinEl) {
      return false;
    }

    // Check if within cone geometry
    return this.isWithinCone(rae.az, rae.el);
  }

  /**
   * Checks if a direction vector is within the FOV angular bounds.
   * For body-frame sensors receiving body-frame directions.
   *
   * @param direction - Direction vector to target (will be normalized)
   * @param range - Range to target in kilometers
   * @returns True if within FOV
   */
  containsDirection(direction: Vector3D, range: Kilometers): boolean {
    // Check range bounds
    if (range < this.minRange || range > this.maxRange) {
      return false;
    }

    const targetDir = direction.normalize();

    return this.isDirectionWithinCone(targetDir);
  }

  /**
   * Gets the effective minimum elevation at a given azimuth.
   * Considers all applicable elevation masks and returns the most restrictive.
   *
   * @param az - Azimuth in degrees
   * @returns Effective minimum elevation in degrees
   */
  getMinElevation(az: Degrees): Degrees {
    let effectiveMinEl = this.minElevation;

    for (const mask of this.elevationMasks) {
      if (this.isAzimuthInMaskRange(az, mask)) {
        // Use the most restrictive (highest) minimum elevation
        if (mask.minEl > effectiveMinEl) {
          effectiveMinEl = mask.minEl;
        }
      }
    }

    return effectiveMinEl;
  }

  /**
   * Returns the boresight as a unit vector in the topocentric (ENU) frame.
   */
  get boresightVector(): Vector3D {
    return this.boresightFrame_.b;
  }

  /**
   * Calculates the angular offset from boresight to a target.
   * @param az - Target azimuth in degrees
   * @param el - Target elevation in degrees
   * @returns Angular offset in degrees
   */
  angularOffset(az: Degrees, el: Degrees): Degrees {
    const targetDir = azElToUnitVector(
      (az * DEG2RAD) as Radians,
      (el * DEG2RAD) as Radians,
    );
    const angle = this.boresightFrame_.b.angle(targetDir);

    return (angle * RAD2DEG) as Degrees;
  }

  /**
   * Returns true if the FOV is circular (major = minor half-angle).
   */
  get isCircular(): boolean {
    return Math.abs(this.halfAngle - this.minorHalfAngle) < EPS;
  }

  /**
   * Gets the full angular coverage (2 * halfAngle) in degrees.
   * For scanning radars, this represents the sweep width.
   */
  get angularCoverage(): Degrees {
    return (2 * this.halfAngle) as Degrees;
  }

  /**
   * Checks if this FOV is configured for deep space observation.
   * Deep space is defined as max range > 6000 km.
   */
  isDeepSpace(): boolean {
    return this.maxRange > DEEP_SPACE_THRESHOLD_KM;
  }

  /**
   * Checks if this FOV is configured for near-Earth observation.
   * Near Earth is defined as max range <= 6000 km.
   */
  isNearEarth(): boolean {
    return this.maxRange <= DEEP_SPACE_THRESHOLD_KM;
  }

  /**
   * Creates a serializable representation of this FOV.
   */
  serialize(): FieldOfViewParams {
    return {
      boresightAz: this.boresightAz,
      boresightEl: this.boresightEl,
      halfAngle: this.halfAngle,
      minorHalfAngle: this.minorHalfAngle,
      rollAngle: this.rollAngle,
      minRange: this.minRange,
      maxRange: this.maxRange,
      minElevation: this.minElevation,
      elevationMasks: this.elevationMasks.length > 0 ? [...this.elevationMasks] : undefined,
      shape: this.shape,
      frame: this.frame,
    };
  }

  /**
   * Returns a string representation of this FOV.
   */
  toString(): string {
    const shapeStr = this.isCircular
      ? `${this.halfAngle.toFixed(1)}° cone`
      : `${this.halfAngle.toFixed(1)}° × ${this.minorHalfAngle.toFixed(1)}° ellipse`;

    const rollStr = this.rollAngle === 0 ? '' : `, roll ${this.rollAngle.toFixed(1)}°`;

    const lines = [
      '[FieldOfView]',
      `  Boresight: Az ${this.boresightAz.toFixed(1)}°, El ${this.boresightEl.toFixed(1)}°`,
      `  Shape: ${shapeStr}${rollStr}`,
      `  Range: ${this.minRange.toFixed(1)} - ${this.maxRange.toFixed(1)} km`,
      `  Min Elevation: ${this.minElevation.toFixed(1)}°`,
    ];

    if (this.elevationMasks.length > 0) {
      lines.push(`  Elevation Masks: ${this.elevationMasks.length} defined`);
    }

    return lines.join('\n');
  }

  /**
   * Checks if an azimuth falls within an elevation mask's range.
   * Handles wraparound (e.g., 350° to 10°).
   */
  private isAzimuthInMaskRange(az: Degrees, mask: ElevationMask): boolean {
    if (mask.startAz <= mask.stopAz) {
      // Normal case: startAz <= az <= stopAz
      return az >= mask.startAz && az <= mask.stopAz;
    }

    // Wraparound case: az >= startAz OR az <= stopAz
    return az >= mask.startAz || az <= mask.stopAz;
  }

  /**
   * Core containment check for cone geometry using az/el.
   */
  private isWithinCone(az: Degrees, el: Degrees): boolean {
    const targetDir = azElToUnitVector(
      (az * DEG2RAD) as Radians,
      (el * DEG2RAD) as Radians,
    );

    return this.isDirectionWithinCone(targetDir);
  }

  /**
   * Core containment check for cone geometry using direction vector.
   */
  private isDirectionWithinCone(targetDir: Vector3D): boolean {
    const { b, u, v } = this.boresightFrame_;

    // Compute off-boresight angle
    const theta = b.angle(targetDir);

    // Target on boresight is always in FOV
    if (theta < EPS) {
      return true;
    }

    // Target behind sensor (> 90° from boresight) is never in FOV
    if (theta > HALF_PI) {
      return false;
    }

    // For circular cone, simple angle check
    if (this.isCircular || this.shape === FovShape.CIRCULAR_CONE) {
      return theta <= this.halfAngleRad_;
    }

    // For elliptical cone, project onto u-v plane and check ellipse equation
    // Get component of target in the plane perpendicular to boresight
    const dotB = targetDir.dot(b);
    const perpComponent = new Vector3D(
      targetDir.x - dotB * b.x,
      targetDir.y - dotB * b.y,
      targetDir.z - dotB * b.z,
    );

    const perpMag = perpComponent.magnitude();

    if (perpMag < EPS) {
      // Target is along boresight
      return true;
    }

    // Project onto u and v axes to get phi
    const perpNorm = perpComponent.normalize();
    const uComponent = perpNorm.dot(u);
    const vComponent = perpNorm.dot(v);
    const phi = Math.atan2(vComponent, uComponent);

    // Check ellipse equation: (theta*cos(phi)/major)² + (theta*sin(phi)/minor)² <= 1
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const normalizedMajor = (theta * cosPhi) / this.halfAngleRad_;
    const normalizedMinor = (theta * sinPhi) / this.minorHalfAngleRad_;

    return (normalizedMajor * normalizedMajor + normalizedMinor * normalizedMinor) <= 1.0;
  }

  /**
   * Validates FOV parameters.
   */
  private validate(params: FieldOfViewParams): void {
    // Validate half angle
    if (params.halfAngle <= 0 || params.halfAngle > 90) {
      throw new ValidationError('Half angle must be between 0 and 90 degrees', 'halfAngle', params.halfAngle);
    }

    // Validate minor half angle if provided
    if (params.minorHalfAngle !== undefined) {
      if (params.minorHalfAngle <= 0 || params.minorHalfAngle > 90) {
        throw new ValidationError(
          'Minor half angle must be between 0 and 90 degrees',
          'minorHalfAngle',
          params.minorHalfAngle,
        );
      }
    }

    // Validate boresight azimuth
    if (params.boresightAz !== undefined) {
      if (params.boresightAz < 0 || params.boresightAz >= 360) {
        throw new ValidationError(
          'Boresight azimuth must be between 0 and 360 degrees',
          'boresightAz',
          params.boresightAz,
        );
      }
    }

    // Validate boresight elevation
    if (params.boresightEl !== undefined) {
      if (params.boresightEl < -90 || params.boresightEl > 90) {
        throw new ValidationError(
          'Boresight elevation must be between -90 and 90 degrees',
          'boresightEl',
          params.boresightEl,
        );
      }
    }

    // Validate range
    if (params.minRange < 0) {
      throw new ValidationError('Minimum range must be greater than or equal to 0', 'minRange', params.minRange);
    }
    if (params.maxRange <= 0) {
      throw new ValidationError('Maximum range must be greater than 0', 'maxRange', params.maxRange);
    }
    if (params.minRange > params.maxRange) {
      throw new ValidationError(
        'Minimum range cannot exceed maximum range',
        'minRange',
        { min: params.minRange, max: params.maxRange },
      );
    }

    // Validate minimum elevation
    if (params.minElevation !== undefined) {
      if (params.minElevation < -90 || params.minElevation > 90) {
        throw new ValidationError(
          'Minimum elevation must be between -90 and 90 degrees',
          'minElevation',
          params.minElevation,
        );
      }
    }

    // Validate elevation masks
    if (params.elevationMasks) {
      for (const mask of params.elevationMasks) {
        if (mask.startAz < 0 || mask.startAz >= 360) {
          throw new ValidationError(
            'Elevation mask start azimuth must be between 0 and 360',
            'elevationMasks.startAz',
            mask.startAz,
          );
        }
        if (mask.stopAz < 0 || mask.stopAz >= 360) {
          throw new ValidationError(
            'Elevation mask stop azimuth must be between 0 and 360',
            'elevationMasks.stopAz',
            mask.stopAz,
          );
        }
        if (mask.minEl < -90 || mask.minEl > 90) {
          throw new ValidationError(
            'Elevation mask minimum elevation must be between -90 and 90',
            'elevationMasks.minEl',
            mask.minEl,
          );
        }
      }
    }
  }
}
