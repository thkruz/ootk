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

import { TransmitterParams } from '../interfaces/TransmitterParams.js';
import { Decibels, Watts } from '../types/types.js';
import { Antenna } from './Antenna.js';
import { calculateEirp, wattsToDbw } from '../utils/communications.js';

/**
 * Represents a transmitter system for satellite communications.
 */
export class Transmitter {
  /** Transmit power in watts */
  public power: Watts;

  /** Power in dBW (decibel-watts) */
  public powerDbw: Decibels;

  /** Transmit antenna */
  public antenna: Antenna;

  /** Cable/waveguide losses in dB */
  public cableLoss: Decibels;

  /** Other losses in dB */
  public otherLosses: Decibels;

  constructor(params: TransmitterParams) {
    this.power = params.power;
    this.powerDbw = params.powerDbw ?? wattsToDbw(params.power);
    this.antenna = new Antenna(params.antenna);
    this.cableLoss = params.cableLoss ?? (0 as Decibels);
    this.otherLosses = params.otherLosses ?? (0 as Decibels);

    // Sync power and powerDbw
    if (params.powerDbw !== undefined) {
      this.powerDbw = params.powerDbw;
    } else {
      this.powerDbw = wattsToDbw(this.power);
    }
  }

  /**
   * Calculate total transmitter losses.
   * @returns Total losses in dB
   */
  getTotalLosses(): Decibels {
    return (this.cableLoss + this.otherLosses + this.antenna.pointingLoss) as Decibels;
  }

  /**
   * Calculate Equivalent Isotropic Radiated Power (EIRP).
   * EIRP = Transmit Power (dBW) + Antenna Gain (dBi) - Losses (dB)
   * @returns EIRP in dBW
   */
  getEirp(): Decibels {
    return calculateEirp(this.powerDbw, this.antenna.gain, this.getTotalLosses());
  }

  /**
   * Get transmit power in dBW.
   * @returns Power in dBW
   */
  getPowerDbw(): Decibels {
    return this.powerDbw;
  }

  /**
   * Get transmit power in watts.
   * @returns Power in watts
   */
  getPowerWatts(): Watts {
    return this.power;
  }
}
