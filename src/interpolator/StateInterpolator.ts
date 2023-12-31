/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */

import { EpochUTC } from '@src/time/EpochUTC';
import { J2000 } from '../coordinate/J2000';
import { Interpolator } from './Interpolator';

// / Base class for state vector interpolators.
export abstract class StateInterpolator extends Interpolator {
  /**
   * Interpolates the state at the given epoch.
   *
   * @param epoch The epoch in UTC format.
   * @returns The interpolated state at the given epoch, or null if interpolation is not possible.
   */
  interpolate(epoch: EpochUTC): J2000 | null {
    throw new Error('Not implemented.');
  }

  // / Return the size _(bytes)_ of this interpolator's cached data.
  get sizeBytes(): number {
    throw new Error('Not implemented.');
  }
}
