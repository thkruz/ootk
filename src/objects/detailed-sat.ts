/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The DetailedSat class is an extension of the Sat class that provides additional
 * properties for categorizing and filtering satellites.
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

import {
  LaunchDetails,
  OperationsDetails,
  SpaceCraftDetails,
  SpaceObjectType,
  TleLine1,
  TleLine2,
} from '../types/types';

import { OptionsParams, Sat } from './sat';

/**
 * Information about a space object.
 */
interface ObjectInfo {
  name?: string;
  rcs?: number;
  tle1: TleLine1;
  tle2: TleLine2;
  type?: SpaceObjectType;
  vmag?: number;
}

/**
 * Represents a detailed satellite object with launch, spacecraft, and operations details.
 */
export class DetailedSat extends Sat {
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
  motor: string;
  owner: string;
  payload: string;
  power: string;
  purpose: string;
  shape: string;
  span: string;
  user: string;

  constructor(
    info: ObjectInfo,
    options: OptionsParams,
    details: {
      launchDetails: LaunchDetails;
      spaceCraftDetails: SpaceCraftDetails;
      operationsDetails: OperationsDetails;
    },
  ) {
    super(info, options);

    this.setLaunchDetails(details.launchDetails);
    this.setSpaceCraftDetails(details.spaceCraftDetails);
    this.setOperationsDetails(details.operationsDetails);
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
