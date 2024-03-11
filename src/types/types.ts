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

import { Kilometers, Milliseconds, SatelliteParams, SensorParams, Vec3 } from 'ootk-core';
import { CommLink } from '../main';

export enum ZoomValue {
  LEO = 0.45,
  GEO = 0.82,
  MAX = 1,
}

export interface DetailedSatelliteParams extends SatelliteParams {
  id: number;
  active?: boolean;
  configuration?: string;
  country?: string;
  dryMass?: string;
  equipment?: string;
  launchDate?: string;
  launchMass?: string;
  launchSite?: string;
  launchVehicle?: string;
  lifetime?: string | number;
  maneuver?: string;
  manufacturer?: string;
  mission?: string;
  motor?: string;
  owner?: string;
  bus?: string;
  payload?: string;
  power?: string;
  purpose?: string;
  length?: string;
  diameter?: string;
  shape?: string;
  span?: string;
  user?: string;
  vmag?: number | null;
  rcs?: number | null;
  source?: string;
  altId?: string;
  altName?: string;
}

export interface DetailedSensorParams extends SensorParams {
  /** The country that owns the sensor */
  country?: string;
  /** 3 Letter Designation */
  shortName?: string;
  changeObjectInterval?: Milliseconds;
  commLinks?: CommLink[];
  freqBand?: string;
  static?: boolean;
  sensorId?: number;
  url?: string;
  /** Does this sensor use a volumetric search pattern? */
  volume?: boolean;
  /** How far away should we zoom when selecting this sensor? */
  zoom?: ZoomValue;
  /** This is the name of the object in the array */
  objName?: string;
  /** This is the name of the object in the UI */
  uiName?: string;
  /** This is the specific system (ex. AN/FPS-132) */
  system?: string;
  /** This is who operates the sensor */
  operator?: string;
}
/**
 * The RUV coordinate system is a spherical coordinate system with the origin at
 * the radar. The RUV coordinate system is defined with respect to the radar
 * boresight. The R-axis points outward along the boresight with the origin at
 * the radar. The U-axis is in the horizontal plane and points to the right of
 * the boresight. The V-axis is in the vertical plane and points down from the
 * boresight.
 * @template DistanceUnit The unit of measure used for the altitude dimension.
 * This is typically a type representing a distance, such as kilometers or
 * meters. The default is Kilometers.
 * @template AngleUnit The unit of measure used for the latitude and longitude
 * dimensions. This is typically a type representing an angle, such as degrees
 * or radians. The default is Radians.
 */

export type RuvVec3<DistanceUnit = Kilometers> = {
  rng: DistanceUnit;
  u: number;
  v: number;
};
/**
 * Phased Array Radar Face Cartesian Coordinates The cartesian coordinates (XRF,
 * YRF ZRF) are defined with respect to the phased array radar face. The radar
 * face lies in the XRF-YRF plane, with the XRF-axis horizontal and the YRF-axis
 * pointing upward. The ZRF-axis points outward along the normal to the array
 * face.
 *
 * The orientation of the phased array face is defined by the azimuth and the
 * elevation of the phased array boresight (i.e., the phased array Z-axis).
 */

export type RfVec3<Units = Kilometers> = Vec3<Units>;

/**
 * Represents a function that calculates the Jacobian matrix.
 * @param xs - The input values as a Float64Array. @returns The Jacobian matrix
 * as a Float64Array.
 */
export type JacobianFunction = (xs: Float64Array) => Float64Array;

/**
 * Represents a differentiable function.
 * @param x The input value. @returns The output value.
 */

export type DifferentiableFunction = (x: number) => number;
