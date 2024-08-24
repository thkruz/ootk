import { AttachableObject, BaseObject, RaeVec3, Sensor } from '../../main.js';

export interface SensorCollectionParams {
  name: string;
  sensors: Sensor[];
}

export class SensorCollection extends AttachableObject {
  sensors: Sensor[];
  constructor(info: SensorCollectionParams) {
    super(info);
    this.sensors = info.sensors || [];
  }

  attachTo(object: BaseObject): void {
    this.parent = object;
    this.sensors.forEach((sensor) => sensor.attachTo(object));
  }

  detach(): void {
    this.parent = null;
    this.sensors.forEach((sensor) => sensor.detach());
  }

  isRaeInFov(rae: RaeVec3): boolean {
    return this.sensors.some((sensor) => sensor.isRaeInFov(rae));
  }

  addSensor(sensor: Sensor): void {
    this.sensors.push(sensor);
  }

  removeSensor(sensor: Sensor): void {
    const index = this.sensors.indexOf(sensor);

    if (index > -1) {
      this.sensors.splice(index, 1);
    }
  }

  update(baseObject: BaseObject): void {
    this.sensors.forEach((sensor) => sensor.update(baseObject));
  }

  toJSON(): string {
    return JSON.stringify({
      ...JSON.parse(super.toJSON()),
      sensors: this.sensors,
    });
  }
}
