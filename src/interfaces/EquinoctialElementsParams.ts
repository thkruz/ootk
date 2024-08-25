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

import { EpochUTC, Kilometers, Radians } from '../main.js';

export interface EquinoctialElementsParams {
  epoch: EpochUTC;
  h: number;
  k: number;
  lambda: Radians;
  a: Kilometers;
  p: number;
  q: number;
  mu?: number;
  /** Retrograde factor. 1 for prograde orbits, -1 for retrograde orbits. */
  I?: 1 | -1;
}
