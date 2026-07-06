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

import { ValidationError } from '../errors';
import { Decibels, SerializedAntenna } from './CommTypes';

/**
 * Parameters for constructing an Antenna.
 */
export interface AntennaParams {
  /** Antenna gain in dB (isotropic reference) */
  gain: Decibels;
  /** 3dB beamwidth in degrees (optional) */
  beamwidth?: number;
  /** Antenna efficiency factor 0-1 (optional, default 0.55) */
  efficiency?: number;
}

/**
 * Represents an antenna for communication systems.
 *
 * Antennas are characterized primarily by their gain, which determines
 * how much they amplify signals in a particular direction compared to
 * an isotropic (omnidirectional) radiator.
 *
 * @example
 * ```typescript
 * // High-gain ground station antenna
 * const groundAntenna = new Antenna({
 *   gain: 45 as Decibels,
 *   beamwidth: 1.5,
 *   efficiency: 0.65,
 * });
 *
 * // Satellite antenna with moderate gain
 * const satAntenna = new Antenna({
 *   gain: 20 as Decibels,
 *   beamwidth: 15,
 * });
 *
 * // Simple omnidirectional antenna
 * const omni = Antenna.omnidirectional();
 * ```
 */
export class Antenna {
  /** Antenna gain in dB (isotropic reference) */
  readonly gain: Decibels;
  /** 3dB beamwidth in degrees */
  readonly beamwidth?: number;
  /** Antenna efficiency factor 0-1 */
  readonly efficiency: number;

  constructor(params: AntennaParams) {
    if (params.efficiency !== undefined && (params.efficiency < 0 || params.efficiency > 1)) {
      throw new ValidationError('Antenna efficiency must be between 0 and 1', 'efficiency', params.efficiency);
    }

    this.gain = params.gain;
    this.beamwidth = params.beamwidth;
    this.efficiency = params.efficiency ?? 0.55;
  }

  // ==================== Factory Methods ====================

  /**
   * Creates an omnidirectional (isotropic) antenna with 0 dB gain.
   * @returns An antenna with 0 dB gain
   */
  static omnidirectional(): Antenna {
    return new Antenna({
      gain: 0 as Decibels,
      beamwidth: 360,
      efficiency: 1,
    });
  }

  /**
   * Creates an antenna from a dish diameter and frequency.
   * Uses the standard parabolic antenna gain formula:
   * G = efficiency * (pi * D / lambda)^2
   *
   * @param diameterMeters - Dish diameter in meters
   * @param frequencyHz - Operating frequency in Hz
   * @param efficiency - Antenna efficiency (default 0.55)
   * @returns An antenna with calculated gain
   */
  static fromDishDiameter(
    diameterMeters: number,
    frequencyHz: number,
    efficiency = 0.55,
  ): Antenna {
    // wavelength in meters: c / f
    const wavelength = 299792458 / frequencyHz;

    // Gain = efficiency * (pi * D / lambda)^2
    const gainLinear = efficiency * ((Math.PI * diameterMeters) / wavelength) ** 2;
    const gainDb = 10 * Math.log10(gainLinear);

    // Approximate beamwidth: 70 * lambda / D (degrees)
    const beamwidth = (70 * wavelength) / diameterMeters;

    return new Antenna({
      gain: gainDb as Decibels,
      beamwidth,
      efficiency,
    });
  }

  // ==================== Methods ====================

  /**
   * Calculates gain reduction for off-axis pointing.
   * Uses a simple Gaussian approximation based on beamwidth.
   *
   * @param offAxisAngleDegrees - Angle off boresight in degrees
   * @returns Gain reduction in dB (negative value)
   */
  getOffAxisLoss(offAxisAngleDegrees: number): Decibels {
    if (this.beamwidth === undefined || this.beamwidth >= 360) {
      // Omnidirectional antenna has no off-axis loss
      return 0 as Decibels;
    }

    // Gaussian approximation: loss = -12 * (theta / theta_3dB)^2
    // This gives -3 dB at the half-power beamwidth
    const halfPowerAngle = this.beamwidth / 2;
    const normalizedAngle = offAxisAngleDegrees / halfPowerAngle;
    const loss = -3 * normalizedAngle ** 2;

    return loss as Decibels;
  }

  /**
   * Gets the effective gain including off-axis loss.
   * @param offAxisAngleDegrees - Angle off boresight in degrees
   * @returns Effective gain in dB
   */
  getEffectiveGain(offAxisAngleDegrees: number): Decibels {
    const loss = this.getOffAxisLoss(offAxisAngleDegrees);

    return (this.gain + loss) as Decibels;
  }

  /**
   * Creates a deep copy of this antenna.
   * @returns A new Antenna instance with the same properties
   */
  clone(): Antenna {
    return new Antenna({
      gain: this.gain,
      beamwidth: this.beamwidth,
      efficiency: this.efficiency,
    });
  }

  // ==================== Serialization ====================

  /**
   * Creates a serializable representation of this antenna.
   */
  serialize(): SerializedAntenna {
    return {
      gain: this.gain,
      beamwidth: this.beamwidth,
      efficiency: this.efficiency,
    };
  }

  /**
   * Creates an Antenna from serialized data.
   * @param data - Serialized antenna data
   * @returns A new Antenna instance
   */
  static deserialize(data: SerializedAntenna): Antenna {
    return new Antenna({
      gain: data.gain,
      beamwidth: data.beamwidth,
      efficiency: data.efficiency,
    });
  }

  /**
   * Returns a string representation of this antenna.
   */
  toString(): string {
    const lines = [
      '[Antenna]',
      `  Gain: ${this.gain.toFixed(1)} dB`,
    ];

    if (this.beamwidth !== undefined) {
      lines.push(`  Beamwidth: ${this.beamwidth.toFixed(1)}°`);
    }

    lines.push(`  Efficiency: ${(this.efficiency * 100).toFixed(0)}%`);

    return lines.join('\n');
  }
}
