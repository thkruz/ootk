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

import { EpochUTC, EpochWindow, J2000 } from '../main.js';
import { ChebyshevCoefficients } from './ChebyshevCoefficients.js';
import { StateInterpolator } from './StateInterpolator.js';

/**
 * Compressed Chebyshev ephemeris interpolator.
 *
 * The ChebyshevInterpolator sacrifices state accuracy in order to gain
 * speed and memory requirements, so you can store many ephemerides in RAM
 * and interpolate through them quickly.
 *
 * Using more coefficients per revolution during lossy compression results
 * in increased accuracy and decreased performance.
 */
export class ChebyshevInterpolator extends StateInterpolator {
  private _coefficients: ChebyshevCoefficients[];

  constructor(coefficients: ChebyshevCoefficients[]) {
    super();
    this._coefficients = coefficients;
  }

  private _calcSizeBytes(): number {
    let output = 0;

    for (const coeffs of this._coefficients) {
      output += coeffs.sizeBytes;
    }

    return output;
  }

  get sizeBytes(): number {
    return this._calcSizeBytes();
  }

  interpolate(epoch: EpochUTC): J2000 | null {
    if (!this.inWindow(epoch)) {
      return null;
    }
    const coeffs = this._matchCoefficients(epoch.posix);
    const { position: pos, velocity: vel } = coeffs.interpolate(epoch.posix);

    return new J2000(epoch, pos, vel);
  }

  window(): EpochWindow {
    return new EpochWindow(
      new EpochUTC(this._coefficients[0].a),
      new EpochUTC(this._coefficients[this._coefficients.length - 1].b),
    );
  }

  private _matchCoefficients(posix: number): ChebyshevCoefficients {
    let left = 0;
    let right = this._coefficients.length;

    while (left < right) {
      const middle = (left + right) >> 1;

      if (this._coefficients[middle].b < posix) {
        left = middle + 1;
      } else {
        right = middle;
      }
    }

    return this._coefficients[left];
  }
}
