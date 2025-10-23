import { Radians } from '../types/types';

export interface StarObjectParams {
  ra: Radians;
  dec: Radians;
  bf?: string;
  h?: string;
  name?: string;
  pname?: string;
  vmag?: number;
}
