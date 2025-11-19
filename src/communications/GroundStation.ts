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

import { RfSensor } from '../objects/RfSensor.js';
import { GroundStationParams } from '../interfaces/GroundStationParams.js';
import { Transmitter } from './Transmitter.js';
import { Receiver } from './Receiver.js';
import { Degrees, Kilometers } from '../types/types.js';

/**
 * Represents a ground station with transmit and receive capabilities.
 * Extends RfSensor to provide communication link budget functionality.
 */
export class GroundStation extends RfSensor {
  /** Transmitter configuration (optional for receive-only stations) */
  public transmitter?: Transmitter;

  /** Receiver configuration (optional for transmit-only stations) */
  public receiver?: Receiver;

  /** Minimum elevation angle for operations in degrees */
  public minOperatingElevation: Degrees;

  /** Maximum range in kilometers */
  public maxRange?: Kilometers;

  constructor(params: GroundStationParams) {
    super(params);

    // Initialize transmitter if parameters provided
    if (params.transmitter) {
      this.transmitter = new Transmitter(params.transmitter);
    }

    // Initialize receiver if parameters provided
    if (params.receiver) {
      this.receiver = new Receiver(params.receiver);
    }

    this.minOperatingElevation = (params.minOperatingElevation ?? 5) as Degrees;
    this.maxRange = params.maxRange ? (params.maxRange as Kilometers) : undefined;
  }

  /**
   * Check if the ground station can transmit.
   * @returns True if the station has a transmitter configured
   */
  canTransmit(): boolean {
    return this.transmitter !== undefined;
  }

  /**
   * Check if the ground station can receive.
   * @returns True if the station has a receiver configured
   */
  canReceive(): boolean {
    return this.receiver !== undefined;
  }

  /**
   * Check if the ground station has both transmit and receive capability.
   * @returns True if the station can both transmit and receive
   */
  isFullDuplex(): boolean {
    return this.canTransmit() && this.canReceive();
  }

  /**
   * Get the transmitter EIRP if available.
   * @returns EIRP in dBW, or undefined if no transmitter
   */
  getEirp() {
    return this.transmitter?.getEirp();
  }

  /**
   * Get the receiver G/T if available.
   * @returns G/T in dB/K, or undefined if no receiver
   */
  getGOverT() {
    return this.receiver?.getGOverT();
  }

  /**
   * Check if the station can operate at a given elevation angle.
   * @param elevation Elevation angle in degrees
   * @returns True if elevation is above minimum operating elevation
   */
  canOperateAtElevation(elevation: Degrees): boolean {
    return elevation >= this.minOperatingElevation;
  }

  /**
   * Check if the station can operate at a given range.
   * @param range Range in kilometers
   * @returns True if range is within maximum range (or no max range set)
   */
  canOperateAtRange(range: Kilometers): boolean {
    if (this.maxRange === undefined) {
      return true;
    }

    return range <= this.maxRange;
  }

  /**
   * Get information about the ground station.
   * @returns Object with station information
   */
  getInfo() {
    return {
      name: this.name,
      lat: this.lat,
      lon: this.lon,
      alt: this.alt,
      minElevation: this.minOperatingElevation,
      maxRange: this.maxRange,
      canTransmit: this.canTransmit(),
      canReceive: this.canReceive(),
      eirp: this.getEirp(),
      gOverT: this.getGOverT(),
    };
  }
}
