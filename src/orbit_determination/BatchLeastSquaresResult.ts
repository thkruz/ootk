import { J2000 } from '../coordinate/J2000';
import { StateCovariance } from './../covariance/StateCovariance';

// / Batch least squares orbit determination result.
export class BatchLeastSquaresResult {
  /**
   * Create a new [BatchLeastSquaresResult] object, containing the solved
   * [state], [covariance], and root-mean-squared error [rms].
   */
  constructor(public state: J2000, public covariance: StateCovariance, public rms: number) {
    // Nothing to do here.
  }
}
