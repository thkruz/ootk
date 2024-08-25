import { BaseObjectAdv, Degrees, RaeVec3, SensorAdv, SensorParams } from '../../main.js';

export interface RectangularSensorParams extends SensorParams {
  verticalHalfAngle: Degrees;
  horizontalHalfAngle: Degrees;
}

export class RectangularSensor extends SensorAdv {
  verticalHalfAngle: Degrees;
  horizontalHalfAngle: Degrees;

  constructor(params: RectangularSensorParams) {
    super(params);
    this.verticalHalfAngle = params.verticalHalfAngle;
    this.horizontalHalfAngle = params.horizontalHalfAngle;
  }

  isRaeInFov(rae: RaeVec3): boolean {
    /*
     * if (rae.rng > this.rng) {
     *   return false;
     * }
     */
    const azDiff = Math.abs(rae.az - this.orientation.azimuth);
    const elDiff = Math.abs(rae.el - this.orientation.elevation);

    return azDiff <= this.horizontalHalfAngle && elDiff <= this.verticalHalfAngle;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(baseObject: BaseObjectAdv, ...args: unknown[]): void {
    // Do nothing
  }

  toJSON(): string {
    return `${RectangularSensor.name} ${JSON.stringify({
      ...JSON.parse(super.toJSON()),
      verticalHalfAngle: this.verticalHalfAngle,
      horizontalHalfAngle: this.horizontalHalfAngle,
    })}`;
  }

  static fromJSON(json: string): RectangularSensor {
    const data = JSON.parse(json);


    return new RectangularSensor(data);
  }
}
