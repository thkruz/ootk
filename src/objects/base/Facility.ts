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

import {
  Degrees, AzElMask,
  GroundObjectParams,
  GroundObject, AttachableObject,
  Geodetic,
} from '../../main.js';
import { AltitudeReference } from './GroundObject.js';

export interface FacilityParams extends GroundObjectParams {
  altRef?: AltitudeReference;
  azElMask?: AzElMask | null;
  processingDelay?: number;
}

export class Facility extends GroundObject {
  private azElMask_: AzElMask | null;
  private processingDelay_: number;

  constructor(params: FacilityParams) {
    super(params);

    this.azElMask_ = params.azElMask || null;
    this.processingDelay_ = params.processingDelay ?? 0;
  }

  attach(object: AttachableObject): void {
    this.attachedObjects.push(object);
  }

  detach(object: AttachableObject): void {
    this.attachedObjects = this.attachedObjects.filter((attachedObject) => attachedObject !== object);
  }

  // Override toJSON method
  toJSON(): string {
    return JSON.stringify({
      ...JSON.parse(super.toJSON()),
      azElMask: this.azElMask_,
      processingDelay: this.processingDelay_,
      attachedObjects: this.attachedObjects.map((attachedObject) => attachedObject.toJSON()),
    });
  }

  /**
   * Creates a Facility object from a Geodetic position.
   * @param name The name of the Facility.
   * @param geodetic The geodetic coordinates.
   * @returns A new Facility object.
   */
  static fromGeodetic(name: string, geodetic: Geodetic): GroundObject {
    return new Facility({
      name,
      lat: geodetic.latDeg as Degrees,
      lon: geodetic.lonDeg as Degrees,
      alt: geodetic.alt,
    });
  }

  // Static fromJSON method
  static fromJSON(json: string): Facility {
    const data = JSON.parse(json);


    return new Facility({
      id: data.id,
      name: data.name,
      shortDescription: data.shortDescription,
      longDescription: data.longDescription,
      lat: data.latitude,
      lon: data.longitude,
      alt: data.altitude,
      azElMask: data.azElMask ? AzElMask.fromJSON(JSON.stringify(data.azElMask)) : null,
      processingDelay: data.processingDelay,
      attachedObjects: data.attachedObjects.map((attachedObject: string) => {
        // the class name is the first word in the string
        const className = attachedObject.split(' ')[0];
        // the rest of the string is the JSON data
        const json = attachedObject.slice(className.length + 1);
        // get the class from the global scope
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Class = (globalThis as any)[className];
        // return a new instance of the class

        return Class.fromJSON(json);
      }),
    });
  }
}
