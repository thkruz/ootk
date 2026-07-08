/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
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

import { Sgp4WasmBase } from './Sgp4WasmBase';

/**
 * SGP4-XP propagation via the official USSF Astro Standards
 * "C Sgp4Prop WebAssembly" build (`Sgp4Prop.xp.js` / `Sgp4Prop.xp.wasm`).
 *
 * SGP4-XP is the extended propagator that additionally supports
 * ephemeris-type-4 TLEs; for classic type-0 TLEs it produces results
 * matching {@link Sgp4Wasm}. The API surface is identical.
 */
export class Sgp4XpWasm extends Sgp4WasmBase {
  protected readonly defaultGlueFile_ = 'Sgp4Prop.xp.js';
  protected readonly defaultWasmFile_ = 'Sgp4Prop.xp.wasm';
}
