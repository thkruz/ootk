import { J2000, Vector3D } from 'ootk-core';
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */

// / Base class for perturbation forces.
export abstract class Force {
  /**
   * Calculate the acceleration due to the perturbing force on a given
   * state vector.
   */
  acceleration(state: J2000): Vector3D {
    throw Error('Not implemented');
  }
}
