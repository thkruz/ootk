import { CommonBase, CommonBaseParams } from '../CommonBase.js';
import { BaseObject } from '../base/BaseObject.js';
import { SatelliteObserver } from '../base/Satellite.js';

export interface AttachableObjectParams extends CommonBaseParams {
  name: string;
}

export abstract class AttachableObject extends CommonBase implements SatelliteObserver {
  name: string;
  parent: BaseObject | null = null;

  constructor(params: AttachableObjectParams) {
    super(params);
    this.name = params.name;
  }

  attachTo(object: BaseObject): void {
    this.parent = object;
  }

  detach(): void {
    this.parent = null;
  }

  abstract update(baseObject: BaseObject): void;

  toJSON(): string {
    return JSON.stringify({
      ...JSON.parse(super.toJSON()),
      name: this.name,
      parentId: this.parent?.id,
    });
  }
}
