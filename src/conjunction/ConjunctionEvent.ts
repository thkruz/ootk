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

import type { J2000 } from '../coordinate/J2000';
import type { RIC } from '../coordinate/RIC';
import type { StateCovariance } from '../covariance/StateCovariance';
import type { Kilometers, KilometersPerSecond } from '../types/types';
import { Matrix } from '../operations/Matrix';
import type { EpochUTC } from '../time/EpochUTC';

/** Maneuverability flag of a conjunction object (CCSDS 508.0-B-1 MANEUVERABLE). */
export type ConjunctionManeuverable = 'YES' | 'NO' | 'N/A';

/**
 * Screening volume and screening period of a conjunction (CCSDS 508.0-B-1 Table 3-2 relative
 * metadata). Lengths are in km (the CDM carries them in m).
 */
export interface ConjunctionScreenVolume {
  /** START_SCREEN_PERIOD, ISO 8601 UTC */
  startScreenPeriod?: string;
  /** STOP_SCREEN_PERIOD, ISO 8601 UTC */
  stopScreenPeriod?: string;
  /** SCREEN_VOLUME_FRAME: RTN or TVN */
  frame?: 'RTN' | 'TVN';
  /** SCREEN_VOLUME_SHAPE: ELLIPSOID or BOX */
  shape?: 'ELLIPSOID' | 'BOX';
  /** SCREEN_VOLUME_X (km) */
  x?: Kilometers;
  /** SCREEN_VOLUME_Y (km) */
  y?: Kilometers;
  /** SCREEN_VOLUME_Z (km) */
  z?: Kilometers;
  /** SCREEN_ENTRY_TIME, ISO 8601 UTC */
  entryTime?: string;
  /** SCREEN_EXIT_TIME, ISO 8601 UTC */
  exitTime?: string;
}

/**
 * Represents the result of a conjunction assessment between two space objects.
 * Contains all relevant information about the close approach event.
 */
export class ConjunctionEvent {
  /** Time of Closest Approach (TCA) */
  public readonly tca: EpochUTC;
  /** Primary object state at TCA in J2000 frame */
  public readonly primaryState: J2000;
  /** Secondary object state at TCA in J2000 frame */
  public readonly secondaryState: J2000;
  /** Relative state in RIC frame (relative to primary) */
  public readonly relativeState: RIC;
  /** Total miss distance at TCA (km) */
  public readonly missDistance: Kilometers;
  /**
   * Radial component (km, SIGNED) of the secondary's position relative to the primary, in the
   * primary's RIC (CCSDS RTN) frame. Same sign convention as CDM RELATIVE_POSITION_R. ootk v7
   * stored the absolute value.
   */
  public readonly radialDistance: Kilometers;
  /** In-track component (km, SIGNED) of the relative position in primary RIC (CDM RELATIVE_POSITION_T) */
  public readonly intrackDistance: Kilometers;
  /** Cross-track component (km, SIGNED) of the relative position in primary RIC (CDM RELATIVE_POSITION_N) */
  public readonly crosstrackDistance: Kilometers;
  /** Relative velocity magnitude at TCA (km/s) */
  public readonly relativeVelocity: KilometersPerSecond;
  /** Radial component (km/s, signed) of the relative velocity in primary RIC (CDM RELATIVE_VELOCITY_R), optional */
  public readonly radialVelocity?: KilometersPerSecond;
  /** In-track component (km/s, signed) of the relative velocity in primary RIC (CDM RELATIVE_VELOCITY_T), optional */
  public readonly intrackVelocity?: KilometersPerSecond;
  /** Cross-track component (km/s, signed) of the relative velocity in primary RIC (CDM RELATIVE_VELOCITY_N), optional */
  public readonly crosstrackVelocity?: KilometersPerSecond;
  /** Combined position covariance matrix in RIC frame (optional) */
  public readonly combinedCovariance?: StateCovariance;
  /** Probability of collision (optional, 0-1) */
  public readonly probabilityOfCollision?: number;
  /** Hard body radius for primary object (km, optional) */
  public readonly primaryRadius?: Kilometers;
  /** Hard body radius for secondary object (km, optional) */
  public readonly secondaryRadius?: Kilometers;
  /** Primary object name/identifier (optional, for CDM export) */
  public readonly primaryName?: string;
  /** Secondary object name/identifier (optional, for CDM export) */
  public readonly secondaryName?: string;
  /** Primary object catalog number (CDM OBJECT_DESIGNATOR, optional) */
  public readonly primaryDesignator?: string;
  /** Secondary object catalog number (CDM OBJECT_DESIGNATOR, optional) */
  public readonly secondaryDesignator?: string;
  /** Primary object COSPAR id, e.g. 1998-067A (CDM INTERNATIONAL_DESIGNATOR, optional) */
  public readonly primaryInternationalDesignator?: string;
  /** Secondary object COSPAR id (CDM INTERNATIONAL_DESIGNATOR, optional) */
  public readonly secondaryInternationalDesignator?: string;
  /** Primary object maneuverability (CDM MANEUVERABLE, optional) */
  public readonly primaryManeuverable?: ConjunctionManeuverable;
  /** Secondary object maneuverability (CDM MANEUVERABLE, optional) */
  public readonly secondaryManeuverable?: ConjunctionManeuverable;
  /** Primary object ephemeris source (CDM EPHEMERIS_NAME, optional) */
  public readonly primaryEphemerisName?: string;
  /** Secondary object ephemeris source (CDM EPHEMERIS_NAME, optional) */
  public readonly secondaryEphemerisName?: string;
  /** Screening volume and period (CDM SCREEN_VOLUME_* and *_SCREEN_PERIOD, optional) */
  public readonly screenVolume?: ConjunctionScreenVolume;
  /** Primary object covariance (optional, for CDM export) */
  public readonly primaryCovariance?: StateCovariance;
  /** Secondary object covariance (optional, for CDM export) */
  public readonly secondaryCovariance?: StateCovariance;

  constructor(
    params: {
      tca: EpochUTC; primaryState: J2000; secondaryState: J2000;
      relativeState: RIC; missDistance: Kilometers;
      radialDistance: Kilometers; intrackDistance: Kilometers;
      crosstrackDistance: Kilometers; relativeVelocity: KilometersPerSecond;
      radialVelocity?: KilometersPerSecond; intrackVelocity?: KilometersPerSecond;
      crosstrackVelocity?: KilometersPerSecond;
      combinedCovariance?: StateCovariance; probabilityOfCollision?: number;
      primaryRadius?: Kilometers; secondaryRadius?: Kilometers;
      primaryName?: string; secondaryName?: string;
      primaryDesignator?: string; secondaryDesignator?: string;
      primaryInternationalDesignator?: string; secondaryInternationalDesignator?: string;
      primaryManeuverable?: ConjunctionManeuverable; secondaryManeuverable?: ConjunctionManeuverable;
      primaryEphemerisName?: string; secondaryEphemerisName?: string;
      screenVolume?: ConjunctionScreenVolume;
      primaryCovariance?: StateCovariance; secondaryCovariance?: StateCovariance;
    },
  ) {
    this.tca = params.tca;
    this.primaryState = params.primaryState;
    this.secondaryState = params.secondaryState;
    this.relativeState = params.relativeState;
    this.missDistance = params.missDistance;
    this.radialDistance = params.radialDistance;
    this.intrackDistance = params.intrackDistance;
    this.crosstrackDistance = params.crosstrackDistance;
    this.relativeVelocity = params.relativeVelocity;
    this.radialVelocity = params.radialVelocity;
    this.intrackVelocity = params.intrackVelocity;
    this.crosstrackVelocity = params.crosstrackVelocity;
    this.combinedCovariance = params.combinedCovariance;
    this.probabilityOfCollision = params.probabilityOfCollision;
    this.primaryRadius = params.primaryRadius;
    this.secondaryRadius = params.secondaryRadius;
    this.primaryName = params.primaryName;
    this.secondaryName = params.secondaryName;
    this.primaryDesignator = params.primaryDesignator;
    this.secondaryDesignator = params.secondaryDesignator;
    this.primaryInternationalDesignator = params.primaryInternationalDesignator;
    this.secondaryInternationalDesignator = params.secondaryInternationalDesignator;
    this.primaryManeuverable = params.primaryManeuverable;
    this.secondaryManeuverable = params.secondaryManeuverable;
    this.primaryEphemerisName = params.primaryEphemerisName;
    this.secondaryEphemerisName = params.secondaryEphemerisName;
    this.screenVolume = params.screenVolume;
    this.primaryCovariance = params.primaryCovariance;
    this.secondaryCovariance = params.secondaryCovariance;
  }

  /**
   * Returns a formatted string representation of the conjunction event.
   * @returns A multi-line string with conjunction details.
   */
  toString(): string {
    const lines = [
      '[Conjunction Event]',
      `  TCA: ${this.tca.toString()}`,
      `  Miss Distance: ${this.missDistance.toFixed(6)} km`,
      `    Radial:     ${this.radialDistance.toFixed(6)} km`,
      `    Intrack:    ${this.intrackDistance.toFixed(6)} km`,
      `    Crosstrack: ${this.crosstrackDistance.toFixed(6)} km`,
      `  Relative Velocity: ${this.relativeVelocity.toFixed(6)} km/s`,
    ];

    if (this.probabilityOfCollision !== undefined) {
      lines.push(`  Probability of Collision: ${this.probabilityOfCollision.toExponential(6)}`);
    }

    if (this.primaryRadius !== undefined && this.secondaryRadius !== undefined) {
      const combinedRadius = this.primaryRadius + this.secondaryRadius;

      lines.push(`  Combined Hard Body Radius: ${combinedRadius.toFixed(3)} km`);
    }

    return lines.join('\n');
  }

  /**
   * Checks if this is a high-risk conjunction based on miss distance and Pc.
   * @param distanceThreshold Miss distance threshold in km (default: 1.0 km)
   * @param pcThreshold Probability of collision threshold (default: 1e-4)
   * @returns True if the conjunction exceeds risk thresholds.
   */
  isHighRisk(distanceThreshold: Kilometers = 1.0 as Kilometers, pcThreshold: number = 1e-4): boolean {
    const distanceRisk = this.missDistance < distanceThreshold;
    const pcRisk = this.probabilityOfCollision !== undefined && this.probabilityOfCollision > pcThreshold;

    return distanceRisk || pcRisk;
  }

  /**
   * Gets the Mahalanobis distance if covariance is available.
   * This is the miss distance normalized by the combined covariance.
   * @returns The Mahalanobis distance (unitless), or undefined if no covariance.
   */
  getMahalanobisDistance(): number | undefined {
    if (!this.combinedCovariance) {
      return undefined;
    }

    // Extract position-only covariance (first 3x3 block)
    const posCovariance = this.extractPositionCovariance(this.combinedCovariance.matrix);
    const relPos = this.relativeState.position;

    try {
      // Compute Mahalanobis distance: sqrt(r^T * C^-1 * r)
      const covInv = posCovariance.inverse();
      const temp = covInv.multiplyVector3D(relPos);
      const mahalanobis = relPos.x * temp.x + relPos.y * temp.y + relPos.z * temp.z;

      return Math.sqrt(mahalanobis);
    } catch {
      // Covariance may be singular
      return undefined;
    }
  }

  /**
   * Extracts the 3x3 position covariance from a 6x6 state covariance matrix.
   * @param stateCov 6x6 state covariance matrix
   * @returns 3x3 position covariance matrix
   */
  private extractPositionCovariance(stateCov: Matrix): Matrix {
    const elements = [
      [stateCov.elements[0][0], stateCov.elements[0][1], stateCov.elements[0][2]],
      [stateCov.elements[1][0], stateCov.elements[1][1], stateCov.elements[1][2]],
      [stateCov.elements[2][0], stateCov.elements[2][1], stateCov.elements[2][2]],
    ];

    return new Matrix(elements);
  }
}
