import { AttachableObject, BaseObjectAdv, Degrees, ecf2rae, Kilometers, LlaVec3, Orientation, Radians, RaeVec3, SensorMetaData } from '../../main.js';
import { SatelliteObserver } from '../base/SatelliteAdv.js';
import { AttachableObjectParams } from './AttachableObject.js';
import { SensorMetaDataParams } from './SensorMetaData.js';

export interface SensorParams extends AttachableObjectParams, SensorMetaDataParams {
  orientation?: Orientation;
  color?: string;
  opacity?: number;
}

export abstract class SensorAdv extends AttachableObject implements SatelliteObserver {
  orientation: Orientation;
  color: string;
  opacity: number;
  metadata: SensorMetaData;

  constructor(params: SensorParams) {
    super(params);
    this.orientation = params.orientation ?? {
      azimuth: 0 as Degrees,
      elevation: 0 as Degrees,
    };
    this.color = params.color ?? '#FFFFFF';
    this.opacity = params.opacity ?? 1.0;
    this.metadata = new SensorMetaData(params);
  }

  llaRad(date?: Date): LlaVec3<Radians, Kilometers> {
    return this.parent?.llaRad(date) ?? { lat: 0 as Radians, lon: 0 as Radians, alt: 0 as Kilometers };
  }

  lla(date?: Date): LlaVec3<Degrees, Kilometers> {
    return this.parent?.lla(date) ?? { lat: 0 as Degrees, lon: 0 as Degrees, alt: 0 as Kilometers };
  }
  rae(targetObject: BaseObjectAdv, date?: Date): RaeVec3<Kilometers, Degrees> {
    const overallOrientation = {
      azimuth: (this.parent?.orientation.azimuth ?? 0) + this.orientation.azimuth as Degrees,
      elevation: (this.parent?.orientation.elevation ?? 0) + this.orientation.elevation as Degrees,
    };

    return ecf2rae(this.lla(), targetObject.ecf(date), overallOrientation);
  }

  abstract isRaeInFov(rae: RaeVec3): boolean;
  abstract update(baseObject: BaseObjectAdv): void;

  toJSON(): string {
    return JSON.stringify({
      ...JSON.parse(super.toJSON()),
      color: this.color,
      opacity: this.opacity,
    });
  }
}
