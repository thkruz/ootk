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

import { BaseObject } from './BaseObject.js';
import { BaseObjectParams, Degrees, Kilometers } from '../main.js';
/* eslint-disable class-methods-use-this */

export interface LandObjectParams extends BaseObjectParams {
  lat: Degrees;
  lon: Degrees;
  alt: Kilometers;
  country?: string;
  Code?: string;
}

export class LandObject extends BaseObject {
  lat: Degrees;
  lon: Degrees;
  alt: Kilometers;
  country?: string;
  Code?: string;

  constructor(info: LandObjectParams) {
    super(info);
    this.lat = info.lat;
    this.lon = info.lon;
    this.alt = info.alt;
  }

  isLandObject() {
    return true;
  }
}
