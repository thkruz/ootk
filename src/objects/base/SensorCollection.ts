import { AttachableObject, BaseObjectAdv, RaeVec3, SensorAdv } from '../../main.js';

export interface SensorCollectionParams {
  name: string;
  sensors: SensorAdv[];
}

export class SensorCollection extends AttachableObject {
  sensors: SensorAdv[];
  constructor(info: SensorCollectionParams) {
    super(info);
    this.sensors = info.sensors || [];
  }

  attachTo(object: BaseObjectAdv): void {
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

  addSensor(sensor: SensorAdv): void {
    this.sensors.push(sensor);
  }

  removeSensor(sensor: SensorAdv): void {
    const index = this.sensors.indexOf(sensor);

    if (index > -1) {
      this.sensors.splice(index, 1);
    }
  }

  update(baseObject: BaseObjectAdv): void {
    this.sensors.forEach((sensor) => sensor.update(baseObject));
  }

  toJSON(): string {
    return JSON.stringify({
      ...JSON.parse(super.toJSON()),
      sensors: this.sensors,
    });
  }
}
