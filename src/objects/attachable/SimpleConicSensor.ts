import { BaseObjectAdv, Degrees, RaeVec3, SensorAdv, SensorParams } from '../../main.js';

export interface SimpleConicSensorParams extends SensorParams {
  coneHalfAngle: Degrees;
}

export class SimpleConicSensor extends SensorAdv {
  coneHalfAngle: Degrees;

  constructor(params: SimpleConicSensorParams) {
    super(params);
    this.coneHalfAngle = params.coneHalfAngle;
  }

  isRaeInFov(rae: RaeVec3): boolean {
    /*
     * if (rae.rng > this.rng) {
     *   return false;
     * }
     */
    const azDiff = rae.az - this.orientation.azimuth;
    const elDiff = rae.el - this.orientation.elevation;
    const angularSeparation = Math.sqrt(azDiff * azDiff + elDiff * elDiff);


    return angularSeparation <= this.coneHalfAngle;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(baseObject: BaseObjectAdv, ...args: unknown[]): void {
  // Do nothing
  }

  toJSON(): string {
    return `${SimpleConicSensor.name} ${JSON.stringify({
      ...JSON.parse(super.toJSON()),
      coneHalfAngle: this.coneHalfAngle,
    })}`;
  }

  static fromJSON(json: string): SimpleConicSensor {
    const data = JSON.parse(json);


    return new SimpleConicSensor(data);
  }
}
