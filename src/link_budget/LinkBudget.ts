/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
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

import { Degrees, Kilometers } from '../types/types.js';

/**
 * Units for link budget calculations (all in dB unless otherwise specified).
 */
export type Decibels = number;
export type DecibelWatts = number;
export type DecibelMilliwatts = number;
export type DecibelHertz = number;
export type Hertz = number;
export type Watts = number;

/**
 * Transmitter parameters for link budget.
 */
export interface TransmitterParams {
  /** Transmit power in dBW */
  powerDbw: DecibelWatts;
  /** Antenna gain in dBi */
  antennaGain: Decibels;
  /** Line losses in dB (positive value) */
  lineLosses?: Decibels;
  /** Pointing loss in dB (positive value) */
  pointingLoss?: Decibels;
}

/**
 * Receiver parameters for link budget.
 */
export interface ReceiverParams {
  /** Antenna gain in dBi */
  antennaGain: Decibels;
  /** System noise temperature in Kelvin */
  systemNoiseTemp: number;
  /** Line losses in dB (positive value) */
  lineLosses?: Decibels;
  /** Pointing loss in dB (positive value) */
  pointingLoss?: Decibels;
}

/**
 * Link parameters.
 */
export interface LinkParams {
  /** Frequency in Hz */
  frequency: Hertz;
  /** Range/distance in kilometers */
  range: Kilometers;
  /** Data rate in bits per second */
  dataRate?: number;
  /** Atmospheric attenuation in dB (positive value) */
  atmosphericLoss?: Decibels;
  /** Rain attenuation in dB (positive value) */
  rainLoss?: Decibels;
  /** Ionospheric scintillation loss in dB (positive value) */
  scintillationLoss?: Decibels;
  /** Polarization loss in dB (positive value) */
  polarizationLoss?: Decibels;
}

/**
 * Link budget calculation result.
 */
export interface LinkBudgetResult {
  /** Effective Isotropic Radiated Power in dBW */
  eirp: DecibelWatts;
  /** Free space path loss in dB */
  pathLoss: Decibels;
  /** Received power in dBW */
  receivedPower: DecibelWatts;
  /** System noise power in dBW */
  noisePower: DecibelWatts;
  /** Carrier-to-Noise ratio in dB */
  cnr: Decibels;
  /** Carrier-to-Noise density ratio in dB-Hz */
  cn0: DecibelHertz;
  /** Energy per bit to noise density ratio in dB (if data rate provided) */
  ebN0?: Decibels;
  /** Signal-to-Noise ratio in dB */
  snr: Decibels;
  /** Link margin in dB (above minimum required SNR) */
  linkMargin?: Decibels;
  /** Total losses in dB */
  totalLosses: Decibels;
}

/**
 * Link budget calculator for RF communication links.
 */
export class LinkBudget {
  private static readonly BOLTZMANN_CONSTANT = 1.380649e-23; // J/K
  private static readonly SPEED_OF_LIGHT = 299792458; // m/s

  /**
   * Calculate link budget for a communication link.
   * @param transmitter - Transmitter parameters
   * @param receiver - Receiver parameters
   * @param link - Link parameters
   * @param requiredSnr - Required SNR in dB (optional, for margin calculation)
   * @returns Link budget calculation result
   */
  static calculate(
    transmitter: TransmitterParams,
    receiver: ReceiverParams,
    link: LinkParams,
    requiredSnr?: Decibels,
  ): LinkBudgetResult {
    // Calculate EIRP
    const txLineLoss = transmitter.lineLosses ?? 0;
    const txPointingLoss = transmitter.pointingLoss ?? 0;
    const eirp = transmitter.powerDbw + transmitter.antennaGain - txLineLoss - txPointingLoss;

    // Calculate free space path loss
    const pathLoss = this.calculatePathLoss(link.frequency, link.range);

    // Calculate atmospheric and other losses
    const atmosphericLoss = link.atmosphericLoss ?? 0;
    const rainLoss = link.rainLoss ?? 0;
    const scintillationLoss = link.scintillationLoss ?? 0;
    const polarizationLoss = link.polarizationLoss ?? 0;
    const rxLineLoss = receiver.lineLosses ?? 0;
    const rxPointingLoss = receiver.pointingLoss ?? 0;

    const totalLosses =
      pathLoss + atmosphericLoss + rainLoss + scintillationLoss + polarizationLoss + rxLineLoss + rxPointingLoss;

    // Calculate received power
    const receivedPower = eirp + receiver.antennaGain - totalLosses;

    // Calculate noise power
    const noisePower = this.calculateNoisePower(receiver.systemNoiseTemp, link.dataRate);

    // Calculate CNR
    const cnr = receivedPower - noisePower;

    // Calculate C/N0 (carrier to noise density)
    const bandwidth = link.dataRate ?? 1; // If no data rate, assume 1 Hz
    const cn0 = cnr + 10 * Math.log10(bandwidth);

    // Calculate SNR (assuming matched filter)
    const snr = cnr;

    // Calculate Eb/N0 if data rate is provided
    let ebN0: Decibels | undefined;

    if (link.dataRate) {
      ebN0 = cn0 - 10 * Math.log10(link.dataRate);
    }

    // Calculate link margin if required SNR is provided
    let linkMargin: Decibels | undefined;

    if (requiredSnr !== undefined) {
      linkMargin = snr - requiredSnr;
    }

    return {
      eirp,
      pathLoss,
      receivedPower,
      noisePower,
      cnr,
      cn0,
      ebN0,
      snr,
      linkMargin,
      totalLosses,
    };
  }

  /**
   * Calculate free space path loss.
   * @param frequency - Frequency in Hz
   * @param range - Range in kilometers
   * @returns Path loss in dB
   */
  static calculatePathLoss(frequency: Hertz, range: Kilometers): Decibels {
    const wavelength = this.SPEED_OF_LIGHT / frequency;
    const rangeMeters = range * 1000;

    // Friis transmission equation: FSPL = (4πd/λ)²
    const pathLoss = 20 * Math.log10((4 * Math.PI * rangeMeters) / wavelength);

    return pathLoss;
  }

  /**
   * Calculate noise power.
   * @param systemNoiseTemp - System noise temperature in Kelvin
   * @param bandwidth - Bandwidth in Hz (optional)
   * @returns Noise power in dBW
   */
  static calculateNoisePower(systemNoiseTemp: number, bandwidth?: number): DecibelWatts {
    const bw = bandwidth ?? 1; // If no bandwidth, return noise density
    const noisePowerWatts = this.BOLTZMANN_CONSTANT * systemNoiseTemp * bw;
    const noisePowerDbw = 10 * Math.log10(noisePowerWatts);

    return noisePowerDbw;
  }

  /**
   * Calculate antenna gain for a parabolic dish.
   * @param diameter - Antenna diameter in meters
   * @param frequency - Frequency in Hz
   * @param efficiency - Antenna efficiency (0-1, default 0.6)
   * @returns Antenna gain in dBi
   */
  static calculateParabolicGain(diameter: number, frequency: Hertz, efficiency: number = 0.6): Decibels {
    const wavelength = this.SPEED_OF_LIGHT / frequency;
    const gain = efficiency * ((Math.PI * diameter) / wavelength) ** 2;
    const gainDbi = 10 * Math.log10(gain);

    return gainDbi;
  }

  /**
   * Calculate G/T (figure of merit for receiver).
   * @param antennaGain - Antenna gain in dBi
   * @param systemNoiseTemp - System noise temperature in Kelvin
   * @returns G/T in dB/K
   */
  static calculateGOverT(antennaGain: Decibels, systemNoiseTemp: number): Decibels {
    return antennaGain - 10 * Math.log10(systemNoiseTemp);
  }

  /**
   * Calculate atmospheric attenuation.
   * @param frequency - Frequency in Hz
   * @param elevationAngle - Elevation angle in degrees
   * @param humidity - Relative humidity (0-1, default 0.5)
   * @returns Atmospheric attenuation in dB
   */
  static calculateAtmosphericLoss(frequency: Hertz, elevationAngle: Degrees, humidity: number = 0.5): Decibels {
    // Simplified ITU-R P.676 model for clear air attenuation
    const frequencyGHz = frequency / 1e9;

    // Specific attenuation (dB/km) - simplified model
    let gamma = 0;

    if (frequencyGHz < 10) {
      gamma = 0.01; // Very low below 10 GHz
    } else if (frequencyGHz < 20) {
      gamma = 0.02 + 0.005 * (frequencyGHz - 10);
    } else if (frequencyGHz < 30) {
      gamma = 0.07 + 0.01 * (frequencyGHz - 20);
    } else {
      gamma = 0.17 + 0.02 * Math.min(frequencyGHz - 30, 20);
    }

    // Add water vapor contribution
    gamma += 0.05 * humidity * (frequencyGHz / 10);

    // Path length through atmosphere (simplified)
    const elRad = (elevationAngle * Math.PI) / 180;
    const pathLength = 10 / Math.sin(elRad); // Assume 10 km atmosphere height

    return gamma * pathLength;
  }

  /**
   * Convert dBW to Watts.
   * @param dbw - Power in dBW
   * @returns Power in Watts
   */
  static dbwToWatts(dbw: DecibelWatts): Watts {
    return 10 ** (dbw / 10);
  }

  /**
   * Convert Watts to dBW.
   * @param watts - Power in Watts
   * @returns Power in dBW
   */
  static wattsToDbw(watts: Watts): DecibelWatts {
    return 10 * Math.log10(watts);
  }

  /**
   * Convert dBm to dBW.
   * @param dbm - Power in dBm
   * @returns Power in dBW
   */
  static dbmToDbw(dbm: DecibelMilliwatts): DecibelWatts {
    return dbm - 30;
  }

  /**
   * Convert dBW to dBm.
   * @param dbw - Power in dBW
   * @returns Power in dBm
   */
  static dbwToDbm(dbw: DecibelWatts): DecibelMilliwatts {
    return dbw + 30;
  }
}
