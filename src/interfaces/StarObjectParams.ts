import { Radians } from '../types/types.js';

export interface StarObjectParams {
  ra: Radians;
  dec: Radians;
  bf?: string;
  h?: string;
  name?: string;
  pname?: string;
  vmag?: number;
}
