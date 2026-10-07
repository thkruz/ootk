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
 * Classic SGP4 propagation via the official USSF Astro Standards
 * "C Sgp4Prop WebAssembly" build (`Sgp4Prop.js` / `Sgp4Prop.wasm`).
 *
 * @example
 * ```ts
 * const sgp4 = await new Sgp4Wasm().load();
 * const satKey = sgp4.addSat(line1, line2);
 * sgp4.initSats([satKey]);
 * const state = sgp4.propagateOne(satKey, 60); // 60 min past epoch
 * ```
 */
export class Sgp4Wasm extends Sgp4WasmBase {
  protected readonly defaultGlueFile_ = 'Sgp4Prop.js';
  protected readonly defaultWasmFile_ = 'Sgp4Prop.wasm';
}
