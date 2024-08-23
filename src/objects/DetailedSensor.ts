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

import { CommLink } from '../enums/CommLink.js';
import { DetailedSensorParams, Milliseconds, ZoomValue } from '../types/types.js';
import { DetailedSatellite } from './DetailedSatellite.js';
import { LandObject } from './LandObject.js';
import { Sensor } from './Sensor.js';

export class DetailedSensor extends Sensor {
  sensorId?: number;
  objName?: string;
  shortName?: string;
  uiName?: string;
  country?: string;
  dwellTime?: Milliseconds;
  freqBand?: string;
  commLinks: CommLink[];
  /** Is this sensor volumetric? */
  isVolumetric?: boolean;
  /** The ideal zoom to see the sensor's full FOV */
  zoom?: ZoomValue | number;
  system?: string;
  operator?: string;
  url?: string;
  parent: LandObject | DetailedSatellite | null = null;

  constructor(info: DetailedSensorParams) {
    super(info);
    this.commLinks = info.commLinks ?? [];
    this.country = info.country;
    this.dwellTime = info.changeObjectInterval;
    this.freqBand = info.freqBand;
    this.isVolumetric = info.volume;
    this.objName = info.objName;
    this.operator = info.operator;
    this.sensorId = info.sensorId;
    this.shortName = info.shortName;
    this.system = info.system;
    this.uiName = info.uiName;
    this.url = info.url;
    this.zoom = info.zoom;
  }

  isStatic(): boolean {
    return true;
  }
}
