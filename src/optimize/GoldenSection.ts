/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025 Kruczek Labs LLC
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

import { DifferentiableFunction } from '../main.js';

// / Golden Section bounded single value optimizer.
export class GoldenSection {
  private static readonly _grInv: number = 1.0 / (0.5 * (Math.sqrt(5) + 1));

  private static _check(fc: number, fd: number, solveMax: boolean): boolean {
    return solveMax ? fc > fd : fc < fd;
  }

  /**
   * Search for an optimal input value for function [f] that minimizes the
   * output value.
   *
   * Takes [lower] and [upper] input search bounds, and an optional
   * search [tolerance].
   * @param f Function to optimize
   * @param lower Lower bound
   * @param upper Upper bound
   * @param root0 Root0
   * @param root0.tolerance Root0.tolerance
   * @param root0.solveMax Root0.solveMax
   * @returns The optimal input value.
   */
  static search(
    f: DifferentiableFunction,
    lower: number,
    upper: number,
    {
      tolerance = 1e-5,
      solveMax = false,
    }: {
      tolerance?: number;
      solveMax?: boolean;
    },
  ): number {
    let a = lower;
    let b = upper;
    let c = b - (b - a) * GoldenSection._grInv;
    let d = a + (b - a) * GoldenSection._grInv;

    while (Math.abs(b - a) > tolerance) {
      if (GoldenSection._check(f(c), f(d), solveMax)) {
        b = d;
      } else {
        a = c;
      }
      c = b - (b - a) * GoldenSection._grInv;
      d = a + (b - a) * GoldenSection._grInv;
    }

    return 0.5 * (b + a);
  }
}
