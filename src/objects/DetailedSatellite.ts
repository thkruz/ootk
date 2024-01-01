/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file The DetailedSat class is an extension of the Sat class that provides additional
 * properties for categorizing and filtering satellites.
 *
 * @license MIT License
 * @Copyright (c) 2020-2024 Theodore Kruczek
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { LaunchDetails, OperationsDetails, SpaceCraftDetails } from '../types/types';
import { OptionsParams, Satellite, SatelliteObjectParams } from './Satellite';

/**
 * Represents a detailed satellite object with launch, spacecraft, and operations details.
 */
export class DetailedSat extends Satellite {
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
    info: SatelliteObjectParams,
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
