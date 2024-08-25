import { azel2uv, BaseObjectAdv, DEG2RAD, Degrees, Kilometers, RAD2DEG, Radians, RaeVec3, SensorAdv, SensorParams, uv2azel } from '../../main.js';

export interface RadarSensorParams extends SensorParams {
  minRng: Kilometers;
  minAz: Degrees;
  minEl: Degrees;
  maxRng: Kilometers;
  maxAz: Degrees;
  maxEl: Degrees;
  coneHalfAngle: Degrees;
}

export class RadarSensor extends SensorAdv {
  minRng: Kilometers;
  minAz: Degrees;
  minEl: Degrees;
  maxRng: Kilometers;
  maxAz: Degrees;
  maxEl: Degrees;
  coneHalfAngle: Degrees;

  constructor(params: RadarSensorParams) {
    super(params);
    this.minRng = params.minRng;
    this.minAz = params.minAz;
    this.minEl = params.minEl;
    this.maxRng = params.maxRng;
    this.maxAz = params.maxAz;
    this.maxEl = params.maxEl;
    this.coneHalfAngle = params.coneHalfAngle;
  }

  isRaeInFov(rae: RaeVec3): boolean {
    if (rae.el < this.minEl || rae.el > this.maxEl) {
      return false;
    }
    if (rae.rng < this.minRng || rae.rng > this.maxRng) {
      return false;
    }

    if (this.minAz > this.maxAz) {
      // North Facing Sensors
      if (rae.az < this.minAz && rae.az > this.maxAz) {
        return false;
      }
    } else if (rae.az < this.minAz || rae.az > this.maxAz) {
      return false;
    }

    return true;
  }

  /**
   * Converts azimuth and elevation angles to unit vector coordinates.
   * @param az - The azimuth angle in degrees.
   * @param el - The elevation angle in degrees.
   * @returns The unit vector coordinates.
   */
  uvFromAzEl(az: Degrees, el: Degrees) {
    const azRad = (az * DEG2RAD) as Radians;
    const elRad = (el * DEG2RAD) as Radians;
    const azDiff = (azRad - this.orientation.azimuth) as Radians;
    const elDiff = (elRad - this.orientation.elevation) as Radians;

    return azel2uv(azDiff, elDiff, this.beamwidthRad);
  }

  /**
   * Converts the given UV coordinates to azimuth and elevation angles.
   * @param u - The U coordinate.
   * @param v - The V coordinate.
   * @returns An object containing the azimuth and elevation angles in degrees.
   */
  azElFromUV(u: number, v: number) {
    const { az, el } = uv2azel(u, v, this.beamwidthRad);

    return {
      az: ((az + this.orientation.azimuth) * RAD2DEG) as Degrees,
      el: ((el + this.orientation.elevation) * RAD2DEG) as Degrees,
    };
  }

  /**
   * Converts the boresight azimuth angle to radians.
   * @returns The boresight azimuth angle in radians.
   */
  boresightAzRad() {
    return (this.orientation.azimuth * DEG2RAD) as Radians;
  }

  /**
   * Converts the boresight elevation angle of the sensor to radians.
   * @returns The boresight elevation angle in radians.
   */
  boresightElRad() {
    return (this.orientation.elevation * DEG2RAD) as Radians;
  }

  /**
   * Gets the beamwidth in radians.
   * @returns The beamwidth in radians.
   */
  get beamwidthRad() {
    return (this.coneHalfAngle * DEG2RAD) as Radians;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(baseObject: BaseObjectAdv, ...args: unknown[]): void {
    // Do nothing
  }

  toJSON(): string {
    return `${RadarSensor.name} ${JSON.stringify({
      ...JSON.parse(super.toJSON()),
    })}`;
  }

  static fromJSON(json: string): RadarSensor {
    const data = JSON.parse(json);


    return new RadarSensor(data);
  }
}
