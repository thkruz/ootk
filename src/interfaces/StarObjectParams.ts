import { BaseObjectParams } from '../objects/BaseObject';
import { Radians } from '../types/types';

export interface StarObjectParams extends BaseObjectParams {
  ra: Radians;
  dec: Radians;
  bf?: string;
  h?: string;
  pname?: string;
  vmag?: number;
  constellation?: string;
  colorTemp?: number;
  hr?: number;
  flamsteed?: string;
  bayer?: string;
}
