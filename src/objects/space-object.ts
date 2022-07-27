import { BaseObject } from './base-object';
import { SpaceObjectType } from '../types/types';

interface ObjectInfo {
  name?: string;
  type?: SpaceObjectType;
  rcs?: number;
  vmag?: number;
}

export class SpaceObject extends BaseObject {
  public rcs: number;

  public vmag: number;

  constructor(info: ObjectInfo) {
    super(info);

    if (info.rcs) {
      this.rcs = info.rcs;
    }

    if (info.vmag) {
      this.vmag = info.vmag;
    }
  }

  public getRcs(): number {
    return this.rcs;
  }

  public getVmag(): number {
    return this.vmag;
  }
}
