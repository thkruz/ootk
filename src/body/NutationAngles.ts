import { Radians } from '@src/ootk';

// / Earth nutation angles _(rad)_.
export type NutationAngles = {
  dPsi: Radians;
  dEps: Radians;
  mEps: Radians;
  eps: Radians;
  eqEq: Radians;
  gast: Radians;
};
