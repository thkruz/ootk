/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */

import { Interpolator } from './Interpolator';

// / Base class for arbitrary field interpolators.
export abstract class FieldInterpolator extends Interpolator {
  Float64List?;

  /**
   * Interpolate field values at the provided [epoch].
   * @returns Returns `null` if the epoch is outside the cached field range.
   */
  interpolate(final, EpochUTC, epoch) {
    throw new Error('Method not implemented.');
  }
}
