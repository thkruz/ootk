import { Earth } from '../body/Earth';
import { EpochUTC } from '../time/EpochUTC';
import { secondsPerDay, TAU } from '../utils/constants';
import { newtonM } from '../utils/functions';
import { ClassicalElements } from './ClassicalElements';
import { PositionVelocity } from './StateVector';
/** Equinoctial element set. */
export class EquinoctialElements {
  mu: number;
  fr: number;
  /** Create a new [EquinoctialElements] object from orbital elements. */
  constructor(
    public epoch: EpochUTC,
    public af: number,
    public ag: number,
    public l: number,
    public n: number,
    public chi: number,
    public psi: number,
    { mu = Earth.mu, fr = 1 }: { mu?: number; fr?: number } = {},
  ) {
    this.mu = mu;
    this.fr = fr;
  }

  toString(): string {
    return [
      '[EquinoctialElements]',
      `  Epoch: ${this.epoch}`,
      `  af: ${this.af}`,
      `  ag: ${this.ag}`,
      `  l: ${this.l} rad`,
      `  n: ${this.n} rad/s`,
      `  chi: ${this.chi}`,
      `  psi: ${this.psi}`,
    ].join('\n');
  }

  /** Return the orbit semimajor-axis _(km)_. */
  semimajorAxis(): number {
    return Math.cbrt(this.mu / (this.n * this.n));
  }
  /** Compute the mean motion _(rad/s)_ of this orbit. */
  meanMotion(): number {
    const a = this.semimajorAxis();

    return Math.sqrt(this.mu / (a * a * a));
  }

  /** Compute the period _(seconds)_ of this orbit. */
  period(): number {
    return TAU * Math.sqrt(this.semimajorAxis() ** 3 / this.mu);
  }

  // / Compute the number of revolutions completed per day for this orbit.
  revsPerDay(): number {
    return secondsPerDay / this.period();
  }

  // / Convert this to [ClassicalElements].
  toClassicalElements(): ClassicalElements {
    const a = this.semimajorAxis();
    const e = Math.sqrt(this.af * this.af + this.ag * this.ag);
    const i =
      Math.PI * ((1.0 - this.fr) * 0.5) +
      2.0 * this.fr * Math.atan(Math.sqrt(this.chi * this.chi + this.psi * this.psi));
    const o = Math.atan2(this.chi, this.psi);
    const w = Math.atan2(this.ag, this.af) - this.fr * Math.atan2(this.chi, this.psi);
    const m = this.l - this.fr * o - w;
    const v = newtonM(e, m).nu;

    return new ClassicalElements({
      epoch: this.epoch,
      semimajorAxis: a,
      eccentricity: e,
      inclination: i,
      rightAscension: o,
      argPerigee: w,
      trueAnomaly: v,
      mu: this.mu,
    });
  }

  /** Convert this to inertial position and velocity vectors. */
  toPositionVelocity(): PositionVelocity {
    return this.toClassicalElements().toPositionVelocity();
  }
}
