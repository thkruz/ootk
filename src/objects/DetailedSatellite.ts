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

import { CatalogSource, FormatTle } from '../main.js';
import { DetailedSensor } from './DetailedSensor.js';
import { Satellite } from './Satellite.js';
import { DetailedSatelliteParams, LaunchDetails, OperationsDetails, SpaceCraftDetails, TleLine1, TleLine2 } from '../types/types.js';

/**
 * Represents a detailed satellite object with launch, spacecraft, and operations details.
 */
export class DetailedSatellite extends Satellite {
  configuration: string = '';
  country: string = '';
  dryMass: string = '';
  equipment: string = '';
  launchDate: string = '';
  launchMass: string = '';
  launchSite: string = '';
  launchVehicle: string = '';
  lifetime: string | number = '';
  maneuver: string = '';
  manufacturer: string = '';
  mission: string = '';
  bus: string = '';
  motor: string = '';
  owner: string = '';
  payload: string = '';
  power: string = '';
  purpose: string = '';
  length: string = '';
  diameter: string = '';
  shape: string = '';
  span: string = '';
  user: string = '';
  source: string = '';
  vmag: number|null;
  rcs: number|null;
  altId: string = '';
  altName: string = '';
  sensors: DetailedSensor[] = [];
  active: boolean;

  constructor(
    info: DetailedSatelliteParams & LaunchDetails & OperationsDetails & SpaceCraftDetails,
  ) {
    if (info.source === CatalogSource.VIMPEL) {
      info = DetailedSatellite.setSccNumTo0_(info);
    }

    super(info);

    this.active ??= true;
    this.initSpaceCraftDetails_(info);
    this.length = info.length ?? '';
    this.diameter = info.diameter ?? '';
    this.source = info.source ?? '';
    this.vmag = info.vmag ?? null;
    this.rcs = info.rcs ?? null;
    this.altId = info.altId ?? '';
    this.altName = info.altName ?? '';
    this.initOperationDetails_(info);
    this.initLaunchDetails_(info);
  }

  private static setSccNumTo0_(info: DetailedSatelliteParams & LaunchDetails & OperationsDetails & SpaceCraftDetails) {
    info.tle1 = FormatTle.setCharAt(info.tle1, 2, '0') as TleLine1;
    info.tle1 = FormatTle.setCharAt(info.tle1, 3, '0') as TleLine1;
    info.tle1 = FormatTle.setCharAt(info.tle1, 4, '0') as TleLine1;
    info.tle1 = FormatTle.setCharAt(info.tle1, 5, '0') as TleLine1;
    info.tle1 = FormatTle.setCharAt(info.tle1, 6, '0') as TleLine1;
    info.tle2 = FormatTle.setCharAt(info.tle2, 2, '0') as TleLine2;
    info.tle2 = FormatTle.setCharAt(info.tle2, 3, '0') as TleLine2;
    info.tle2 = FormatTle.setCharAt(info.tle2, 4, '0') as TleLine2;
    info.tle2 = FormatTle.setCharAt(info.tle2, 5, '0') as TleLine2;
    info.tle2 = FormatTle.setCharAt(info.tle2, 6, '0') as TleLine2;

    return info;
  }

  private initSpaceCraftDetails_(
    info: DetailedSatelliteParams &
          LaunchDetails & OperationsDetails &
          SpaceCraftDetails,
  ) {
    this.lifetime = info.lifetime ?? '';
    this.maneuver = info.maneuver ?? '';
    this.manufacturer = info.manufacturer ?? '';
    this.motor = info.motor ?? '';
    this.power = info.power ?? '';
    this.payload = info.payload ?? '';
    this.purpose = info.purpose ?? '';
    this.shape = info.shape ?? '';
    this.span = info.span ?? '';
    this.bus = info.bus ?? '';
    this.configuration = info.configuration ?? '';
    this.equipment = info.equipment ?? '';
    this.dryMass = info.dryMass ?? '';
  }

  private initOperationDetails_(info: DetailedSatelliteParams & LaunchDetails & OperationsDetails & SpaceCraftDetails) {
    this.mission = info.mission ?? '';
    this.user = info.user ?? '';
    this.owner = info.owner ?? '';
    this.country = info.country ?? '';
  }

  private initLaunchDetails_(info: DetailedSatelliteParams & LaunchDetails & OperationsDetails & SpaceCraftDetails) {
    this.launchDate = info.launchDate ?? '';
    this.launchMass = info.launchMass ?? '';
    this.launchSite = info.launchSite ?? '';
    this.launchVehicle = info.launchVehicle ?? '';
  }

  /**
   * Returns the launch details of the satellite.
   * @returns An object containing the launch date, launch mass, launch site, and launch vehicle of the satellite.
   */
  getLaunchDetails(): LaunchDetails {
    return {
      launchDate: this.launchDate,
      launchMass: this.launchMass,
      launchSite: this.launchSite,
      launchVehicle: this.launchVehicle,
    };
  }

  /**
   * Returns an object containing the details of the operations.
   * @returns An object containing the user, mission, owner, and country details.
   */
  getOperationsDetails(): OperationsDetails {
    return {
      user: this.user,
      mission: this.mission,
      owner: this.owner,
      country: this.country,
    };
  }

  /**
   * Returns the space craft details.
   * @returns The space craft details.
   */
  getSpaceCraftDetails(): SpaceCraftDetails {
    return {
      lifetime: this.lifetime,
      maneuver: this.maneuver,
      manufacturer: this.manufacturer,
      motor: this.motor,
      power: this.power,
      payload: this.payload,
      purpose: this.purpose,
      shape: this.shape,
      span: this.span,
      configuration: this.configuration,
      equipment: this.equipment,
      dryMass: this.dryMass,
    };
  }

  attachSensor(sensor: DetailedSensor) {
    if (this.sensors.includes(sensor)) {
      return;
    }

    if (sensor.parent) {
      sensor.parent.dettachSensor(sensor);
    }

    this.sensors.push(sensor);
    sensor.parent = this;
  }

  dettachSensor(sensor: DetailedSensor) {
    this.sensors = this.sensors.filter((s) => s !== sensor);
    sensor.parent = null;
  }

  clone(): DetailedSatellite {
    return new DetailedSatellite(this);
  }
}
