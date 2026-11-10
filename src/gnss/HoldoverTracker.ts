/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
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

import { ValidationError } from '../errors';
import type { GnssStepResult } from './GnssReceiver';
import type { ClockModel } from './Holdover';

/** Holdover state derived from one receiver step. */
export interface HoldoverStatus {
  /** True while the receiver has no fix but has had one before. */
  inHoldover: boolean;
  /** Seconds since the last fix, or null if the receiver has never had a fix. */
  secondsInHoldover: number | null;
  /** Clock time-error bound in seconds: 0 with a fix, null if there was never a fix. */
  timeErrorSec: number | null;
  /** True when the error bound has reached the tracker's threshold. */
  thresholdExceeded: boolean;
  /** Seconds of holdover remaining before the threshold is reached (0 if exceeded, null if there was never a fix). */
  secondsUntilThreshold: number | null;
}

/**
 * Turns {@link GnssStepResult} output into holdover time-error status for a {@link ClockModel}.
 * The model is applied from the moment the fix is lost (`timeSinceLastFixSec` from the receiver).
 */
export class HoldoverTracker {
  readonly clock: ClockModel;
  readonly thresholdSec: number;

  /**
   * @param clock - Clock model applied from loss of fix.
   * @param thresholdSec - Maximum tolerated time error, s (> 0).
   * @throws ValidationError if the threshold is not positive.
   */
  constructor(clock: ClockModel, thresholdSec: number) {
    if (!(thresholdSec > 0)) {
      throw new ValidationError('thresholdSec must be > 0', 'thresholdSec', thresholdSec);
    }
    this.clock = clock;
    this.thresholdSec = thresholdSec;
  }

  /**
   * Holdover status for a receiver step.
   * @param step - Result of `GnssReceiver.step` (only `hasFix` and `timeSinceLastFixSec` are read).
   */
  evaluate(step: Pick<GnssStepResult, 'hasFix' | 'timeSinceLastFixSec'>): HoldoverStatus {
    const t = step.timeSinceLastFixSec;
    const exceedAt = this.clock.timeToExceed(this.thresholdSec);

    if (t === null) {
      return { inHoldover: false, secondsInHoldover: null, timeErrorSec: null, thresholdExceeded: false, secondsUntilThreshold: null };
    }
    if (step.hasFix) {
      return { inHoldover: false, secondsInHoldover: 0, timeErrorSec: 0, thresholdExceeded: false, secondsUntilThreshold: exceedAt };
    }
    const err = this.clock.timeErrorAt(t);
    // Next crossing at or after now: the bound can dip back under the threshold (signed offset
    // with opposing drift), so the first-ever crossing would say 0 s remain while not exceeded.
    const nextExceedAt = this.clock.timeToExceed(this.thresholdSec, t);

    return {
      inHoldover: true,
      secondsInHoldover: t,
      timeErrorSec: err,
      thresholdExceeded: err >= this.thresholdSec,
      secondsUntilThreshold: nextExceedAt - t,
    };
  }
}
