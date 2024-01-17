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

import { Propagator } from '../propagator/Propagator';

export class PropagatorPairs {
  constructor(private _posStep: number, private _velStep: number) {
    // Do nothing.
  }

  private _high: (Propagator | null)[] = Array(6).fill(null);
  private _low: (Propagator | null)[] = Array(6).fill(null);

  set(index: number, high: Propagator, low: Propagator): void {
    this._high[index] = high;
    this._low[index] = low;
  }

  get(index: number): [Propagator, Propagator] {
    return [this._high[index]!, this._low[index]!];
  }

  /**
   * Get the step size at the provided index.
   * @param index The index.
   * @returns The step size.
   */
  step(index: number): number {
    return index < 3 ? this._posStep : this._velStep;
  }
}
