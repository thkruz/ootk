import { Earth } from '../body/Earth';
import { J2000 } from '../coordinate/J2000';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';

/**
 * Herrik-Gibbs 3-position initial orbit determination.
 *
 * Possibly better than regular Gibbs IOD for closely spaced position
 * vectors _(less than 5°)_.
 */
export class HerrickGibbsIOD {
  /**
   * Create a new [HerrickGibbsIOD] object with optional
   * gravitational parameter [mu].
   */
  constructor(public mu: number = Earth.mu) {
    // Nothing to do here.
  }

  // / Attempt to create a state estimate from three inertial position vectors.
  solve(r1: Vector3D, t1: EpochUTC, r2: Vector3D, t2: EpochUTC, r3: Vector3D, t3: EpochUTC): J2000 {
    const dt31 = t3.difference(t1);
    const dt32 = t3.difference(t2);
    const dt21 = t2.difference(t1);
    const r1m = r1.magnitude();
    const r2m = r2.magnitude();
    const r3m = r3.magnitude();
    const vA = r1.scale(-dt32 * (1.0 / (dt21 * dt31) + this.mu / (12.0 * r1m * r1m * r1m)));
    const vB = r2.scale((dt32 - dt21) * (1.0 / (dt21 * dt32) + this.mu / (12.0 * r2m * r2m * r2m)));
    const vC = r3.scale(dt21 * (1.0 / (dt32 * dt31) + this.mu / (12.0 * r3m * r3m * r3m)));
    const v2 = vA.add(vB).add(vC);

    return new J2000(t2, r2, v2);
  }
}
