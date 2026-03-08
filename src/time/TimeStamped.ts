/**
 * @author Theodore Kruczek
 * @description Orbital Object ToolKit (ootk) is a collection of tools for working
 * with satellites and other orbital objects.
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Many of the classes are based off of the work of @david-rc-dayton and his
 * Pious Squid library (https://github.com/david-rc-dayton/pious_squid) which
 * is licensed under the MIT license.
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
import type { EpochUTC } from './EpochUTC';

export class TimeStamped<T> {
  /**
   * Timestamped value.
   */
  private readonly value_: T;
  /**
   * Timestamp epoch.
   */
  readonly epoch_: EpochUTC;

  /**
   * Create a new time stamped value container at the provided epoch.
   * @param epoch The timestamp epoch.
   * @param value The timestamped value.
   */
  constructor(epoch: EpochUTC, value: T) {
    this.epoch_ = epoch;
    this.value_ = value;
  }

  /**
   * Get the timestamped value.
   * @returns The timestamped value.
   */
  get value(): T {
    return this.value_;
  }

  /**
   * Set the timestamped value.
   * @param _ The timestamped value.
   * @throws Cannot set value of TimeStamped object; it is readonly.
   */
  set value(_: T) {
    throw new ValidationError('Cannot set value of TimeStamped object; it is readonly', 'value');
  }

  /**
   * Get the timestamp epoch.
   * @returns The timestamp epoch.
   */
  get epoch(): EpochUTC {
    return this.epoch_;
  }

  /**
   * Set the timestamp epoch.
   * @param _ The timestamp epoch.
   * @throws Cannot set epoch of TimeStamped object; it is readonly.
   */
  set epoch(_: EpochUTC) {
    throw new ValidationError('Cannot set epoch of TimeStamped object; it is readonly', 'epoch');
  }
}
