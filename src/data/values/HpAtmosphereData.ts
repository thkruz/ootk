import { hpAtmosphere } from './hpAtmosphere';
import { HpAtmosphereResult } from './HpAtmosphereResult';

// / Harris-Priester atmosphere entry for height, min, and max density values.
export type HpAtmosphereEntry = [number, number, number];

// / Container for Harris-Priester atmosphere data.
export class HpAtmosphereData {
  private _table: HpAtmosphereEntry[];
  private _hMin: number;
  private _hMax: number;

  constructor(table: HpAtmosphereEntry[]) {
    this._table = table;
    this._hMin = table[0][0];
    this._hMax = table[table.length - 1][0];
  }

  static fromVals(vals: [number, number, number][]): HpAtmosphereData {
    const output: HpAtmosphereEntry[] = [];

    for (const v of vals) {
      const [h, minD, maxD] = v;

      output.push([h, minD, maxD]);
    }

    return new HpAtmosphereData(output);
  }

  getAtmosphere(height: number): HpAtmosphereResult | null {
    if (height < this._hMin || height > this._hMax) {
      return null;
    }
    let index = 0;

    while (index < this._table.length - 2 && height > this._table[index + 1][0]) {
      index++;
    }

    return new HpAtmosphereResult(height, this._table[index], this._table[index + 1]);
  }
}

export const hpAtmosphereData = HpAtmosphereData.fromVals(hpAtmosphere);
