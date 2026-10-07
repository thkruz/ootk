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

import { EpochUTC } from '../time/EpochUTC';
import { EpochWindow } from '../time/EpochWindow';
import { Seconds } from '../types/types';

// / Interpolator base class.
export abstract class Interpolator {
  // Return the start and end epoch covered by this interpolator.
  abstract window(): EpochWindow;

  /*
   * Return `true` if the provided [epoch] is within this interpolator's
   * cached value range.
   */
  inWindow(epoch: EpochUTC): boolean {
    const window = this.window();

    /*
     * Compare the raw POSIX seconds, NOT the Epoch objects. Relational operators
     * on objects trigger ToPrimitive -> Epoch.toString() -> Date.toISOString() on
     * every operand, which is a heavy per-frame cost when this runs in the render
     * loop (see ChebyshevInterpolator.interpolate).
     */
    return window.start.posix <= epoch.posix && epoch.posix <= window.end.posix;
  }

  /*
   * Calculate the start/stop epoch between this and another [Interpolator].
   *
   * Returns `null` if there is no overlap between interpolators.
   */
  overlap(interpolator: Interpolator): EpochWindow | null {
    // Compare raw POSIX seconds to avoid Epoch object coercion (toISOString) - see inWindow().
    const a = this.window();
    const b = interpolator.window();
    const x1 = a.start.posix;
    const x2 = a.end.posix;
    const y1 = b.start.posix;
    const y2 = b.end.posix;

    if (x1 <= y2 && y1 <= x2) {
      const e1 = new EpochUTC(Math.max(x1, y1) as Seconds);
      const e2 = new EpochUTC(Math.min(x2, y2) as Seconds);

      return new EpochWindow(e1, e2);
    }

    return null;
  }
}
