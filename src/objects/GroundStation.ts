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

import type { Geodetic } from '../coordinate/Geodetic';
import { Degrees, Kilometers, SpaceObjectType } from '../types/types';
import { GroundObject, GroundObjectParams } from './GroundObject';

/**
 * Parameters for constructing a GroundStation.
 */
export interface GroundStationParams extends GroundObjectParams {
  // GroundStation uses same params as GroundObject
}

/**
 * A concrete ground station that can host sensors and communication devices.
 * Use this class for fixed ground locations like tracking stations, observatories, etc.
 */
export class GroundStation extends GroundObject {
  constructor(info: GroundStationParams) {
    super({
      ...info,
      type: info.type ?? SpaceObjectType.GROUND_SENSOR_STATION,
    });
  }

  /**
   * Creates a GroundStation from a Geodetic position.
   * @param geodetic - The geodetic coordinates
   * @param name - Optional name for the station
   * @param id - Optional unique identifier
   */
  static fromGeodetic(geodetic: Geodetic, name?: string, id?: number): GroundStation {
    return new GroundStation({
      id,
      name,
      lat: geodetic.latDeg as Degrees,
      lon: geodetic.lonDeg as Degrees,
      alt: geodetic.alt,
    });
  }

  /**
   * Creates a deep copy of this ground station.
   */
  clone(): GroundStation {
    const cloned = new GroundStation({
      id: this.id,
      name: this.name,
      type: this.type,
      lat: this.lat,
      lon: this.lon,
      alt: this.alt,
      active: this.active,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });

    // Copy sensors and comm devices references
    cloned.sensors = [...this.sensors];
    cloned.commDevices = [...this.commDevices];

    return cloned;
  }

  /**
   * Creates a new GroundStation at a different position.
   * The original instance remains unchanged.
   * @param lat - New latitude in degrees
   * @param lon - New longitude in degrees
   * @param alt - Optional new altitude in kilometers (defaults to current altitude)
   * @returns A new GroundStation at the specified position
   */
  moveTo(lat: Degrees, lon: Degrees, alt?: Kilometers): GroundStation {
    return new GroundStation({
      id: this.id,
      name: this.name,
      type: this.type,
      lat,
      lon,
      alt: alt ?? this.alt,
      active: this.active,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }

  /**
   * Returns true since GroundStation is always a ground object.
   */
  override isGroundObject(): boolean {
    return true;
  }

  /**
   * Returns type-specific serialization data.
   */
  protected serializeSpecific(): Record<string, unknown> {
    return {
      lat: this.lat,
      lon: this.lon,
      alt: this.alt,
      sensorIds: this.sensors.map((s) => s.id),
      commDeviceIds: this.commDevices.map((d) => d.id),
    };
  }

  toString(): string {
    return [
      '[GroundStation]',
      `  ID: ${this.id}`,
      `  Name: ${this.name}`,
      `  Location: ${this.lat.toFixed(4)}°, ${this.lon.toFixed(4)}°, ${this.alt.toFixed(3)} km`,
      `  Sensors: ${this.sensors.length}`,
      `  Comm Devices: ${this.commDevices.length}`,
    ].join('\n');
  }
}
