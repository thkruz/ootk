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

import { BaseObjectParams, Degrees, Milliseconds, Radians, Sensor, SensorParams } from 'ootk-core';
import { DetailedSensorParams, ZoomValue } from '../types/types';

export class DetailedSensor extends Sensor {
  country?: string;
  latRad: Radians;
  lonRad: Radians;
  shortName?: string;
  beamwidth?: Degrees;
  changeObjectInterval?: Milliseconds;
  linkAehf?: boolean;
  linkGalileo?: boolean;
  linkIridium?: boolean;
  linkStarlink?: boolean;
  linkWgs?: boolean;
  static?: boolean;
  sensorId?: number;
  url?: string;
  volume?: boolean;
  zoom: ZoomValue;
  band?: string;
  objName?: string;
  uiName?: string;
  system?: string;
  operator?: string;

  constructor(info: DetailedSensorParams & SensorParams & BaseObjectParams) {
    super(info);
    this.country = info.country;
    this.latRad = (info.lat * (Math.PI / 180)) as Radians;
    this.lonRad = (info.lon * (Math.PI / 180)) as Radians;
    this.shortName = info.shortName;
    this.beamwidth = info.beamwidth;
    this.changeObjectInterval = info.changeObjectInterval;
    this.linkAehf = info.linkAehf;
    this.linkGalileo = info.linkGalileo;
    this.linkIridium = info.linkIridium;
    this.linkStarlink = info.linkStarlink;
    this.linkWgs = info.linkWgs;
    this.static = info.static;
    this.sensorId = info.sensorId;
    this.url = info.url;
    this.volume = info.volume;
    this.zoom = info.zoom;
    this.band = info.band;
    this.objName = info.objName;
    this.uiName = info.uiName;
    this.system = info.system;
    this.operator = info.operator;
  }
}
