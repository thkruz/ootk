/**
 * @author Theodore Kruczek.
 * @license MIT
 * @copyright (c) 2022-2024 Theodore Kruczek Permission is
 * hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { ClassicalElements, TAU, Earth, Kilometers, KilometersPerSecond, Minutes, EpochUTC, Vector3D }
  from '../main.js';

/**
 * A state vector is a set of coordinates used to specify the position and
 * velocity of an object in a particular reference frame.
 */
export abstract class StateVector {
  epoch: EpochUTC;
  position: Vector3D<Kilometers>;
  velocity: Vector3D<KilometersPerSecond>;
  constructor(epoch: EpochUTC, position: Vector3D<Kilometers>, velocity: Vector3D<KilometersPerSecond>) {
    this.epoch = epoch;
    this.position = position;
    this.velocity = velocity;
  }

  /**
   * The name of the reference frame in which the state vector is defined.
   * @returns The name of the reference frame.
   */
  abstract get name(): string;

  /**
   * Whether the state vector is defined in an inertial reference frame.
   * @returns True if the state vector is defined in an inertial reference
   */
  abstract get inertial(): boolean;

  /**
   * Returns a string representation of the StateVector object. The string includes the name, epoch, position, and
   * velocity.
   * @returns A string representation of the StateVector object.
   */
  toString(): string {
    return [
      `[${this.name}]`,
      `  Epoch: ${this.epoch}`,
      `  Position: ${this.position.toString(6)} km`,
      `  Velocity: ${this.velocity.toString(9)} km/s`,
    ].join('\n');
  }

  /**
   * Calculates the mechanical energy of the state vector.
   * @returns The mechanical energy value.
   */
  get mechanicalEnergy(): number {
    const r = this.position.magnitude();
    const v = this.velocity.magnitude();

    return v * v * 0.5 - Earth.mu / r;
  }

  /**
   * Calculates the semimajor axis of the state vector.
   * @returns The semimajor axis in kilometers.
   */
  get semimajorAxis(): Kilometers {
    const energy = this.mechanicalEnergy;

    return (-Earth.mu / (2.0 * energy)) as Kilometers;
  }

  /**
   * Gets the period of the state vector in minutes.
   * @returns The period in minutes.
   */
  get period(): Minutes {
    const a = this.semimajorAxis;
    const periodSeconds = TAU * Math.sqrt((a * a * a) / Earth.mu);

    return (periodSeconds / 60.0) as Minutes;
  }

  /**
   * Gets the angular rate of the state vector.
   * @returns The angular rate.
   */
  get angularRate(): number {
    const a = this.semimajorAxis;

    return Math.sqrt(Earth.mu / (a * a * a));
  }

  /**
   * Converts the state vector to classical elements.
   * @param mu The gravitational parameter of the celestial body. Defaults to Earth's gravitational parameter.
   * @returns The classical elements corresponding to the state vector.
   * @throws Error if classical elements are undefined for fixed frames.
   */
  toClassicalElements(mu = Earth.mu): ClassicalElements {
    if (!this.inertial) {
      throw new Error('Classical elements are undefined for fixed frames.');
    }

    return ClassicalElements.fromStateVector(this, mu);
  }
}
