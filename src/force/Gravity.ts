import { Earth } from '../body/Earth';
import { J2000 } from '../coordinate/J2000';
import { Vector3D } from '../operations/Vector3D';
import { Force } from './Force';

// / Simple central-body gravity model.
export class Gravity implements Force {
  // / Gravitational parameter _(km²/s³)_.
  mu: number;

  /**
   * Create a new [Gravity] object with optional gravitational
   * @param mu Gravitational parameter _(km²/s³)_.
   */
  constructor(mu: number = Earth.mu) {
    this.mu = mu;
  }

  /**
   * Calculates the gravitational force in spherical coordinates.
   *
   * @param state The J2000 state containing the position and velocity vectors.
   * @returns The gravitational force vector in spherical coordinates.
   */
  private _spherical(state: J2000): Vector3D {
    const rMag = state.position.magnitude();

    return state.position.scale(-this.mu / (rMag * rMag * rMag));
  }

  /**
   * Calculates the acceleration due to gravity at a given state.
   *
   * @param state The J2000 state at which to calculate the acceleration.
   * @returns The acceleration vector.
   */
  acceleration(state: J2000): Vector3D {
    return this._spherical(state);
  }
}
