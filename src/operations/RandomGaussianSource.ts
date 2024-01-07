import { Vector, Vector3D } from 'ootk-core';
import { BoxMuller } from './BoxMuller';

export class RandomGaussianSource {
  private _boxMuller: BoxMuller;

  constructor(seed = 0) {
    this._boxMuller = new BoxMuller(0, 1, seed);
  }

  nextGauss(): number {
    return this._boxMuller.nextGauss();
  }

  gaussVector(n: number): Vector {
    if (n < 1) {
      throw new Error('n must be greater than 0');
    }

    const result = new Vector([this.nextGauss()]);

    for (let i = 0; i < n; i++) {
      if (i > 0) {
        result.add(new Vector[this.nextGauss()]());
      }
    }

    return result;
  }

  gaussSphere(radius = 1.0): Vector3D {
    return this.gaussVector(3).toVector3D(0).normalize().scale(radius);
  }
}
