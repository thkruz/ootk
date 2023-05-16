/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The SpaceObject class is meant to provide properties to satellites/stars that
 * do not apply to ground based objects.
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2023 Theodore Kruczek
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

import { BaseObject } from './base-object';
import { SpaceObjectType } from '../types/types';

interface ObjectInfo {
  name?: string;
  type?: SpaceObjectType;
  rcs?: number;
  vmag?: number;
}

export class SpaceObject extends BaseObject {
  public rcs: number;

  public vmag: number;

  constructor(info: ObjectInfo) {
    super(info);

    if (info.rcs) {
      this.rcs = info.rcs;
    }

    if (info.vmag) {
      this.vmag = info.vmag;
    }
  }

  public getRcs(): number {
    return this.rcs;
  }

  public getVmag(): number {
    return this.vmag;
  }
}
