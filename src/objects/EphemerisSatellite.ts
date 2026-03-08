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

import type { ClassicalElements } from '../coordinate/ClassicalElements';
import type { ITRF } from '../coordinate/ITRF';
import { J2000 } from '../coordinate/J2000';
import type { TEME } from '../coordinate/TEME';
import { CubicSplineInterpolator } from '../interpolator/CubicSplineInterpolator';
import { LagrangeInterpolator } from '../interpolator/LagrangeInterpolator';
import type { StateInterpolator } from '../interpolator/StateInterpolator';
import { VerletBlendInterpolator } from '../interpolator/VerletBlendInterpolator';
import { OemParser } from '../parsers/OemParser';
import type { ParsedOem } from '../parsers/OemTypes';
import { EpochUTC } from '../time/EpochUTC';
import type { EpochWindow } from '../time/EpochWindow';
import {
  Degrees,
  EcefVec3,
  Kilometers,
  KilometersPerSecond,
  LlaVec3,
  PosVel,
  Seconds,
  SpaceObjectType,
} from '../types/types';
import { linearInterpolate } from '../utils/functions';
import { CenterBody, CenterBodyMu, parseCenterBody } from './CenterBody';
import { DEFAULT_INTERPOLATOR, DEFAULT_LAGRANGE_ORDER, InterpolatorType } from './InterpolatorType';
import { SpaceObject, SpaceObjectParams } from './SpaceObject';

/**
 * Parameters for constructing an EphemerisSatellite.
 */
export interface EphemerisSatelliteParams extends Omit<SpaceObjectParams, 'position' | 'velocity' | 'type'> {
  /** Array of J2000 state vectors forming the ephemeris */
  ephemeris: J2000[];
  /** Center body for the ephemeris (defaults to EARTH) */
  centerBody?: CenterBody;
  /** Reference frame of the ephemeris data (defaults to J2000) */
  referenceFrame?: 'J2000' | 'TEME';
  /** Interpolator type to use (defaults to LAGRANGE) */
  interpolatorType?: InterpolatorType;
  /** Interpolation order for Lagrange (defaults to 10) */
  interpolatorOrder?: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A satellite with position determined by interpolation of pre-computed ephemeris data.
 *
 * Unlike TLE-based satellites that use SGP4 propagation, EphemerisSatellite stores
 * a set of state vectors and interpolates between them to determine position at
 * any given time within the coverage window.
 *
 * @example
 * ```typescript
 * // Create from OEM file
 * const oemContent = fs.readFileSync('orbit.oem', 'utf-8');
 * const parsed = OemParser.parse(oemContent);
 * const sat = EphemerisSatellite.fromParsedOem(parsed);
 *
 * // Get position at specific time
 * const state = sat.getJ2000(EpochUTC.fromDateTimeString('2024-06-15T12:00:00Z'));
 * ```
 */
export class EphemerisSatellite extends SpaceObject {
  private readonly interpolator_: StateInterpolator;
  private readonly interpolatorType_: InterpolatorType;
  private readonly ephemeris_: J2000[];
  private readonly centerBody_: CenterBody;
  private readonly referenceFrame_: 'J2000' | 'TEME';

  constructor(params: EphemerisSatelliteParams) {
    if (!params.ephemeris || params.ephemeris.length === 0) {
      throw new Error('Ephemeris array cannot be empty');
    }

    const lastState = params.ephemeris[params.ephemeris.length - 1];
    const teme = lastState.toTEME();

    super({
      ...params,
      type: SpaceObjectType.EPHEMERIS_SATELLITE,
      position: {
        x: teme.position.x,
        y: teme.position.y,
        z: teme.position.z,
      },
      velocity: {
        x: teme.velocity.x,
        y: teme.velocity.y,
        z: teme.velocity.z,
      },
    });

    this.ephemeris_ = params.ephemeris;
    this.centerBody_ = params.centerBody ?? CenterBody.EARTH;
    this.referenceFrame_ = params.referenceFrame ?? 'J2000';
    this.metadata = params.metadata;
    this.interpolatorType_ = params.interpolatorType ?? DEFAULT_INTERPOLATOR;

    this.interpolator_ = this.createInterpolator_(
      this.interpolatorType_,
      params.interpolatorOrder ?? DEFAULT_LAGRANGE_ORDER,
    );
  }

  // ==================== Factory Methods ====================

  /**
   * Create from parsed OEM data.
   * @param oem - Parsed OEM structure
   * @param options - Optional configuration
   * @returns New EphemerisSatellite instance
   */
  static fromParsedOem(
    oem: ParsedOem,
    options?: {
      id?: number;
      interpolatorType?: InterpolatorType;
    },
  ): EphemerisSatellite {
    const firstBlock = oem.dataBlocks[0];

    if (!firstBlock || firstBlock.ephemeris.length === 0) {
      throw new Error('OEM contains no ephemeris data');
    }

    // Combine all ephemeris from all data blocks
    const allEphemeris = oem.dataBlocks.flatMap((block) => block.ephemeris);

    // Determine interpolator from OEM metadata or use provided
    const interpolatorType =
      options?.interpolatorType ?? OemParser.getRecommendedInterpolator(firstBlock.metadata);
    const order = OemParser.getInterpolationOrder(firstBlock.metadata);

    return new EphemerisSatellite({
      id: options?.id ?? -1,
      name: firstBlock.metadata.OBJECT_NAME ?? 'Unnamed',
      ephemeris: allEphemeris,
      centerBody: parseCenterBody(firstBlock.metadata.CENTER_NAME),
      referenceFrame: firstBlock.metadata.REF_FRAME === 'TEME' ? 'TEME' : 'J2000',
      interpolatorType,
      interpolatorOrder: order,
      metadata: {
        originator: oem.header.ORIGINATOR,
        creationDate: oem.header.CREATION_DATE,
        objectId: firstBlock.metadata.OBJECT_ID,
      },
    });
  }

  /**
   * Create from raw ephemeris array (simple factory).
   * @param name - Name for the satellite
   * @param ephemeris - Array of J2000 state vectors
   * @param options - Optional configuration
   * @returns New EphemerisSatellite instance
   */
  static fromEphemeris(
    name: string,
    ephemeris: J2000[],
    options?: {
      id?: number;
      centerBody?: CenterBody;
      interpolatorType?: InterpolatorType;
    },
  ): EphemerisSatellite {
    return new EphemerisSatellite({
      id: options?.id ?? -1,
      name,
      ephemeris,
      centerBody: options?.centerBody,
      interpolatorType: options?.interpolatorType,
    });
  }

  // ==================== Position Queries ====================

  /**
   * Returns the position and velocity in TEME frame at the given time.
   * @param date - The time to calculate position for (defaults to now)
   * @returns Position and velocity, or null if outside coverage window
   */
  override eci(date?: Date): PosVel | null {
    const epoch = date ? EpochUTC.fromDateTime(date) : EpochUTC.now();
    const state = this.interpolator_.interpolate(epoch);

    if (!state) {
      return null;
    }

    const teme = this.referenceFrame_ === 'J2000' ? state.toTEME() : (state as unknown as TEME);

    // Update cached position/velocity
    this.position = {
      x: teme.position.x,
      y: teme.position.y,
      z: teme.position.z,
    };
    this.velocity = {
      x: teme.velocity.x,
      y: teme.velocity.y,
      z: teme.velocity.z,
    };

    return {
      position: { x: teme.position.x, y: teme.position.y, z: teme.position.z },
      velocity: { x: teme.velocity.x, y: teme.velocity.y, z: teme.velocity.z },
    };
  }

  /**
   * Returns the ECEF position at the given time.
   * @param date - The time to calculate position for (defaults to now)
   */
  override ecef(date?: Date): EcefVec3<Kilometers> | null {
    const j2000 = this.toJ2000(date);

    if (!j2000) {
      return null;
    }

    const itrf = j2000.toITRF();

    return {
      x: itrf.position.x,
      y: itrf.position.y,
      z: itrf.position.z,
    };
  }

  /**
   * Returns the geodetic position (lat/lon/alt) at the given time.
   * @param date - The time to calculate position for (defaults to now)
   */
  override lla(date?: Date): LlaVec3<Degrees, Kilometers> | null {
    const j2000 = this.toJ2000(date);

    if (!j2000) {
      return null;
    }

    const itrf = j2000.toITRF();
    const lla = itrf.toGeodetic();

    return {
      lat: lla.latDeg as Degrees,
      lon: lla.lonDeg as Degrees,
      alt: lla.alt,
    };
  }

  /**
   * Get state in J2000 frame at given epoch.
   * @param epoch - The epoch to interpolate at
   * @returns J2000 state vector or null if outside coverage
   */
  getJ2000(epoch: EpochUTC): J2000 | null {
    const state = this.interpolator_.interpolate(epoch);

    if (!state) {
      return null;
    }

    // If stored as TEME, convert to J2000
    if (this.referenceFrame_ === 'TEME') {
      return (state as unknown as TEME).toJ2000();
    }

    return state;
  }

  /**
   * Get state in TEME frame at given epoch.
   * @param epoch - The epoch to interpolate at
   * @returns TEME state vector or null if outside coverage
   */
  getTEME(epoch: EpochUTC): TEME | null {
    const state = this.interpolator_.interpolate(epoch);

    if (!state) {
      return null;
    }

    if (this.referenceFrame_ === 'J2000') {
      return state.toTEME();
    }

    return state as unknown as TEME;
  }

  // ==================== Coordinate Conversions ====================

  /**
   * Returns J2000 coordinates at the given time.
   * @param date - The time to calculate for (defaults to now)
   * @throws Error if the date is outside the coverage window
   */
  override toJ2000(date?: Date): J2000 {
    const epoch = date ? EpochUTC.fromDateTime(date) : EpochUTC.now();
    const state = this.getJ2000(epoch);

    if (!state) {
      throw new Error(`Date ${epoch.toString()} is outside ephemeris coverage window`);
    }

    return state;
  }

  /**
   * Returns ITRF coordinates at the given time.
   * @param date - The time to calculate for (defaults to now)
   * @throws Error if the date is outside the coverage window
   */
  override toITRF(date?: Date): ITRF {
    const j2000 = this.toJ2000(date);

    return j2000.toITRF();
  }

  /**
   * Returns classical orbital elements at the given time.
   * @param date - The time to calculate for (defaults to now)
   * @throws Error if the date is outside the coverage window
   */
  override toClassicalElements(date?: Date): ClassicalElements {
    const j2000 = this.toJ2000(date);

    return j2000.toClassicalElements(this.mu);
  }

  // ==================== Coverage Window ====================

  /**
   * Returns the time window covered by the ephemeris data.
   */
  get coverageWindow(): EpochWindow {
    return this.interpolator_.window();
  }

  /**
   * Check if a given epoch is within the coverage window.
   * @param epoch - The epoch to check
   */
  inCoverage(epoch: EpochUTC): boolean {
    return this.interpolator_.inWindow(epoch);
  }

  // ==================== Center Body ====================

  /** The center body for this ephemeris */
  get centerBody(): CenterBody {
    return this.centerBody_;
  }

  /** Gravitational parameter (km³/s²) for the center body */
  get mu(): number {
    return CenterBodyMu[this.centerBody_];
  }

  // ==================== WebGL-Optimized Orbit Path ====================

  /**
   * Generate orbit path as Float32Array for WebGL rendering.
   * Format: [x0, y0, z0, t0, x1, y1, z1, t1, ...] (4 floats per point)
   *
   * @param sampleCount - Number of points to generate
   * @param startEpoch - Start of path (defaults to coverage start)
   * @param endEpoch - End of path (defaults to coverage end)
   * @returns Float32Array with position and time data
   */
  getOrbitPath(sampleCount: number, startEpoch?: EpochUTC, endEpoch?: EpochUTC): Float32Array {
    const window = this.coverageWindow;
    const start = startEpoch ?? window.start;
    const end = endEpoch ?? window.end;

    const duration = end.difference(start);
    const step = duration / (sampleCount - 1);

    const path = new Float32Array(sampleCount * 4);

    for (let i = 0; i < sampleCount; i++) {
      const epoch = start.roll((step * i) as Seconds);
      const state = this.interpolator_.interpolate(epoch);

      if (state) {
        const teme = this.referenceFrame_ === 'J2000' ? state.toTEME() : state;

        path[i * 4] = teme.position.x;
        path[i * 4 + 1] = teme.position.y;
        path[i * 4 + 2] = teme.position.z;
        path[i * 4 + 3] = epoch.posix;
      }
    }

    return path;
  }

  /**
   * Get raw ephemeris points as Float32Array for WebGL.
   * More efficient than interpolated path when original points suffice.
   * Format: [x0, y0, z0, t0, x1, y1, z1, t1, ...] (4 floats per point)
   */
  getEphemerisAsFloat32(): Float32Array {
    const path = new Float32Array(this.ephemeris_.length * 4);

    for (let i = 0; i < this.ephemeris_.length; i++) {
      const state = this.ephemeris_[i];
      const teme = this.referenceFrame_ === 'J2000' ? state.toTEME() : state;

      path[i * 4] = teme.position.x;
      path[i * 4 + 1] = teme.position.y;
      path[i * 4 + 2] = teme.position.z;
      path[i * 4 + 3] = state.epoch.posix;
    }

    return path;
  }

  // ==================== Fast Linear Interpolation ====================

  /**
   * Fast linear interpolation between adjacent ephemeris points.
   * Use for real-time animation where speed > accuracy.
   * For analysis, use getJ2000() which uses the configured StateInterpolator.
   *
   * @param epoch - The epoch to interpolate at
   * @returns Position, velocity, and state vector index, or null if outside coverage
   */
  getLinearInterpolatedState(epoch: EpochUTC): {
    position: { x: Kilometers; y: Kilometers; z: Kilometers };
    velocity: { x: KilometersPerSecond; y: KilometersPerSecond; z: KilometersPerSecond };
    stateVectorIndex: number;
  } | null {
    const posix = epoch.posix;

    // Binary search for bracketing points
    const idx = this.findBracketingIndex_(posix);

    if (idx === null) {
      return null;
    }

    const current = this.ephemeris_[idx];
    const next = this.ephemeris_[idx + 1] ?? current;

    const t0 = current.epoch.posix;
    const t1 = next.epoch.posix;

    // Convert to TEME for output
    const currentTeme = this.referenceFrame_ === 'J2000' ? current.toTEME() : current;
    const nextTeme = this.referenceFrame_ === 'J2000' ? next.toTEME() : next;

    // Linear interpolation using ootk utility
    const position = {
      x: linearInterpolate(posix, t0, currentTeme.position.x, t1, nextTeme.position.x) as Kilometers,
      y: linearInterpolate(posix, t0, currentTeme.position.y, t1, nextTeme.position.y) as Kilometers,
      z: linearInterpolate(posix, t0, currentTeme.position.z, t1, nextTeme.position.z) as Kilometers,
    };

    // Velocity from current point (no interpolation needed for animation)
    const velocity = {
      x: currentTeme.velocity.x,
      y: currentTeme.velocity.y,
      z: currentTeme.velocity.z,
    };

    return { position, velocity, stateVectorIndex: idx };
  }

  private findBracketingIndex_(posix: number): number | null {
    const n = this.ephemeris_.length;

    if (n === 0) {
      return null;
    }
    if (posix < this.ephemeris_[0].epoch.posix) {
      return null;
    }
    if (posix >= this.ephemeris_[n - 1].epoch.posix) {
      return n - 1;
    }

    // Binary search
    let left = 0;
    let right = n - 1;

    while (left <= right) {
      const mid = (left + right) >>> 1;
      const t = this.ephemeris_[mid].epoch.posix;
      const tNext = this.ephemeris_[mid + 1]?.epoch.posix ?? Infinity;

      if (t <= posix && posix < tNext) {
        return mid;
      } else if (posix < t) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return null;
  }

  // ==================== Ephemeris Access ====================

  /** Number of state vectors in the ephemeris */
  get ephemerisLength(): number {
    return this.ephemeris_.length;
  }

  /**
   * Get original ephemeris point closest to given epoch.
   * Useful for accessing "truth" data without interpolation.
   * @param epoch - The epoch to find the nearest point for
   */
  getNearestEphemerisPoint(epoch: EpochUTC): J2000 | null {
    if (this.ephemeris_.length === 0) {
      return null;
    }

    const posix = epoch.posix;
    let closest = this.ephemeris_[0];
    let minDiff = Math.abs(closest.epoch.posix - posix);

    for (const point of this.ephemeris_) {
      const diff = Math.abs(point.epoch.posix - posix);

      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }

    return closest;
  }

  /** Size in bytes of the interpolator's cached data */
  get interpolatorSizeBytes(): number {
    return this.interpolator_.sizeBytes;
  }

  // ==================== Cloning ====================

  /**
   * Creates a deep copy of this satellite.
   * @param _options - Unused, provided for compatibility with base class
   */
  override clone(_options?: Record<string, unknown>): EphemerisSatellite {
    return new EphemerisSatellite({
      id: this.id,
      name: this.name,
      ephemeris: [...this.ephemeris_],
      centerBody: this.centerBody_,
      referenceFrame: this.referenceFrame_,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }

  // ==================== Serialization ====================

  protected serializeSpecific(): Record<string, unknown> {
    const window = this.coverageWindow;

    return {
      centerBody: this.centerBody_,
      referenceFrame: this.referenceFrame_,
      ephemerisLength: this.ephemeris_.length,
      coverageStart: new Date(window.start.posix * 1000).toISOString(),
      coverageEnd: new Date(window.end.posix * 1000).toISOString(),
    };
  }

  toString(): string {
    const window = this.coverageWindow;
    const coverageStart = new Date(window.start.posix * 1000).toISOString();
    const coverageEnd = new Date(window.end.posix * 1000).toISOString();

    return [
      '[EphemerisSatellite]',
      `  ID: ${this.id}`,
      `  Name: ${this.name}`,
      `  Center Body: ${this.centerBody_}`,
      `  Reference Frame: ${this.referenceFrame_}`,
      `  Interpolator: ${this.interpolatorType_}`,
      `  Ephemeris Points: ${this.ephemeris_.length}`,
      `  Coverage: ${coverageStart} - ${coverageEnd}`,
    ].join('\n');
  }

  // ==================== Private Methods ====================

  private createInterpolator_(type: InterpolatorType, order: number): StateInterpolator {
    switch (type) {
      case InterpolatorType.LAGRANGE:
        return LagrangeInterpolator.fromEphemeris(this.ephemeris_, order);
      case InterpolatorType.CUBIC_SPLINE:
        return CubicSplineInterpolator.fromEphemeris(this.ephemeris_);
      case InterpolatorType.VERLET_BLEND:
        return new VerletBlendInterpolator(this.ephemeris_);
      case InterpolatorType.CHEBYSHEV:
        // Chebyshev requires pre-computed coefficients via lossy compression
        // Fall back to Lagrange for now
        // TODO: Add ChebyshevInterpolator.fromEphemeris() with compression
        return LagrangeInterpolator.fromEphemeris(this.ephemeris_, order);
      default:
        return LagrangeInterpolator.fromEphemeris(this.ephemeris_, order);
    }
  }
}
