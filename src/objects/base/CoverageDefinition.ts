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

import { Degrees, Kilometers, MarkerAdv } from '../../main.js';

export interface CoverageDefinitionParams {
  name: string;
  minLat: Degrees;
  maxLat: Degrees;
  minLon: Degrees;
  maxLon: Degrees;
  resolution: Kilometers;
}

export class CoverageDefinition {
  private name: string;
  private minLat: Degrees;
  private maxLat: Degrees;
  private minLon: Degrees;
  private maxLon: Degrees;
  private resolution: Kilometers;
  private markers: MarkerAdv[];

  constructor(params: CoverageDefinitionParams) {
    this.name = params.name;
    this.minLat = params.minLat;
    this.maxLat = params.maxLat;
    this.minLon = params.minLon;
    this.maxLon = params.maxLon;
    this.resolution = params.resolution;
    this.markers = [];

    this.generateMarkers();
  }

  private generateMarkers(): void {
    const latSteps = Math.ceil((this.maxLat - this.minLat) / this.resolution);
    const lonSteps = Math.ceil((this.maxLon - this.minLon) / this.resolution);

    for (let i = 0; i <= latSteps; i++) {
      for (let j = 0; j <= lonSteps; j++) {
        const lat = this.minLat + (i * this.resolution) as Degrees;
        const lon = this.minLon + (j * this.resolution) as Degrees;
        const markerName = `${this.name}_${lat}_${lon}`;
        const marker = new MarkerAdv({
          name: markerName,
          lat,
          lon,
          alt: 0 as Kilometers, // Assuming markers are at ground level
        });

        this.markers.push(marker);
      }
    }
  }

  getMarkers(): MarkerAdv[] {
    return this.markers;
  }

  getName(): string {
    return this.name;
  }

  updateResolution(newResolution: Kilometers): void {
    this.resolution = newResolution;
    this.markers = [];
    this.generateMarkers();
  }

  isAnyMarkerInView(isInViewFunction: (marker: MarkerAdv) => boolean): boolean {
    return this.markers.some(isInViewFunction);
  }

  getMarkersInView(isInViewFunction: (marker: MarkerAdv) => boolean): MarkerAdv[] {
    return this.markers.filter(isInViewFunction);
  }

  toJSON(): string {
    return JSON.stringify({
      name: this.name,
      minLat: this.minLat,
      maxLat: this.maxLat,
      minLon: this.minLon,
      maxLon: this.maxLon,
      resolution: this.resolution,
      markers: this.markers,
    });
  }

  static fromJSON(json: string): CoverageDefinition {
    const data = JSON.parse(json) as CoverageDefinition;

    const coverageDefinition = new CoverageDefinition({
      name: data.name,
      minLat: data.minLat,
      maxLat: data.maxLat,
      minLon: data.minLon,
      maxLon: data.maxLon,
      resolution: data.resolution,
    });

    coverageDefinition.markers = data.markers.map((markerData) => MarkerAdv.fromJSON(JSON.stringify(markerData)));

    return coverageDefinition;
  }
}
