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
