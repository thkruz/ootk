/* eslint-disable class-methods-use-this */
import { BaseObjectParams, Degrees, Kilometers } from '../types/types';
import { BaseObject } from './BaseObject';

export interface LandObjectParams {
  id: number;
  lat: Degrees;
  lon: Degrees;
  alt: Kilometers;
  country?: string;
  Code?: string;
}

export class LandObject extends BaseObject {
  id: number;
  lat: Degrees;
  lon: Degrees;
  alt: Kilometers;
  country?: string;
  Code?: string;

  constructor(info: LandObjectParams & BaseObjectParams) {
    super(info);

    Object.assign(this, info);
  }

  isLandObject() {
    return true;
  }
}
