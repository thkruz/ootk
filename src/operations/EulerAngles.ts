import { DEG2RAD, RAD2DEG } from '../utils/constants';
import { Matrix } from './Matrix';
import { Vector3D } from './Vector3D';

// / Class containing Euler angles.
export class EulerAngles {
  // / Roll component _(rad)_.
  roll: number;

  // / Pitch component _(rad)_.
  pitch: number;

  // / Yaw component _(rad)_.
  yaw: number;

  /**
   * Create a new [EulerAngles] object from [roll], [pitch], and [yaw]
   * angles _(rad)_.
   */
  constructor(roll: number, pitch: number, yaw: number) {
    this.roll = roll;
    this.pitch = pitch;
    this.yaw = yaw;
  }

  /**
   * Create a new [EulerAngles] object from [roll], [pitch], and [yaw]
   * angles _(deg)_.
   */
  static fromDegrees(rollDeg: number, pitchDeg: number, yawDeg: number): EulerAngles {
    const roll = rollDeg * DEG2RAD;
    const pitch = pitchDeg * DEG2RAD;
    const yaw = yawDeg * DEG2RAD;

    return new EulerAngles(roll, pitch, yaw);
  }

  /**
   * Create a new [EulerAngles] object from 3-2-1 ordered direction cosine
   * matrix [c].
   */
  static fromDcm321(c: Matrix): EulerAngles {
    const roll = Math.atan(c[1][2] / c[2][2]);
    const pitch = -Math.asin(c[0][2]);
    const yaw = Math.atan(c[0][1] / c[0][0]);

    return new EulerAngles(roll, pitch, yaw);
  }

  // / Roll component _(deg)_.
  get rollDegrees(): number {
    return this.roll * RAD2DEG;
  }

  // / Pitch component _(deg)_.
  get pitchDegrees(): number {
    return this.pitch * RAD2DEG;
  }

  // / Yaw component _(deg)_.
  get yawDegrees(): number {
    return this.yaw * RAD2DEG;
  }

  // / Roll component alias _(rad)_.
  get phi(): number {
    return this.roll;
  }

  // / Pitch component alias _(rad)_.
  get theta(): number {
    return this.pitch;
  }

  // / Yaw component alias _(rad)_.
  get psi(): number {
    return this.yaw;
  }

  // / Roll component alias _(deg)_.
  get phiDegrees(): number {
    return this.phi * RAD2DEG;
  }

  // / Pitch component alias _(deg)_.
  get thetaDegrees(): number {
    return this.theta * RAD2DEG;
  }

  // / Yaw component alias _(deg)_.
  get psiDegrees(): number {
    return this.psi * RAD2DEG;
  }

  toString(precision = 6): string {
    const rollStr = this.rollDegrees.toFixed(precision);
    const pitchStr = this.pitchDegrees.toFixed(precision);
    const yawStr = this.yawDegrees.toFixed(precision);

    return `Euler(roll: ${rollStr}°, pitch: ${pitchStr}°, yaw: ${yawStr}°)`;
  }

  // / Convert this to a 3-2-1 ordered direction cosine [Matrix].
  dcm321(): Matrix {
    const sPhi = Math.sin(this.phi);
    const cPhi = Math.cos(this.phi);
    const sTheta = Math.sin(this.theta);
    const cTheta = Math.cos(this.theta);
    const sPsi = Math.sin(this.psi);
    const cPsi = Math.cos(this.psi);

    return new Matrix([
      [cTheta * cPsi, cTheta * sPsi, -sTheta],
      [sPhi * sTheta * cPsi - cPhi * sPsi, sPhi * sTheta * sPsi + cPhi * cPsi, sPhi * cTheta],
      [cPhi * sTheta * cPsi + sPhi * sPsi, cPhi * sTheta * sPsi - sPhi * cPsi, cPhi * cTheta],
    ]);
  }

  // / Perform a 3-2-1 ordered rotation on provided vector [v].
  rotateVector321(v: Vector3D): Vector3D {
    return this.dcm321().multiplyVector3D(v);
  }
}
