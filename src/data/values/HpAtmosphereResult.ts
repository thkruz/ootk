import { HpAtmosphereEntry } from './HpAtmosphereData';

// / Harris-Priester atmospheric density bracket.
export class HpAtmosphereResult {
  // / Height above Earth's surface _(km)_.
  height: number;
  // / Lower bound for atmospheric parameters.
  hp0: HpAtmosphereEntry;
  // / Upper bound for atmospheric parameters.
  hp1: HpAtmosphereEntry;

  // / Create a new [HpAtmosphereResult] object.
  constructor(height: number, hp0: HpAtmosphereEntry, hp1: HpAtmosphereEntry) {
    this.height = height;
    this.hp0 = hp0;
    this.hp1 = hp1;
  }
}
