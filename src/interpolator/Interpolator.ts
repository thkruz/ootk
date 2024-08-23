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

import { EpochUTC, EpochWindow, Seconds } from '../main.js';


// / Interpolator base class.
export abstract class Interpolator {
  // Return the start and end epoch covered by this interpolator.
  abstract window(): EpochWindow;

  /*
   * Return `true` if the provided [epoch] is within this interpolator's
   * cached value range.
   */
  inWindow(epoch: EpochUTC): boolean {
    const start = this.window().start;
    const stop = this.window().end;

    return start <= epoch && epoch <= stop;
  }

  /*
   * Calculate the start/stop epoch between this and another [Interpolator].
   *
   * Returns `null` if there is no overlap between interpolators.
   */
  overlap(interpolator: Interpolator): EpochWindow | null {
    const x1 = this.window().start;
    const x2 = this.window().end;
    const y1 = interpolator.window().start;
    const y2 = interpolator.window().end;

    if (x1 <= y2 && y1 <= x2) {
      const e1 = new EpochUTC(Math.max(x1.posix, y1.posix) as Seconds);
      const e2 = new EpochUTC(Math.min(x2.posix, y2.posix) as Seconds);

      return new EpochWindow(e1, e2);
    }

    return null;
  }
}
