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

import { Degrees, EcfVec3, Kilometers, KilometersPerSecond, LlaVec3, Orientation, PosVel, Radians, RaeVec3 } from 'src/main.js';
import { AttachableObject } from '../attachable/AttachableObject.js';
import { CommonBase, CommonBaseParams } from '../CommonBase.js';

export interface BaseObjectParams extends CommonBaseParams {
  name?: string;
  orientation?: Orientation;
  attachedObjects?: AttachableObject[];
}

export abstract class BaseObjectAdv extends CommonBase {
  name: string;
  orientation: Orientation;
  attachedObjects: AttachableObject[];

  constructor(params: BaseObjectParams) {
    super(params);
    this.name = params.name ?? '';
    // Default orientation is true north at the horizon
    this.orientation = params.orientation ?? {
      azimuth: 0 as Degrees,
      elevation: 0 as Degrees,
    };
    this.attachedObjects = params.attachedObjects ?? [];
  }

  abstract lla(date?: Date): LlaVec3<Degrees, Kilometers>;
  abstract llaRad(date?: Date): LlaVec3<Radians, Kilometers>;
  abstract rae(targetObject: BaseObjectAdv, date?: Date): RaeVec3;
  abstract ecf(date?: Date): EcfVec3<Kilometers>;
  abstract eci(date?: Date): PosVel<Kilometers, KilometersPerSecond>;

  attachObject(object: AttachableObject): void {
    if (!this.attachedObjects.includes(object)) {
      this.attachedObjects.push(object);
      object.attachTo(this);
    }
  }

  detachObject(object: AttachableObject): void {
    const index = this.attachedObjects.indexOf(object);

    if (index > -1) {
      this.attachedObjects.splice(index, 1);
      object.detach();
    }
  }

  protected notifyAttachedObjects(): void {
    this.attachedObjects.forEach((object) => object.update(this));
  }

  toJSON(): string {
    return JSON.stringify({
      ...JSON.parse(super.toJSON()),
      name: this.name,
      attachedObjects: this.attachedObjects,
    });
  }
}
