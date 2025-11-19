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

import { LinkBudgetParams } from '../interfaces/LinkBudgetParams.js';
import { BitsPerSecond, Decibels, Gigahertz, Kilometers } from '../types/types.js';
import { Transmitter } from './Transmitter.js';
import { Receiver } from './Receiver.js';
import {
  calculateFreeSpacePathLoss,
  calculateCN0,
  calculateEbN0,
  calculateLinkMargin,
} from '../utils/communications.js';

/**
 * Results from a link budget calculation.
 */
export interface LinkBudgetResult {
  /** Transmit power in dBW */
  txPowerDbw: Decibels;
  /** Transmit antenna gain in dBi */
  txGain: Decibels;
  /** Transmit losses in dB */
  txLosses: Decibels;
  /** EIRP in dBW */
  eirp: Decibels;
  /** Free space path loss in dB */
  pathLoss: Decibels;
  /** Total atmospheric and environmental losses in dB */
  environmentalLosses: Decibels;
  /** Receive antenna gain in dBi */
  rxGain: Decibels;
  /** Receive losses in dB */
  rxLosses: Decibels;
  /** G/T in dB/K */
  gOverT: Decibels;
  /** C/N0 in dB-Hz */
  cn0: Decibels;
  /** Eb/N0 in dB (if data rate provided) */
  ebN0?: Decibels;
  /** Required Eb/N0 in dB (if provided) */
  requiredEbN0?: Decibels;
  /** Link margin in dB (if required Eb/N0 provided) */
  linkMargin?: Decibels;
  /** Data rate in bps (if provided) */
  dataRate?: BitsPerSecond;
  /** Link range in km */
  range: Kilometers;
  /** Operating frequency in GHz */
  frequency: Gigahertz;
}

/**
 * Performs link budget calculations for satellite communication links.
 */
export class LinkBudget {
  /** Transmitter configuration */
  public transmitter: Transmitter;

  /** Receiver configuration */
  public receiver: Receiver;

  /** Link range/distance in kilometers */
  public range: Kilometers;

  /** Operating frequency in GHz */
  public frequency: Gigahertz;

  /** Data rate in bits per second */
  public dataRate?: BitsPerSecond;

  /** Required energy per bit to noise density ratio (Eb/N0) in dB */
  public requiredEbN0?: Decibels;

  /** Atmospheric losses in dB */
  public atmosphericLoss: Decibels;

  /** Rain attenuation in dB */
  public rainLoss: Decibels;

  /** Ionospheric losses in dB */
  public ionosphericLoss: Decibels;

  /** Polarization mismatch loss in dB */
  public polarizationLoss: Decibels;

  /** Additional margin in dB */
  public additionalMargin: Decibels;

  constructor(params: LinkBudgetParams) {
    this.transmitter = new Transmitter(params.transmitter);
    this.receiver = new Receiver(params.receiver);
    this.range = params.range;
    this.frequency = params.frequency;
    this.dataRate = params.dataRate;
    this.requiredEbN0 = params.requiredEbN0;
    this.atmosphericLoss = params.atmosphericLoss ?? (0 as Decibels);
    this.rainLoss = params.rainLoss ?? (0 as Decibels);
    this.ionosphericLoss = params.ionosphericLoss ?? (0 as Decibels);
    this.polarizationLoss = params.polarizationLoss ?? (0 as Decibels);
    this.additionalMargin = params.additionalMargin ?? (0 as Decibels);
  }

  /**
   * Calculate the total environmental losses.
   * @returns Total environmental losses in dB
   */
  getTotalEnvironmentalLosses(): Decibels {
    return (this.atmosphericLoss + this.rainLoss + this.ionosphericLoss + this.polarizationLoss) as Decibels;
  }

  /**
   * Calculate the free space path loss.
   * @returns Path loss in dB
   */
  getPathLoss(): Decibels {
    return calculateFreeSpacePathLoss(this.range, this.frequency);
  }

  /**
   * Calculate the link budget and return detailed results.
   * @returns Link budget calculation results
   */
  calculate(): LinkBudgetResult {
    // Transmit side
    const txPowerDbw = this.transmitter.getPowerDbw();
    const txGain = this.transmitter.antenna.gain;
    const txLosses = this.transmitter.getTotalLosses();
    const eirp = this.transmitter.getEirp();

    // Path
    const pathLoss = this.getPathLoss();
    const environmentalLosses = this.getTotalEnvironmentalLosses();

    // Receive side
    const rxGain = this.receiver.antenna.gain;
    const rxLosses = this.receiver.getTotalLosses();
    const gOverT = this.receiver.getGOverT();

    // Calculate C/N0
    const cn0 = calculateCN0(eirp, pathLoss, gOverT, environmentalLosses);

    // Calculate Eb/N0 if data rate is provided
    let ebN0: Decibels | undefined;
    let linkMargin: Decibels | undefined;

    if (this.dataRate !== undefined) {
      ebN0 = calculateEbN0(cn0, this.dataRate);

      if (this.requiredEbN0 !== undefined) {
        linkMargin = calculateLinkMargin(ebN0, this.requiredEbN0);
        // Account for additional margin
        linkMargin = (linkMargin - this.additionalMargin) as Decibels;
      }
    }

    return {
      txPowerDbw,
      txGain,
      txLosses,
      eirp,
      pathLoss,
      environmentalLosses,
      rxGain,
      rxLosses,
      gOverT,
      cn0,
      ebN0,
      requiredEbN0: this.requiredEbN0,
      linkMargin,
      dataRate: this.dataRate,
      range: this.range,
      frequency: this.frequency,
    };
  }

  /**
   * Get a formatted summary of the link budget.
   * @returns Formatted string with link budget details
   */
  getSummary(): string {
    const result = this.calculate();
    const lines: string[] = [];

    lines.push('=== Link Budget Summary ===');
    lines.push('');
    lines.push('Transmit:');
    lines.push(`  Power: ${result.txPowerDbw.toFixed(2)} dBW`);
    lines.push(`  Antenna Gain: ${result.txGain.toFixed(2)} dBi`);
    lines.push(`  Losses: ${result.txLosses.toFixed(2)} dB`);
    lines.push(`  EIRP: ${result.eirp.toFixed(2)} dBW`);
    lines.push('');
    lines.push('Path:');
    lines.push(`  Range: ${result.range.toFixed(2)} km`);
    lines.push(`  Frequency: ${result.frequency.toFixed(3)} GHz`);
    lines.push(`  Free Space Path Loss: ${result.pathLoss.toFixed(2)} dB`);
    lines.push(`  Environmental Losses: ${result.environmentalLosses.toFixed(2)} dB`);
    lines.push('');
    lines.push('Receive:');
    lines.push(`  Antenna Gain: ${result.rxGain.toFixed(2)} dBi`);
    lines.push(`  Losses: ${result.rxLosses.toFixed(2)} dB`);
    lines.push(`  G/T: ${result.gOverT.toFixed(2)} dB/K`);
    lines.push('');
    lines.push('Performance:');
    lines.push(`  C/N0: ${result.cn0.toFixed(2)} dB-Hz`);

    if (result.ebN0 !== undefined) {
      lines.push(`  Eb/N0: ${result.ebN0.toFixed(2)} dB`);
    }

    if (result.requiredEbN0 !== undefined) {
      lines.push(`  Required Eb/N0: ${result.requiredEbN0.toFixed(2)} dB`);
    }

    if (result.linkMargin !== undefined) {
      lines.push(`  Link Margin: ${result.linkMargin.toFixed(2)} dB`);
      if (result.linkMargin > 0) {
        lines.push('  Status: POSITIVE MARGIN (Link is viable)');
      } else {
        lines.push('  Status: NEGATIVE MARGIN (Link may fail)');
      }
    }

    if (result.dataRate !== undefined) {
      lines.push(`  Data Rate: ${(result.dataRate / 1e6).toFixed(2)} Mbps`);
    }

    return lines.join('\n');
  }

  /**
   * Check if the link has positive margin.
   * @returns True if link margin is positive, false otherwise
   */
  hasPositiveMargin(): boolean {
    const result = this.calculate();

    return result.linkMargin !== undefined && result.linkMargin > 0;
  }

  /**
   * Calculate the maximum achievable data rate for a given Eb/N0.
   * @param requiredEbN0 Required Eb/N0 in dB
   * @returns Maximum data rate in bps
   */
  getMaxDataRate(requiredEbN0: Decibels): BitsPerSecond {
    const result = this.calculate();
    // Data Rate = C/N0 - Eb/N0 (in linear domain, or subtraction in dB)
    const dataRateDb = result.cn0 - requiredEbN0;
    const dataRate = Math.pow(10, dataRateDb / 10);

    return dataRate as BitsPerSecond;
  }
}
