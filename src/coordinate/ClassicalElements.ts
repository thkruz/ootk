import { Earth } from '../body/Earth';
import { Vector3D } from '../operations/Vector3D';
import { EpochUTC } from '../time/EpochUTC';
import { RAD2DEG, sec2min, secondsPerDay, TAU } from '../utils/constants';
import { clamp, matchHalfPlane, newtonNu } from '../utils/functions';
import { EquinoctialElements } from './EquinoctialElements';
import { OrbitRegime } from './OrbitRegime';
import { PositionVelocity, StateVector } from './StateVector';

interface ClassicalElementsParams {
  epoch: EpochUTC;
  semimajorAxis: number;
  eccentricity: number;
  inclination: number;
  rightAscension: number;
  argPerigee: number;
  trueAnomaly: number;
  mu?: number;
}

// / Classical orbital elements.
export class ClassicalElements {
  // / UTC epoch
  epoch: EpochUTC;
  // / Semimajor-axis _(km)_.
  semimajorAxis: number;
  // / Eccentricity _(unitless)_.
  eccentricity: number;
  // / Inclination _(rad)_.
  inclination: number;
  // / Right-ascension of the ascending node _(rad)_.
  rightAscension: number;
  // / Argument of perigee _(rad)_.
  argPerigee: number;
  // / True anomaly _(rad)_.
  trueAnomaly: number;
  // / Gravitational parameter _(km³/s²)_.
  mu: number;

  /** Create a new [ClassicalElements] object from orbital elements. */
  constructor({
    epoch,
    semimajorAxis,
    eccentricity,
    inclination,
    rightAscension,
    argPerigee,
    trueAnomaly,
    mu = Earth.mu,
  }: ClassicalElementsParams) {
    this.epoch = epoch;
    this.semimajorAxis = semimajorAxis;
    this.eccentricity = eccentricity;
    this.inclination = inclination;
    this.rightAscension = rightAscension;
    this.argPerigee = argPerigee;
    this.trueAnomaly = trueAnomaly;
    this.mu = mu;
  }

  /**
   * Creates a new instance of ClassicalElements from a StateVector.
   * @param state The StateVector to convert.
   * @param mu The gravitational parameter of the central body. Default value is Earth's gravitational parameter.
   * @returns A new instance of ClassicalElements.
   * @throws Error if classical elements are undefined for fixed frames.
   */
  static fromStateVector(state: StateVector, mu = Earth.mu): ClassicalElements {
    if (!state.inertial) {
      throw new Error('Classical elements are undefined for fixed frames.');
    }
    const pos = state.position;
    const vel = state.velocity;
    const a = state.semimajorAxis();
    const eVecA = pos.scale(vel.magnitude() ** 2 - mu / pos.magnitude());
    const eVecB = vel.scale(pos.dot(vel));
    const eVec = eVecA.subtract(eVecB).scale(1 / mu);
    const e = eVec.magnitude();
    const h = pos.cross(vel);
    const i = Math.acos(clamp(h.z / h.magnitude(), -1.0, 1.0));
    const n = Vector3D.zAxis.cross(h);
    let o = Math.acos(clamp(n.x / n.magnitude(), -1.0, 1.0));

    if (n.y < 0) {
      o = TAU - o;
    }
    let w = n.angle(eVec);

    if (eVec.z < 0) {
      w = TAU - w;
    }
    let v = eVec.angle(pos);

    if (pos.dot(vel) < 0) {
      v = TAU - v;
    }

    return new ClassicalElements({
      epoch: state.epoch,
      semimajorAxis: a,
      eccentricity: e,
      inclination: i,
      rightAscension: o,
      argPerigee: w,
      trueAnomaly: v,
      mu,
    });
  }

  /** Inclination _(°)_. */
  get inclinationDegrees(): number {
    return this.inclination * RAD2DEG;
  }

  /** Right-ascension of the ascending node _(°)_. */
  get rightAscensionDegrees(): number {
    return this.rightAscension * RAD2DEG;
  }

  /** Argument of perigee _(°)_. */
  get argPerigeeDegrees(): number {
    return this.argPerigee * RAD2DEG;
  }

  /** True anomaly _(°)_. */
  get trueAnomalyDegrees(): number {
    return this.trueAnomaly * RAD2DEG;
  }

  /** Apogee distance from central body _(km)_. */
  get apogee(): number {
    return this.semimajorAxis * (1.0 + this.eccentricity);
  }

  /** Perigee distance from central body _(km)_. */
  get perigee(): number {
    return this.semimajorAxis * (1.0 - this.eccentricity);
  }

  toString(): string {
    return [
      '[ClassicalElements]',
      `  Epoch: ${this.epoch}`,
      `  Semimajor Axis (a):       ${this.semimajorAxis.toFixed(4)} km`,
      `  Eccentricity (e):         ${this.eccentricity.toFixed(7)}`,
      `  Inclination (i):          ${this.inclinationDegrees.toFixed(4)}°`,
      `  Right Ascension (Ω):      ${this.rightAscensionDegrees.toFixed(4)}°`,
      `  Argument of Perigee (ω):  ${this.argPerigeeDegrees.toFixed(4)}°`,
      `  True Anomaly (ν):         ${this.trueAnomalyDegrees.toFixed(4)}°`,
    ].join('\n');
  }

  /** Compute the mean motion _(rad/s)_ of this orbit. */
  meanMotion(): number {
    return Math.sqrt(this.mu / (this.semimajorAxis * this.semimajorAxis * this.semimajorAxis));
  }

  /** Compute the period _(seconds)_ of this orbit. */
  period(): number {
    return TAU * Math.sqrt(this.semimajorAxis ** 3 / this.mu);
  }

  /** Compute the number of revolutions completed per day for this orbit. */
  revsPerDay(): number {
    return secondsPerDay / this.period();
  }

  // / Return the orbit regime for this orbit.
  getOrbitRegime(): OrbitRegime {
    const n = this.revsPerDay();
    const p = this.period() * sec2min;

    if (n >= 0.99 && n <= 1.01 && this.eccentricity < 0.01) {
      return OrbitRegime.GEO;
    }
    if (p >= 600 && p <= 800 && this.eccentricity <= 0.25) {
      return OrbitRegime.MEO;
    }
    if (n >= 11.25 && this.eccentricity <= 0.25) {
      return OrbitRegime.LEO;
    }
    if (this.eccentricity > 0.25) {
      return OrbitRegime.HEO;
    }

    return OrbitRegime.OTHER;
  }

  // Convert this to inertial position and velocity vectors.
  toPositionVelocity(): PositionVelocity {
    const rVec = new Vector3D(Math.cos(this.trueAnomaly), Math.sin(this.trueAnomaly), 0.0);
    const rPQW = rVec.scale(
      (this.semimajorAxis * (1.0 - this.eccentricity ** 2)) / (1.0 + this.eccentricity * Math.cos(this.trueAnomaly)),
    );
    const vVec = new Vector3D(-Math.sin(this.trueAnomaly), this.eccentricity + Math.cos(this.trueAnomaly), 0.0);
    const vPQW = vVec.scale(Math.sqrt(this.mu / (this.semimajorAxis * (1 - this.eccentricity ** 2))));
    const position = rPQW.rotZ(-this.argPerigee).rotX(-this.inclination).rotZ(-this.rightAscension);
    const velocity = vPQW.rotZ(-this.argPerigee).rotX(-this.inclination).rotZ(-this.rightAscension);

    return { position, velocity };
  }

  // Convert this to EquinoctialElements.
  toEquinoctialElements(): EquinoctialElements {
    const fr = Math.abs(this.inclination - Math.PI) < 1e-9 ? -1 : 1;
    const af = this.eccentricity * Math.cos(this.argPerigee + fr * this.rightAscension);
    const ag = this.eccentricity * Math.sin(this.argPerigee + fr * this.rightAscension);
    const l = this.argPerigee + fr * this.rightAscension + newtonNu(this.eccentricity, this.trueAnomaly).m;
    const n = this.meanMotion();
    const chi = Math.tan(0.5 * this.inclination) ** fr * Math.sin(this.rightAscension);
    const psi = Math.tan(0.5 * this.inclination) ** fr * Math.cos(this.rightAscension);

    return new EquinoctialElements(this.epoch, af, ag, l, n, chi, psi, { mu: this.mu, fr });
  }

  // / Return elements propagated to the provided [propEpoch].
  propagate(propEpoch: EpochUTC): ClassicalElements {
    const t = this.epoch;
    const n = this.meanMotion();
    const delta = propEpoch.difference(t);
    const cosV = Math.cos(this.trueAnomaly);
    let eaInit = Math.acos(clamp((this.eccentricity + cosV) / (1 + this.eccentricity * cosV), -1, 1));

    eaInit = matchHalfPlane(eaInit, this.trueAnomaly);
    let maInit = eaInit - this.eccentricity * Math.sin(eaInit);

    maInit = matchHalfPlane(maInit, eaInit);
    const maFinal = (maInit + n * delta) % TAU;
    let eaFinal = maFinal;

    for (let iter = 0; iter < 32; iter++) {
      const eaTemp = maFinal + this.eccentricity * Math.sin(eaFinal);

      if (Math.abs(eaTemp - eaFinal) < 1e-12) {
        break;
      }
      eaFinal = eaTemp;
    }
    const cosEaFinal = Math.cos(eaFinal);
    let vFinal = clamp(Math.acos((cosEaFinal - this.eccentricity) / (1 - this.eccentricity * cosEaFinal)), -1, 1);

    vFinal = matchHalfPlane(vFinal, eaFinal);

    return new ClassicalElements({
      epoch: propEpoch,
      semimajorAxis: this.semimajorAxis,
      eccentricity: this.eccentricity,
      inclination: this.inclination,
      rightAscension: this.rightAscension,
      argPerigee: this.argPerigee,
      trueAnomaly: vFinal,
      mu: this.mu,
    });
  }
}
