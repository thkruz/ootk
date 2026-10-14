/**
 * QA 2026-10 regression tests for RungeKuttaAdaptive.ephemerisManeuver and step rejection
 * (report section 2.3, RungeKuttaAdaptive.ts:188-193 and 246-251).
 */
import { PropagationError } from '../../errors';
import { ForceModel } from '../../force/ForceModel';
import { KeplerPropagator } from '../KeplerPropagator';
import { RungeKutta89Propagator } from '../RungeKutta89Propagator';
import {
  DormandPrince54Propagator,
  EpochUTC,
  J2000,
  Kilometers,
  KilometersPerSecond,
  MetersPerSecond,
  Seconds,
  Thrust,
  Vector3D,
} from '../../main';

const epoch = EpochUTC.fromDateTimeString('2024-01-01T00:00:00.000Z');
const leo = (): J2000 => new J2000(
  epoch,
  new Vector3D<Kilometers>(6778 as Kilometers, 0 as Kilometers, 0 as Kilometers),
  new Vector3D<KilometersPerSecond>(0 as KilometersPerSecond, 7.6686 as KilometersPerSecond, 0 as KilometersPerSecond),
);
const burn = (offsetSec: number, intrackMps: number): Thrust => new Thrust(
  epoch.roll(offsetSec as Seconds),
  0 as MetersPerSecond,
  intrackMps as MetersPerSecond,
  0 as MetersPerSecond,
);

describe('RungeKuttaAdaptive.ephemerisManeuver window filter (QA 2026-10)', () => {
  const finish = epoch.roll(1800 as Seconds);

  it('excludes a maneuver entirely after the window', () => {
    const after = burn(3600, 10);
    const got = new DormandPrince54Propagator(leo()).ephemerisManeuver(epoch, finish, [after], 60 as Seconds)
      .interpolate(finish);
    const clean = new DormandPrince54Propagator(leo()).propagate(finish);

    expect(got!.position.subtract(clean.position).magnitude()).toBeLessThan(1e-3);
  });

  it('applies a maneuver inside the window (an impulsive 1 m/s in-track burn moves the state)', () => {
    const inside = burn(600, 1);
    const got = new DormandPrince54Propagator(leo()).ephemerisManeuver(epoch, finish, [inside], 60 as Seconds)
      .interpolate(finish);
    const clean = new DormandPrince54Propagator(leo()).propagate(finish);

    // 1 m/s in-track over 1200 s changes the position by kilometres (CW drift is about 3 * dv * t).
    expect(got!.position.subtract(clean.position).magnitude()).toBeGreaterThan(1);
  });

  it('gives the same result whatever order the maneuvers are passed in', () => {
    const first = burn(300, 1);
    const second = burn(900, -2);
    const ordered = new DormandPrince54Propagator(leo())
      .ephemerisManeuver(epoch, finish, [first, second], 60 as Seconds).interpolate(finish);
    const reversed = new DormandPrince54Propagator(leo())
      .ephemerisManeuver(epoch, finish, [second, first], 60 as Seconds).interpolate(finish);

    expect(ordered!.position.subtract(reversed!.position).magnitude()).toBeLessThan(1e-6);
  });
});

describe('RungeKuttaAdaptive.propagate step rejection (QA 2026-10)', () => {
  it('throws PropagationError instead of returning a state at the wrong epoch', () => {
    class ChatteringForceModel extends ForceModel {
      private sign_ = 1;

      acceleration(state: J2000): Vector3D {
        this.sign_ = -this.sign_;

        return super.acceleration(state).add(new Vector3D(1e3 * this.sign_, 1e3 * this.sign_, 1e3 * this.sign_));
      }
    }
    const prop = new DormandPrince54Propagator(leo(), new ChatteringForceModel().setGravity());

    expect(() => prop.propagate(epoch.roll(60 as Seconds))).toThrow(PropagationError);
  });
});

describe('RungeKuttaAdaptive tolerance below the roundoff floor (QA 2026-10)', () => {
  it('RK89 at 1e-12 km reaches the requested epoch and matches the two-body solution', () => {
    /*
     * 1e-12 km is below one ulp of a 6778 km position (about 9e-13 km), so the embedded error
     * estimate cannot meet it. Before the fix this silently returned a state minutes short of the
     * target; the roundoff floor lets it finish. Independent reference: the analytic Kepler
     * propagator for the same point-mass two-body problem (Vallado section 2.2).
     */
    const target = epoch.roll(3600 as Seconds);
    const rk = new RungeKutta89Propagator(leo(), new ForceModel().setGravity(), 1e-12).propagate(target);
    const kepler = new KeplerPropagator(leo().toClassicalElements()).propagate(target);

    expect(rk.epoch.posix).toBe(target.posix);
    expect(rk.position.subtract(kepler.position).magnitude()).toBeLessThan(1e-6);
  });
});
