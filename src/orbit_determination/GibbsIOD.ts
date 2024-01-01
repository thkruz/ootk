import { EpochUTC } from '@src/time/EpochUTC';
import { Earth } from '../body/Earth';
import { J2000 } from '../coordinate/J2000';
import { Vector3D } from '../operations/Vector3D';
import { deg2rad, halfPi } from '../utils/constants';
import { ForceModel } from './../force/ForceModel';
import { RungeKutta89Propagator } from './../propagator/RungeKutta89Propagator';

// / Gibbs 3-position inital orbit determination.
export class GibbsIOD {
  /**
   * Create a new [GibbsIOD] object, with an optional gravitational
   * parameter [mu].
   */
  constructor(public mu: number = Earth.mu) {
    // Nothing to do here.
  }

  // / Abort solve if position plane exceeds this value.
  private static readonly _coplanarThreshold: number = 5.0 * deg2rad;

  /**
   * Attempt to create a state estimate from three inertial position vectors.
   *
   * Throws an error if the positions are not coplanar.
   */
  solve(r1: Vector3D, r2: Vector3D, r3: Vector3D, t2: EpochUTC, t3: EpochUTC): J2000 {
    const num = r1.normalize().dot(r2.normalize().cross(r3.normalize()));
    const alpha = halfPi - Math.acos(num);

    if (Math.abs(alpha) > GibbsIOD._coplanarThreshold) {
      throw new Error('Orbits are not coplanar.');
    }

    const r1m = r1.magnitude();
    const r2m = r2.magnitude();
    const r3m = r3.magnitude();

    const d = r1.cross(r2).add(r2.cross(r3).add(r3.cross(r1)));
    const n = r2.cross(r3).scale(r1m).add(r3.cross(r1).scale(r2m)).add(r1.cross(r2).scale(r3m));
    const b = d.cross(r2);
    const s = r1.scale(r2m - r3m).add(r2.scale(r3m - r1m).add(r3.scale(r1m - r2m)));

    const nm = n.magnitude();
    const dm = d.magnitude();

    const vm = Math.sqrt(this.mu / (nm * dm));
    const vlEci = b.scale(vm / r2m).add(s.scale(vm));

    const pv = new J2000(t2, r2, vlEci);

    const forceModel = new ForceModel().setGravity(this.mu);
    const orbit = new RungeKutta89Propagator(pv, forceModel);

    const pv2 = new J2000(t2, r2, vlEci.negate());
    const orbit2 = new RungeKutta89Propagator(pv2, forceModel);

    const estP3 = orbit.propagate(t3).position;
    const dist = estP3.subtract(r3).magnitude();
    const estP3b = orbit2.propagate(t3).position;
    const dist2 = estP3b.subtract(r3).magnitude();

    if (dist <= dist2) {
      orbit.reset();

      return orbit.propagate(t2);
    }
    orbit2.reset();

    return orbit2.propagate(t2);
  }
}
