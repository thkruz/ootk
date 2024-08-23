/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

import { Waypoint } from 'src/maneuver/Waypoint.js';
import { Earth, EpochUTC, J2000, Kilometers, KilometersPerSecond, Matrix, MetersPerSecond, RadiansPerSecond, RelativeState, Seconds, Thrust, Vector3D } from '../main.js';

// / Hill Modified Equidistant Cyllindrical _(EQCM)_ coordinates.
export class Hill {
  private semimajorAxis_: Kilometers;
  private meanMotion_: RadiansPerSecond;

  constructor(
    public epoch: EpochUTC,
    public position: Vector3D<Kilometers>,
    public velocity: Vector3D<KilometersPerSecond>,
    semimajorAxis: Kilometers,
  ) {
    this.semimajorAxis_ = semimajorAxis;
    this.meanMotion_ = Earth.smaToMeanMotion(this.semimajorAxis_);
  }

  static fromState(
    origin: J2000,
    radialPosition: Kilometers,
    intrackPosition: Kilometers,
    nodeVelocity: KilometersPerSecond,
    nodeOffsetTime: Seconds,
  ): Hill {
    const a = origin.semimajorAxis;
    const n = Earth.smaToMeanMotion(a);
    const yDot = -3.0 * radialPosition * n * 0.5 as KilometersPerSecond;
    const z = (nodeVelocity / n) * Math.sin(n * -nodeOffsetTime) as Kilometers;
    const zDot = nodeVelocity * Math.cos(n * -nodeOffsetTime) as KilometersPerSecond;
    const r = new Vector3D(radialPosition, intrackPosition, z);
    const v = new Vector3D(0.0 as KilometersPerSecond, yDot, zDot);

    return new Hill(origin.epoch, r, v, a);
  }

  static fromNmc(
    origin: J2000,
    majorAxisRange: Kilometers,
    nodeVelocity: KilometersPerSecond,
    nodeOffsetTime: Seconds,
    translation = 0.0,
  ): Hill {
    const a = origin.semimajorAxis;
    const n = Earth.smaToMeanMotion(a);
    const xDot = majorAxisRange * n * 0.5 as KilometersPerSecond;
    const z = (nodeVelocity / n) * Math.sin(n * -nodeOffsetTime) as Kilometers;
    const zDot = nodeVelocity * Math.cos(n * -nodeOffsetTime) as KilometersPerSecond;
    const r = new Vector3D(0.0 as Kilometers, majorAxisRange + translation as Kilometers, z);
    const v = new Vector3D(xDot, 0.0 as KilometersPerSecond, zDot);

    return new Hill(origin.epoch, r, v, a);
  }

  static fromPerch(
    origin: J2000,
    perchRange: Kilometers,
    nodeVelocity: KilometersPerSecond,
    nodeOffsetTime: Seconds,
  ): Hill {
    const a = origin.semimajorAxis;
    const n = Earth.smaToMeanMotion(a);
    const z = (nodeVelocity / n) * Math.sin(n * -nodeOffsetTime) as Kilometers;
    const zDot = nodeVelocity * Math.cos(n * -nodeOffsetTime) as KilometersPerSecond;
    const r = new Vector3D(0.0 as Kilometers, perchRange, z);
    const v = new Vector3D(0.0 as KilometersPerSecond, 0.0 as KilometersPerSecond, zDot);

    return new Hill(origin.epoch, r, v, a);
  }

  get semimajorAxis(): Kilometers {
    return this.semimajorAxis_;
  }

  set semimajorAxis(sma: Kilometers) {
    this.semimajorAxis_ = sma;
    this.meanMotion_ = Earth.smaToMeanMotion(this.semimajorAxis_);
  }

  get meanMotion(): RadiansPerSecond {
    return this.meanMotion_;
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
    const vinteci = transform.transpose().multiplyVector3D(vintrsw) as Vector3D<KilometersPerSecond>;

    const rintrsw = new Vector3D(
      cosphiint * magrint * coslambdaint,
      cosphiint * magrint * sinlambdaint,
      sinphiint * magrint,
    );

    const rinteci = transform.transpose().multiplyVector3D(rintrsw) as Vector3D<Kilometers>;

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

  transition(t: Seconds): Hill {
    const sysMat = Hill.transitionMatrix(t, this.meanMotion_);
    const res = sysMat.multiplyVector(this.position.join(this.velocity)).elements;

    return new Hill(
      this.epoch.roll(t),
      new Vector3D(res[0] as Kilometers, res[1] as Kilometers, res[2] as Kilometers),
      new Vector3D(res[3] as KilometersPerSecond, res[4] as KilometersPerSecond, res[5] as KilometersPerSecond),
      this.semimajorAxis_,
    );
  }

  transitionWithMatrix(stm: Matrix, t: Seconds): Hill {
    const res = stm.multiplyVector(this.position.join(this.velocity)).elements;

    return new Hill(
      this.epoch.roll(t),
      new Vector3D(res[0] as Kilometers, res[1] as Kilometers, res[2] as Kilometers),
      new Vector3D(res[3] as KilometersPerSecond, res[4] as KilometersPerSecond, res[5] as KilometersPerSecond),
      this.semimajorAxis_,
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

    return new Hill(state.epoch, state.position, state.velocity.add(maneuver.deltaV), state.semimajorAxis_);
  }

  ephemeris(start: EpochUTC, stop: EpochUTC, step = 60.0 as Seconds): Hill[] {
    const output: Hill[] = [];
    let current = start;

    while (stop >= current) {
      output.push(this.propagate(current));
      current = current.roll(step);
    }

    return output;
  }

  get period(): Seconds {
    return (2 * Math.PI) / this.meanMotion_ as Seconds;
  }

  nextRadialTangent(): Hill {
    const x = this.position.x;
    const xDot = this.velocity.x;
    const yDot = this.velocity.y;
    let t = Math.atan(-xDot / (3.0 * this.meanMotion_ * x + 2.0 * yDot)) / this.meanMotion_ as Seconds;

    if (t <= 0) {
      t = t + 0.5 * this.period as Seconds;
    } else if (isNaN(t)) {
      t = 0.5 * this.period as Seconds;
    }

    return this.propagate(this.epoch.roll(t));
  }

  solveManeuver(waypoint: Waypoint, ignoreCrosstrack = false): Thrust {
    const t = waypoint.epoch.difference(this.epoch);
    const w = waypoint.relativePosition;
    const sysMat = Hill.transitionMatrix(t, this.meanMotion_);
    const posEquationMat = new Matrix([
      [sysMat.elements[0][0], sysMat.elements[0][1], sysMat.elements[0][2]],
      [sysMat.elements[1][0], sysMat.elements[1][1], sysMat.elements[1][2]],
      [sysMat.elements[2][0], sysMat.elements[2][1], sysMat.elements[2][2]],
    ]);
    const solnVector = w
      .subtract(posEquationMat.multiplyVector3D(this.position)) as unknown as Vector3D<KilometersPerSecond>;
    const velEquationMat = new Matrix([
      [sysMat.elements[0][3], sysMat.elements[0][4], sysMat.elements[0][5]],
      [sysMat.elements[1][3], sysMat.elements[1][4], sysMat.elements[1][5]],
      [sysMat.elements[2][3], sysMat.elements[2][4], sysMat.elements[2][5]],
    ]);
    let result = velEquationMat
      .inverse()
      .multiplyVector3D(solnVector)
      .subtract(this.velocity);

    if (ignoreCrosstrack) {
      result = new Vector3D(
        result.x,
        result.y,
        0 as KilometersPerSecond,
      );
    }

    return new Thrust(
      this.epoch,
      result.x * 1000 as MetersPerSecond,
      result.y * 1000 as MetersPerSecond,
      result.z * 1000 as MetersPerSecond,
    );
  }

  maneuverSequence(
    pivot: EpochUTC,
    waypoints: Waypoint[],
    preManeuvers: Thrust[] = [],
    postManeuvers: Thrust[] = [],
  ): Thrust[] {
    let state = new Hill(this.epoch, this.position, this.velocity, this.semimajorAxis_);

    preManeuvers = preManeuvers.slice();
    postManeuvers = postManeuvers.slice();
    let output = preManeuvers;

    // Note difference was once compareTo
    output.sort((a, b) => a.center.difference(b.center));
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
    const vInit = Math.sqrt(Earth.mu / this.semimajorAxis_);
    const vFinal = vInit - maneuver.intrack * 1e-3;
    const aFinal = Earth.mu / (vFinal * vFinal) as Kilometers;

    return new Hill(state.epoch, state.position, state.velocity.subtract(maneuver.deltaV), aFinal);
  }

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
