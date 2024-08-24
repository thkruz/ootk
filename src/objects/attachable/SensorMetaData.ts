import { CommLink, Milliseconds, ZoomValue } from '../../main.js';

export interface SensorMetaDataParams {
  sensorId?: number;
  objName?: string;
  shortName?: string;
  uiName?: string;
  country?: string;
  dwellTime?: Milliseconds;
  freqBand?: string;
  commLinks?: CommLink[];
  isVolumetric?: boolean;
  zoom?: ZoomValue | number;
  system?: string;
  operator?: string;
  url?: string;
}

export class SensorMetaData {
  sensorId!: number;
  objName!: string;
  shortName!: string;
  uiName!: string;
  country!: string;
  dwellTime!: Milliseconds;
  freqBand!: string;
  commLinks!: CommLink[];
  isVolumetric!: boolean;
  zoom!: ZoomValue | number;
  system!: string;
  operator!: string;
  url!: string;

  constructor(params: Partial<SensorMetaData>) {
    Object.assign(this, {
      sensorId: 0,
      objName: '',
      shortName: '',
      uiName: '',
      country: '',
      dwellTime: 0,
      freqBand: '',
      commLinks: [],
      isVolumetric: false,
      zoom: 0,
      system: '',
      operator: '',
      url: '',
      ...params,
    });
  }
}
