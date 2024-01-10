/**
 * @author @thkruz Theodore Kruczek
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2024 Theodore Kruczek
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
  EciVec3,
  Kilometers,
  LaunchDetails,
  OperationsDetails,
  OptionsParams,
  Satellite,
  SatelliteParams,
  SpaceCraftDetails,
  Vector3D,
} from 'ootk-core';
import { DetailedSatelliteParams } from '../types/types';

/**
 * Represents a detailed satellite object with launch, spacecraft, and operations details.
 */
export class DetailedSatellite extends Satellite {
  /** A global index - this is NOT the sccNum */
  configuration: string;
  country: string;
  dryMass: string;
  equipment: string;
  launchDate: string;
  launchMass: string;
  launchSite: string;
  launchVehicle: string;
  lifetime: string | number;
  maneuver: string;
  manufacturer: string;
  mission: string;
  bus: string;
  motor: string;
  owner: string;
  payload: string;
  power: string;
  purpose: string;
  length: string;
  diameter: string;
  shape: string;
  span: string;
  user: string;
  source: string;
  vmag: number;
  rcs: number;
  totalVelocity: number;
  velocity: EciVec3<Kilometers>;
  semiMajorAxis: number;
  semiMinorAxis: number;
  altId: string;
  altName: string;

  constructor(
    info: DetailedSatelliteParams & SatelliteParams & LaunchDetails & OperationsDetails & SpaceCraftDetails,
    options?: OptionsParams,
  ) {
    super(info, options);

    this.active ??= true;
    this.setLaunchDetails(info);
    this.setSpaceCraftDetails(info);
    this.setOperationsDetails(info);

    Object.keys(info).forEach((key) => {
      this[key] = info[key];
    });
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
   * @returns {SpaceCraftDetails} The space craft details.
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

  /**
   * Propagates the satellite position to the given date using the SGP4 model.
   *
   * This method changes the position and time properties of the satellite object.
   */
  propagateTo(date: Date): this {
    const pv = this.getEci(date);

    this.position = pv.position;
    this.velocity = pv.velocity;
    this.totalVelocity = new Vector3D(pv.velocity.x, pv.velocity.y, pv.velocity.z).magnitude() as Kilometers;
    this.time = date;

    return this;
  }

  /**
   * Sets the launch details of the satellite.
   * @param details - The launch details to set.
   */
  setLaunchDetails(details: LaunchDetails): void {
    const keys = ['launchDate', 'launchMass', 'launchSite', 'launchVehicle'];

    keys.forEach((key) => {
      if (details[key]) {
        this[key] = details[key];
      }
    });
  }

  /**
   * Sets the operations details for the satellite.
   * @param details - The operations details to set.
   */
  setOperationsDetails(details: OperationsDetails): void {
    const keys = ['user', 'mission', 'owner', 'country'];

    keys.forEach((key) => {
      if (details[key]) {
        this[key] = details[key];
      }
    });
  }

  /**
   * Sets the details of a spacecraft.
   * @param details - The details of the spacecraft to set.
   */
  setSpaceCraftDetails(details: SpaceCraftDetails): void {
    const keys = [
      'lifetime',
      'maneuver',
      'manufacturer',
      'motor',
      'power',
      'payload',
      'purpose',
      'shape',
      'span',
      'configuration',
      'equipment',
      'dryMass',
    ];

    keys.forEach((key) => {
      if (details[key]) {
        this[key] = details[key];
      }
    });
  }
}
