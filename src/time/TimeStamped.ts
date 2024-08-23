/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
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

import type { EpochUTC } from './EpochUTC.js';

/**
 * Time stamped value container.
 * TODO: #10 Is TimeStamped class needed?
 */
export class TimeStamped<T> {
  /**
   * Create a new time stamped value container at the provided epoch.
   * @param epoch The timestamp epoch.
   * @param value The timestamped value.
   */
  constructor(epoch: EpochUTC, value: T) {
    this.epoch = epoch;
    this.value = value;
  }

  /**
   * Timestamp epoch.
   */
  readonly epoch: EpochUTC;

  /**
   * Timestamped value.
   */
  readonly value: T;
}
