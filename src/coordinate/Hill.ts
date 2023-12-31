import { EpochUTC } from '@src/time/EpochUTC';
import { Earth } from '../body/Earth';
import { Thrust } from './../force/Thrust';
import { Waypoint } from './../maneuver/Waypoint';
import { Matrix } from './../operations/Matrix';
import { Vector3D } from './../operations/Vector3D';
import { J2000 } from './J2000';
import { RelativeState } from './RelativeState';
// / Hill Modified Equidistant Cyllindrical _(EQCM)_ coordinates.
export class Hill {
  private _semimajorAxis: number;
  private _meanMotion: number;

  constructor(public epoch: EpochUTC, public position: Vector3D, public velocity: Vector3D, semimajorAxis: number) {
    this._semimajorAxis = semimajorAxis;
    this._meanMotion = Earth.smaToMeanMotion(this._semimajorAxis);
  }

  static fromState(
    origin: J2000,
    radialPosition: number,
    intrackPosition: number,
    nodeVelocity: number,
    nodeOffsetTime: number,
  ): Hill {
    const a = origin.semimajorAxis();
    const n = Earth.smaToMeanMotion(a);
    const yDot = -3.0 * radialPosition * n * 0.5;
    const z = (nodeVelocity / n) * Math.sin(n * -nodeOffsetTime);
    const zDot = nodeVelocity * Math.cos(n * -nodeOffsetTime);
    const r = new Vector3D(radialPosition, intrackPosition, z);
    const v = new Vector3D(0.0, yDot, zDot);

    return new Hill(origin.epoch, r, v, a);
  }

  static fromNmc(
    origin: J2000,
    majorAxisRange: number,
    nodeVelocity: number,
    nodeOffsetTime: number,
    translation = 0.0,
  ): Hill {
    const a = origin.semimajorAxis();
    const n = Earth.smaToMeanMotion(a);
    const xDot = majorAxisRange * n * 0.5;
    const z = (nodeVelocity / n) * Math.sin(n * -nodeOffsetTime);
    const zDot = nodeVelocity * Math.cos(n * -nodeOffsetTime);
    const r = new Vector3D(0.0, majorAxisRange + translation, z);
    const v = new Vector3D(xDot, 0.0, zDot);

    return new Hill(origin.epoch, r, v, a);
  }

  static fromPerch(origin: J2000, perchRange: number, nodeVelocity: number, nodeOffsetTime: number): Hill {
    const a = origin.semimajorAxis();
    const n = Earth.smaToMeanMotion(a);
    const z = (nodeVelocity / n) * Math.sin(n * -nodeOffsetTime);
    const zDot = nodeVelocity * Math.cos(n * -nodeOffsetTime);
    const r = new Vector3D(0.0, perchRange, z);
    const v = new Vector3D(0.0, 0.0, zDot);

    return new Hill(origin.epoch, r, v, a);
  }

  get semimajorAxis(): number {
    return this._semimajorAxis;
  }

  set semimajorAxis(sma: number) {
    this._semimajorAxis = sma;
    this._meanMotion = Earth.smaToMeanMotion(this._semimajorAxis);
  }

  get meanMotion(): number {
    return this._meanMotion;
  }

  toJ2000Matrix(origin: J2000, transform: Matrix): J2000 {
    const magrtgt = origin.position.magnitude();
    const magrint = magrtgt + this.position.x;
    const vtgtrsw = transform.multiplyVector3D(origin.velocity);

    const lambdadottgt = vtgtrsw.y / magrtgt;
    const lambdaint = this.position.y / magrtgt;
    const phiint = this.position.z / magrtgt;
    const sinphiint = Math.sin(phiint);
    const cosphiint = Math.cos(phiint);
    const sinlambdaint = Math.sin(lambdaint);
    const coslambdaint = Math.cos(lambdaint);

    const rotRswSez = new Matrix([
      [sinphiint * coslambdaint, sinphiint * sinlambdaint, -cosphiint],
      [-sinlambdaint, coslambdaint, 0],
      [cosphiint * coslambdaint, cosphiint * sinlambdaint, sinphiint],
    ]);

    const rdotint = this.velocity.x + vtgtrsw.x;
    const lambdadotint = this.velocity.y / magrtgt + lambdadottgt;
    const phidotint = this.velocity.z / magrtgt;
    const vintsez = new Vector3D(-magrint * phidotint, magrint * lambdadotint * cosphiint, rdotint);
    const vintrsw = rotRswSez.transpose().multiplyVector3D(vintsez);
    const vinteci = transform.transpose().multiplyVector3D(vintrsw);

    const rintrsw = new Vector3D(
      cosphiint * magrint * coslambdaint,
      cosphiint * magrint * sinlambdaint,
      sinphiint * magrint,
    );

    const rinteci = transform.transpose().multiplyVector3D(rintrsw);

    return new J2000(origin.epoch, rinteci, vinteci);
  }

  toJ2000(origin: J2000): J2000 {
    return this.toJ2000Matrix(origin, RelativeState.createMatrix(origin.position, origin.velocity));
  }

  static transitionMatrix(t: number, meanMotion: number): Matrix {
    const n = meanMotion;
    const sn = Math.sin(n * t);
    const cs = Math.cos(n * t);

    return new Matrix([
      [4.0 - 3.0 * cs, 0.0, 0.0, sn / n, (2.0 * (1.0 - cs)) / n, 0.0],
      [6.0 * (sn - n * t), 1.0, 0.0, (-2.0 * (1.0 - cs)) / n, (4.0 * sn - 3.0 * n * t) / n, 0.0],
      [0.0, 0.0, cs, 0.0, 0.0, sn / n],
      [3.0 * n * sn, 0.0, 0.0, cs, 2.0 * sn, 0.0],
      [-6.0 * n * (1.0 - cs), 0.0, 0.0, -2.0 * sn, 4.0 * cs - 3.0, 0.0],
      [0.0, 0.0, -n * sn, 0.0, 0.0, cs],
    ]);
  }

  transition(t: number): Hill {
    const sysMat = Hill.transitionMatrix(t, this._meanMotion);
    const output = sysMat.multiplyVector(this.position.join(this.velocity));

    return new Hill(
      this.epoch.roll(t),
      new Vector3D(output[0], output[1], output[2]),
      new Vector3D(output[3], output[4], output[5]),
      this._semimajorAxis,
    );
  }

  transitionWithMatrix(stm: Matrix, t: number): Hill {
    const output = stm.multiplyVector(this.position.join(this.velocity));

    return new Hill(
      this.epoch.roll(t),
      new Vector3D(output[0], output[1], output[2]),
      new Vector3D(output[3], output[4], output[5]),
      this._semimajorAxis,
    );
  }

  propagate(newEpoch: EpochUTC): Hill {
    return this.transition(newEpoch.difference(this.epoch));
  }

  propagateWithMatrix(stm: Matrix, newEpoch: EpochUTC): Hill {
    return this.transitionWithMatrix(stm, newEpoch.difference(this.epoch));
  }

  maneuver(maneuver: Thrust): Hill {
    const state = this.propagate(maneuver.center);

    return new Hill(state.epoch, state.position, state.velocity.add(maneuver.deltaV), state._semimajorAxis);
  }

  ephemeris(start: EpochUTC, stop: EpochUTC, step = 60.0): Hill[] {
    const output: Hill[] = [];
    let current = start;

    while (stop >= current) {
      output.push(this.propagate(current));
      current = current.roll(step);
    }

    return output;
  }

  get period(): number {
    return (2 * Math.PI) / this._meanMotion;
  }

  nextRadialTangent(): Hill {
    const x = this.position.x;
    const xDot = this.velocity.x;
    const yDot = this.velocity.y;
    let t = Math.atan(-xDot / (3.0 * this._meanMotion * x + 2.0 * yDot)) / this._meanMotion;

    if (t <= 0) {
      t += 0.5 * this.period;
    } else if (isNaN(t)) {
      t = 0.5 * this.period;
    }

    return this.propagate(this.epoch.roll(t));
  }

  solveManeuver(waypoint: Waypoint, ignoreCrosstrack = false): Thrust {
    const t = waypoint.epoch.difference(this.epoch);
    const w = waypoint.relativePosition;
    const sysMat = Hill.transitionMatrix(t, this._meanMotion);
    const posEquationMat = new Matrix([
      [sysMat[0][0], sysMat[0][1], sysMat[0][2]],
      [sysMat[1][0], sysMat[1][1], sysMat[1][2]],
      [sysMat[2][0], sysMat[2][1], sysMat[2][2]],
    ]);
    const solnVector = w.subtract(posEquationMat.multiplyVector3D(this.position));
    const velEquationMat = new Matrix([
      [sysMat[0][3], sysMat[0][4], sysMat[0][5]],
      [sysMat[1][3], sysMat[1][4], sysMat[1][5]],
      [sysMat[2][3], sysMat[2][4], sysMat[2][5]],
    ]);
    let result = velEquationMat.inverse().multiplyVector3D(solnVector).subtract(this.velocity);

    if (ignoreCrosstrack) {
      result = new Vector3D(result.x * 1000, result.y * 1000, 0);
    }

    return new Thrust(this.epoch, result[0] * 1000, result[1] * 1000, result[2] * 1000);
  }

  maneuverSequence(
    pivot: EpochUTC,
    waypoints: Waypoint[],
    preManeuvers: Thrust[] = [],
    postManeuvers: Thrust[] = [],
  ): Thrust[] {
    let state = new Hill(this.epoch, this.position, this.velocity, this._semimajorAxis);

    preManeuvers = preManeuvers.slice();
    postManeuvers = postManeuvers.slice();
    let output = preManeuvers;

    output.sort((a, b) => a.center.compareTo(b.center));
    output = output.filter((mvr) => mvr.center >= this.epoch && mvr.center >= pivot);
    for (const mvr of output) {
      state = state.maneuver(mvr);
    }
    state = state.propagate(pivot);
    for (const wpt of waypoints) {
      const mvr = state.solveManeuver(wpt);

      state = state.maneuver(mvr);
      output.push(mvr);
    }
    output.push(...postManeuvers);

    return output;
  }

  maneuverOrigin(maneuver: Thrust): Hill {
    const state = this.propagate(maneuver.center);
    const vInit = Math.sqrt(Earth.mu / this._semimajorAxis);
    const vFinal = vInit - maneuver.intrack * 1e-3;
    const aFinal = Earth.mu / (vFinal * vFinal);

    return new Hill(state.epoch, state.position, state.velocity.subtract(maneuver.deltaV), aFinal);
  }

  // eslint-disable-next-line class-methods-use-this
  get name(): string {
    return 'Hill';
  }

  toString(): string {
    return [
      `[${this.name}]`,
      `  Epoch: ${this.epoch}`,
      `  Position: ${this.position.toString(6)} km`,
      `  Velocity: ${this.velocity.toString(9)} km/s`,
    ].join('\n');
  }
}
