import { factorial } from '../../utils/functions';
import { egm96 } from './egm96';

// / EGM-96 entry for l, m indexes and clm, slm values.
export type Egm96Entry = [number, number, number, number];

// / Container for EGM-96 data.
export class Egm96Data {
  private _coeffs: Egm96Entry[];

  // / Create a new [Egm96Data] object.
  constructor(coeffs: Egm96Entry[]) {
    this._coeffs = coeffs;
  }

  /**
   * Create a new [Egm96Data] container given a list of EGM-96
   * coefficient tuples [vals].
   */
  static fromVals(vals: Egm96Entry[]): Egm96Data {
    const output: Egm96Entry[] = [];

    for (const v of vals) {
      const [l, m, clm, slm] = v;
      const k = m === 0 ? 1 : 2;
      const a = factorial(l + m);
      const b = factorial(l - m) * (k * (2 * l + 1));
      const nFac = Math.sqrt(a / b);
      const normalizedClm = clm / nFac;
      const normalizedSlm = slm / nFac;

      output.push([l, m, normalizedClm, normalizedSlm]);
    }

    return new Egm96Data(output);
  }

  // / Return de-normalized EGM-96 coefficients for a given [l] and [m] index.
  getCoeffs(l: number, m: number): Egm96Entry {
    return this._coeffs[Egm96Data.index_(l, m)];
  }

  // / Return the EGM-96 index for a given [l] and [m] lookup.
  private static index_(l: number, m: number): number {
    return (((l - 2) * (l + 2) + l) >> 1) - 1 + m;
  }
}

// / De-normalized EGM-96 data container.
export const egm96Data = Egm96Data.fromVals(egm96);
