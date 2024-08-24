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

import { Degrees } from '../../main.js';

interface AzElPair {
  azimuth: Degrees;
  elevation: Degrees;
}

export class AzElMask {
  private mask: AzElPair[];

  constructor(initialMask?: AzElPair[]) {
    this.mask = initialMask || [];
    this.sortMask();
  }

  // Add a new azimuth-elevation pair to the mask
  addPair(azimuth: Degrees, elevation: Degrees): void {
    this.mask.push({ azimuth, elevation });
    this.sortMask();
  }

  // Get the minimum elevation for a given azimuth
  getMinElevation(azimuth: Degrees): Degrees {
    if (this.mask.length === 0) {
      return 0 as Degrees;
    }

    // Normalize azimuth to [0, 360)
    azimuth = ((azimuth % 360) + 360) % 360 as Degrees;

    // Find the two closest azimuth points
    let left = this.mask[this.mask.length - 1];
    let right = this.mask[0];

    for (let i = 0; i < this.mask.length; i++) {
      if (this.mask[i].azimuth > azimuth) {
        right = this.mask[i];
        left = this.mask[i === 0 ? this.mask.length - 1 : i - 1];
        break;
      }
    }

    // Interpolate
    const azDiff = (right.azimuth - left.azimuth + 360) % 360;
    const elDiff = right.elevation - left.elevation;
    const ratio = ((azimuth - left.azimuth + 360) % 360) / azDiff;

    return (left.elevation + ratio * elDiff) as Degrees;
  }

  // Validate if a given elevation is above the mask for a given azimuth
  isAboveMask(azimuth: Degrees, elevation: Degrees): boolean {
    return elevation >= this.getMinElevation(azimuth);
  }

  // Get the entire mask
  getMask(): AzElPair[] {
    return [...this.mask];
  }

  // Set the entire mask
  setMask(newMask: AzElPair[]): void {
    this.mask = [...newMask];
    this.sortMask();
  }

  // Clear the mask
  clearMask(): void {
    this.mask = [];
  }

  // Sort the mask by azimuth
  private sortMask(): void {
    this.mask.sort((a, b) => a.azimuth - b.azimuth);
  }

  // Serialize to JSON
  toJSON(): string {
    return JSON.stringify(this.mask);
  }

  // Deserialize from JSON
  static fromJSON(json: string): AzElMask {
    const data = JSON.parse(json) as AzElPair[];


    return new AzElMask(data);
  }
}
