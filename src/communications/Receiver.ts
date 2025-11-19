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

import { ReceiverParams } from '../interfaces/ReceiverParams.js';
import { Decibels, Kelvin } from '../types/types.js';
import { Antenna } from './Antenna.js';
import { calculateGOverT, noiseFigureToNoiseTemperature } from '../utils/communications.js';

/**
 * Represents a receiver system for satellite communications.
 */
export class Receiver {
  /** Receive antenna */
  public antenna: Antenna;

  /** System noise temperature in Kelvin */
  public systemNoiseTemperature: Kelvin;

  /** Noise figure in dB */
  public noiseFigure?: Decibels;

  /** Cable/waveguide losses in dB */
  public cableLoss: Decibels;

  /** Other losses in dB */
  public otherLosses: Decibels;

  constructor(params: ReceiverParams) {
    this.antenna = new Antenna(params.antenna);
    this.systemNoiseTemperature = params.systemNoiseTemperature;
    this.noiseFigure = params.noiseFigure;
    this.cableLoss = params.cableLoss ?? (0 as Decibels);
    this.otherLosses = params.otherLosses ?? (0 as Decibels);

    // If noise figure is provided, calculate system noise temperature
    if (params.noiseFigure !== undefined && params.systemNoiseTemperature === 0) {
      this.systemNoiseTemperature = noiseFigureToNoiseTemperature(params.noiseFigure);
    }
  }

  /**
   * Calculate total receiver losses.
   * @returns Total losses in dB
   */
  getTotalLosses(): Decibels {
    return (this.cableLoss + this.otherLosses + this.antenna.pointingLoss) as Decibels;
  }

  /**
   * Calculate the figure of merit (G/T) for the receiving system.
   * G/T = Antenna Gain (dBi) - 10*log10(System Temperature)
   * @returns G/T in dB/K
   */
  getGOverT(): Decibels {
    return calculateGOverT(this.antenna.getEffectiveGain(), this.systemNoiseTemperature);
  }

  /**
   * Get system noise temperature.
   * @returns System noise temperature in Kelvin
   */
  getSystemNoiseTemperature(): Kelvin {
    return this.systemNoiseTemperature;
  }

  /**
   * Get receive antenna gain accounting for losses.
   * @returns Effective receive gain in dBi
   */
  getEffectiveGain(): Decibels {
    return (this.antenna.getEffectiveGain() - this.cableLoss - this.otherLosses) as Decibels;
  }
}
