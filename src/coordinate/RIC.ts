/* eslint-disable class-methods-use-this */
import { Matrix } from '../operations/Matrix';
import { J2000 } from './J2000';
import { RelativeState } from './RelativeState';

/**
 * Represents a Radial-Intrack-Crosstrack (RIC) coordinate.
 *
 * RIC coordinates are created from J2000 state vectors and can be transformed to the J2000 coordinate system.
 */
export class RIC extends RelativeState {
  /**
   * Creates a new RIC (Radial-Intrack-Crosstrack) coordinate from the J2000 state vectors.
   * @param state The J2000 state vector.
   * @param origin The J2000 state vector of the origin.
   * @param transform The transformation matrix.
   * @returns The RIC coordinate.
   */
  static fromJ2000Matrix(state: J2000, origin: J2000, transform: Matrix): RIC {
    const dr = state.position.subtract(origin.position);
    const dv = state.velocity.subtract(origin.velocity);

    return new RIC(transform.multiplyVector3D(dr), transform.multiplyVector3D(dv));
  }

  /**
   * Creates a RIC (Radial-Intrack-Crosstrack) coordinate system from a J2000 state and origin.
   * @param state The J2000 state.
   * @param origin The J2000 origin.
   * @returns The RIC coordinate system.
   */
  static fromJ2000(state: J2000, origin: J2000): RIC {
    return RIC.fromJ2000Matrix(state, origin, RelativeState.createMatrix(origin.position, origin.velocity));
  }

  /**
   * Gets the name of the RIC coordinate system.
   * @returns The name of the RIC coordinate system.
   */
  get name(): string {
    return 'RIC';
  }

  /**
   * Transforms the current RIC coordinate to the J2000 coordinate system using the provided origin and transform matrix
   * @param origin The origin J2000 coordinate.
   * @param transform The transformation matrix.
   * @returns The transformed J2000 coordinate.
   */
  toJ2000Matrix(origin: J2000, transform: Matrix): J2000 {
    const tt = transform.transpose();
    const tr = tt.multiplyVector3D(this.position);
    const tv = tt.multiplyVector3D(this.velocity);

    return new J2000(origin.epoch, origin.position.add(tr), origin.velocity.add(tv));
  }

  /**
   * Transforms the current RIC coordinate to the J2000 coordinate system using the provided origin.
   * @param origin The origin J2000 coordinate.
   * @returns The transformed J2000 coordinate.
   */
  toJ2000(origin: J2000): J2000 {
    return this.toJ2000Matrix(origin, RelativeState.createMatrix(origin.position, origin.velocity));
  }
}
