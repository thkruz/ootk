import { Propagator } from '../propagator/Propagator';

export class PropagatorPairs {
  constructor(private _posStep: number, private _velStep: number) {
    // Do nothing.
  }

  private _high: (Propagator | null)[] = Array(6).fill(null);
  private _low: (Propagator | null)[] = Array(6).fill(null);

  set(index: number, high: Propagator, low: Propagator): void {
    this._high[index] = high;
    this._low[index] = low;
  }

  get(index: number): [Propagator, Propagator] {
    return [this._high[index]!, this._low[index]!];
  }

  /**
   * Get the step size at the provided index.
   */
  step(index: number): number {
    return index < 3 ? this._posStep : this._velStep;
  }
}
