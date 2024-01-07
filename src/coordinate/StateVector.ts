import { Earth } from '../body/Earth';
import type { Vector3D } from '../operations/Vector3D';
import type { EpochUTC } from '../time/EpochUTC';
import { TAU } from '../utils/constants';
import { ClassicalElements } from './ClassicalElements';

// / Position and velocity [Vector3D] container.
export type PositionVelocity = {
  position: Vector3D;
  velocity: Vector3D;
};

// / Base class for state vectors.
export abstract class StateVector {
  constructor(public epoch: EpochUTC, public position: Vector3D, public velocity: Vector3D) {
    // Nothing to do here.
  }

  abstract get name(): string;

  abstract get inertial(): boolean;

  toString(): string {
    return [
      `[${this.name}]`,
      `  Epoch: ${this.epoch}`,
      `  Position: ${this.position.toString(6)} km`,
      `  Velocity: ${this.velocity.toString(9)} km/s`,
    ].join('\n');
  }

  mechanicalEnergy(): number {
    const r = this.position.magnitude();
    const v = this.velocity.magnitude();

    return v * v * 0.5 - Earth.mu / r;
  }

  semimajorAxis(): number {
    const energy = this.mechanicalEnergy();

    return -Earth.mu / (2.0 * energy);
  }

  period(): number {
    const a = this.semimajorAxis();

    return TAU * Math.sqrt((a * a * a) / Earth.mu);
  }

  angularRate(): number {
    const a = this.semimajorAxis();

    return Math.sqrt(Earth.mu / (a * a * a));
  }

  toClassicalElements({ mu = Earth.mu }: { mu?: number } = {}): ClassicalElements {
    if (!this.inertial) {
      throw new Error('Classical elements are undefined for fixed frames.');
    }

    return ClassicalElements.fromStateVector(this, mu);
  }
}
