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

import { LaunchDetails, OperationsDetails, SpaceCraftDetails, SpaceObjectType } from '../types/types';

import { Sat } from './sat';

interface ObjectInfo {
  name?: string;
  type?: SpaceObjectType;
  rcs?: number;
  vmag?: number;
  tle1: string;
  tle2: string;
}

export class DetailedSat extends Sat {
  public launchDate: string;

  public launchMass: string;

  public launchSite: string;

  public launchVehicle: string;

  public lifetime: string | number;

  public maneuver: string;

  public manufacturer: string;

  public motor: string;

  public power: string;

  public payload: string;

  public purpose: string;

  public shape: string;

  public span: string;

  public user: string;

  public mission: string;

  public owner: string;

  public configuration: string;

  public equipment: string;

  public dryMass: string;

  public country: string;

  constructor(
    info: ObjectInfo,
    options,
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

  public setLaunchDetails(details: LaunchDetails): void {
    if (details.launchDate) {
      this.launchDate = details.launchDate;
    }
    if (details.launchMass) {
      this.launchMass = details.launchMass;
    }
    if (details.launchSite) {
      this.launchSite = details.launchSite;
    }
    if (details.launchVehicle) {
      this.launchVehicle = details.launchVehicle;
    }
  }

  public getLaunchDetails(): LaunchDetails {
    return {
      launchDate: this.launchDate,
      launchMass: this.launchMass,
      launchSite: this.launchSite,
      launchVehicle: this.launchVehicle,
    };
  }

  public setSpaceCraftDetails(details: SpaceCraftDetails): void {
    if (details.lifetime) {
      this.lifetime = details.lifetime;
    }
    if (details.maneuver) {
      this.maneuver = details.maneuver;
    }
    if (details.manufacturer) {
      this.manufacturer = details.manufacturer;
    }
    if (details.motor) {
      this.motor = details.motor;
    }
    if (details.power) {
      this.power = details.power;
    }
    if (details.payload) {
      this.payload = details.payload;
    }
    if (details.purpose) {
      this.purpose = details.purpose;
    }
    if (details.shape) {
      this.shape = details.shape;
    }
    if (details.span) {
      this.span = details.span;
    }
    if (details.configuration) {
      this.configuration = details.configuration;
    }
    if (details.equipment) {
      this.equipment = details.equipment;
    }
    if (details.dryMass) {
      this.dryMass = details.dryMass;
    }
  }

  public getSpaceCraftDetails(): SpaceCraftDetails {
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

  public setOperationsDetails(details: OperationsDetails): void {
    if (details.user) {
      this.user = details.user;
    }
    if (details.mission) {
      this.mission = details.mission;
    }
    if (details.owner) {
      this.owner = details.owner;
    }
    if (details.country) {
      this.country = details.country;
    }
  }

  public getOperationsDetails(): OperationsDetails {
    return {
      user: this.user,
      mission: this.mission,
      owner: this.owner,
      country: this.country,
    };
  }
}
