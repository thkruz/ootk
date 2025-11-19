/**
 * @author @thkruz/ootk
 * @license AGPL-3.0-or-later
 * @copyright (c) 2024 Theodore Kruczek
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

import { AntennaParams } from '../interfaces/AntennaParams.js';
import { Decibels, Degrees, Gigahertz } from '../types/types.js';
import { FrequencyBand } from '../enums/FrequencyBand.js';
import { PolarizationType } from '../enums/PolarizationType.js';
import { calculateAntennaGain, calculateBeamwidth } from '../utils/communications.js';

/**
 * Represents an antenna system for satellite communications.
 */
export class Antenna {
  /** Antenna gain in dBi */
  public gain: Decibels;

  /** Antenna diameter in meters (for parabolic antennas) */
  public diameter?: number;

  /** Operating frequency in GHz */
  public frequency: Gigahertz;

  /** Frequency band */
  public band?: FrequencyBand;

  /** Polarization type */
  public polarization: PolarizationType;

  /** Antenna efficiency (0-1) */
  public efficiency: number;

  /** Beamwidth in degrees (3dB beamwidth) */
  public beamwidth: Degrees;

  /** Pointing loss in dB */
  public pointingLoss: Decibels;

  constructor(params: AntennaParams) {
    this.gain = params.gain;
    this.diameter = params.diameter;
    this.frequency = params.frequency;
    this.band = params.band;
    this.polarization = params.polarization ?? PolarizationType.LINEAR_VERTICAL;
    this.efficiency = params.efficiency ?? 0.65;
    this.pointingLoss = params.pointingLoss ?? (0 as Decibels);

    // Calculate beamwidth if not provided
    if (params.beamwidth !== undefined) {
      this.beamwidth = params.beamwidth;
    } else {
      this.beamwidth = calculateBeamwidth(this.gain) as Degrees;
    }

    // If diameter is provided but gain is not, calculate gain
    if (params.diameter !== undefined && params.gain === 0) {
      this.gain = calculateAntennaGain(params.diameter, params.frequency, this.efficiency);
    }
  }

  /**
   * Calculate the effective antenna gain accounting for pointing loss.
   * @returns Effective gain in dBi
   */
  getEffectiveGain(): Decibels {
    return (this.gain - this.pointingLoss) as Decibels;
  }

  /**
   * Calculate antenna gain from diameter for a parabolic antenna.
   * This is a static method for convenience.
   * @param diameter Antenna diameter in meters
   * @param frequency Frequency in GHz
   * @param efficiency Antenna efficiency (0-1), defaults to 0.65
   * @returns Antenna gain in dBi
   */
  static calculateGainFromDiameter(diameter: number, frequency: Gigahertz, efficiency: number = 0.65): Decibels {
    return calculateAntennaGain(diameter, frequency, efficiency);
  }

  /**
   * Get the approximate half-power beamwidth.
   * @returns Beamwidth in degrees
   */
  getBeamwidth(): Degrees {
    return this.beamwidth;
  }

  /**
   * Calculate polarization mismatch loss.
   * This is a simplified model; actual loss depends on polarization angles.
   * @param otherPolarization The polarization of the other antenna
   * @returns Polarization mismatch loss in dB
   */
  getPolarizationLoss(otherPolarization: PolarizationType): Decibels {
    // Simplified model
    if (this.polarization === otherPolarization) {
      return 0 as Decibels; // Perfect match
    }

    // Check for compatible polarizations
    if (
      (this.polarization === PolarizationType.RHCP && otherPolarization === PolarizationType.LHCP) ||
      (this.polarization === PolarizationType.LHCP && otherPolarization === PolarizationType.RHCP)
    ) {
      return 30 as Decibels; // Worst case: orthogonal circular polarizations
    }

    if (
      (this.polarization === PolarizationType.LINEAR_HORIZONTAL &&
        otherPolarization === PolarizationType.LINEAR_VERTICAL) ||
      (this.polarization === PolarizationType.LINEAR_VERTICAL &&
        otherPolarization === PolarizationType.LINEAR_HORIZONTAL)
    ) {
      return 30 as Decibels; // Worst case: orthogonal linear polarizations
    }

    // Mixed polarization types (linear and circular)
    if (
      (this.polarization === PolarizationType.LINEAR_HORIZONTAL || this.polarization === PolarizationType.LINEAR_VERTICAL) &&
      (otherPolarization === PolarizationType.RHCP || otherPolarization === PolarizationType.LHCP)
    ) {
      return 3 as Decibels; // Typical loss for linear-circular mismatch
    }

    // Dual polarization systems
    if (this.polarization === PolarizationType.DUAL_LINEAR || this.polarization === PolarizationType.DUAL_CIRCULAR) {
      return 0 as Decibels; // Can adapt to any polarization
    }

    return 3 as Decibels; // Default moderate loss
  }
}
