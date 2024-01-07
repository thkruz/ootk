import { Vector } from 'ootk-core';

/**
 * Optimization cost function that takes in parameter array [xs] and returns
 * a score.
 */
export type CostFunction = (points: Float64Array) => number;

export class SimplexEntry {
  score: number;
  private _x: Vector;

  constructor(private _f: CostFunction, public points: Float64Array) {
    this._x = new Vector(points);
    this.score = this._f(points);
  }

  getPoints(): Float64Array {
    return this._x.toArray();
  }

  getScore(): number {
    return this.score;
  }

  modify(n: number, xa: SimplexEntry, xb: SimplexEntry): SimplexEntry {
    return new SimplexEntry(this._f, this._x.add(xa._x.subtract(xb._x).scale(n)).toArray());
  }

  distance(se: SimplexEntry): number {
    return this._x.distance(se._x);
  }
}
