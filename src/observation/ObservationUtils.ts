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

import { Matrix } from 'ootk-core';

export const normalizeAngle = (a: number, b: number): number => {
  const x = a - b;

  return Math.atan2(Math.sin(x), Math.cos(x));
};

export const observationDerivative = (xh: number, xl: number, step: number, isAngle = false): number =>
  (isAngle ? normalizeAngle(xh, xl) : xh - xl) / step;

export const observationNoiseFromSigmas = (sigmas: number[]): Matrix => {
  const n = sigmas.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0.0));

  for (let i = 0; i < n; i++) {
    const s = sigmas[i];

    result[i][i] = 1 / (s * s);
  }

  return new Matrix(result);
};
