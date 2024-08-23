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

import { HpAtmosphereEntry } from './HpAtmosphereData.js';

// / Harris-Priester atmospheric density bracket.
export class HpAtmosphereResult {
  // / Height above Earth's surface _(km)_.
  height: number;
  // / Lower bound for atmospheric parameters.
  hp0: HpAtmosphereEntry;
  // / Upper bound for atmospheric parameters.
  hp1: HpAtmosphereEntry;

  // / Create a new [HpAtmosphereResult] object.
  constructor(height: number, hp0: HpAtmosphereEntry, hp1: HpAtmosphereEntry) {
    this.height = height;
    this.hp0 = hp0;
    this.hp1 = hp1;
  }
}
