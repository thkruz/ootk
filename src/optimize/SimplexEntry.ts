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

import { Vector } from '../main.js';

/**
 * Optimization cost function that takes in parameter array [xs] and returns
 * a score.
 */
export type CostFunction = (points: Float64Array) => number;

export class SimplexEntry {
  score: number;
  private readonly x_: Vector;

  constructor(private readonly f_: CostFunction, public points: Float64Array) {
    this.x_ = new Vector(points);
    this.score = this.f_(points);
  }

  getPoints(): Float64Array {
    return this.x_.toArray();
  }

  getScore(): number {
    return this.score;
  }

  modify(n: number, xa: SimplexEntry, xb: SimplexEntry): SimplexEntry {
    return new SimplexEntry(this.f_, this.x_.add(xa.x_.subtract(xb.x_).scale(n)).toArray());
  }

  distance(se: SimplexEntry): number {
    return this.x_.distance(se.x_);
  }
}
