import { Matrix } from '../operations/Matrix';
import { Vector3D } from '../operations/Vector3D';
import { J2000 } from './J2000';

// / Base class for relative states.
export abstract class RelativeState {
  // / Create a new [RelativeState] object.
  constructor(public position: Vector3D, public velocity: Vector3D) {
    // Nothing to do here.
  }

  // / Return the name of this coordinate frame.
  abstract get name(): string;

  toString(): string {
    return [
      `[${this.name}]`,
      `  Position: ${this.position.toString(6)} km`,
      `  Velocity: ${this.velocity.toString(9)} km/s`,
    ].join('\n');
  }

  // / Convert this to a [J2000] state vector object.
  abstract toJ2000(origin: J2000): J2000;

  /**
   * Creates a matrix based on the given position and velocity vectors.
   * The matrix represents the relative state of an object in 3D space.
   *
   * @param position - The position vector.
   * @param velocity - The velocity vector.
   * @returns The matrix representing the relative state.
   */
  static createMatrix(position: Vector3D, velocity: Vector3D): Matrix {
    const ru = position.normalize();
    const cu = position.cross(velocity).normalize();
    const iu = cu.cross(ru).normalize();

    return new Matrix([
      [ru.x, ru.y, ru.z],
      [iu.x, iu.y, iu.z],
      [cu.x, cu.y, cu.z],
    ]);
  }

  // / Return the relative range _(km)_.
  range(): number {
    return this.position.magnitude();
  }

  // / Return the relative range rate _(km/s)_.
  rangeRate(): number {
    return this.position.dot(this.velocity) / this.range();
  }
}
