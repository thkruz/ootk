import { SensorAdv, AttachableObject, BaseObjectAdv, Degrees, SensorParams, RaeVec3 } from '../../main.js';

export interface ComplexConicSensorParams extends SensorParams {
  innerHalfAngle: Degrees;
  outerHalfAngle: Degrees;
  minClockAngle: Degrees;
  maxClockAngle: Degrees;
}

export class ComplexConicSensor extends SensorAdv implements AttachableObject {
  public innerHalfAngle: Degrees;
  public outerHalfAngle: Degrees;
  public minClockAngle: Degrees;
  public maxClockAngle: Degrees;

  constructor(params: ComplexConicSensorParams) {
    super(params);
    this.innerHalfAngle = params.innerHalfAngle;
    this.outerHalfAngle = params.outerHalfAngle;
    this.minClockAngle = params.minClockAngle;
    this.maxClockAngle = params.maxClockAngle;
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

    if (angularSeparation < this.innerHalfAngle || angularSeparation > this.outerHalfAngle) {
      return false;
    }

    const clockAngle = (Math.atan2(elDiff, azDiff) * 180 / Math.PI + 360) % 360 as Degrees;


    return clockAngle >= this.minClockAngle && clockAngle <= this.maxClockAngle;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(baseObject: BaseObjectAdv, ...args: unknown[]): void {
  // Do nothing
  }

  toJSON(): string {
    return `${ComplexConicSensor.name} ${JSON.stringify({
      ...JSON.parse(super.toJSON()),
      innerHalfAngle: this.innerHalfAngle,
      outerHalfAngle: this.outerHalfAngle,
      minClockAngle: this.minClockAngle,
      maxClockAngle: this.maxClockAngle,
    })}`;
  }

  static fromJSON(json: string): ComplexConicSensor {
    const data = JSON.parse(json);


    return new ComplexConicSensor(data);
  }
}
