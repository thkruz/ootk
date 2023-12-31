import { EpochWindow } from '@src/time/EpochWindow';
import { EpochUTC } from '../time/EpochUTC';

// / Interpolator base class.
export abstract class Interpolator {
  // Return the start and end epoch covered by this interpolator.
  abstract window(): EpochWindow;

  /*
   * Return `true` if the provided [epoch] is within this interpolator's
   * cached value range.
   */
  inWindow(epoch: EpochUTC): boolean {
    const start = this.window().start;
    const stop = this.window().end;

    return start <= epoch && epoch <= stop;
  }

  /*
   * Calculate the start/stop epoch between this and another [Interpolator].
   *
   * Returns `null` if there is no overlap between interpolators.
   */
  overlap(interpolator: Interpolator): EpochWindow | null {
    const x1 = this.window().start;
    const x2 = this.window().end;
    const y1 = interpolator.window().start;
    const y2 = interpolator.window().end;

    if (x1 <= y2 && y1 <= x2) {
      const e1 = new EpochUTC(Math.max(x1.posix, y1.posix));
      const e2 = new EpochUTC(Math.min(x2.posix, y2.posix));

      return new EpochWindow(e1, e2);
    }

    return null;
  }
}
