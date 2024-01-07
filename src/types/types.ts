import { Degrees, Milliseconds } from 'ootk-core';

export enum ZoomValue {
  LEO = 0.45,
  GEO = 0.82,
  MAX = 1,
}

export interface DetailedSatelliteParams {
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
  vmag?: number;
  rcs?: number;
  source?: string;
  altId?: string;
  altName?: string;
}

export interface DetailedSensorParams {
  /** The country that owns the sensor */
  country?: string;
  /** 3 Letter Designation */
  shortName?: string;
  /** For radars, this is the width of the beam */
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
  /** Does this sensor use a volumetric search pattern? */
  volume?: boolean;
  /** How far away should we zoom when selecting this sensor? */
  zoom: ZoomValue;
  /** For radar sensors, what frequency does this sensor operate in? */
  band?: string;
  /** This is the name of the object in the array */
  objName?: string;
  /** This is the name of the object in the UI */
  uiName?: string;
  /** This is the specific system (ex. AN/FPS-132) */
  system?: string;
  /** This is who operates the sensor */
  operator?: string;
}
