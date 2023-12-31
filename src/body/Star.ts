import { AzEl, Degrees, RaDec, Radians } from '@src/ootk';
import { Sun } from './Sun';

export class Star {
  private constructor() {
    // disable constructor
  }

  static getStarAzEl(date: Date, lat: Degrees, lon: Degrees, ra: Radians, dec: Radians): AzEl<Radians> {
    const c: RaDec = {
      ra,
      dec,
    };
    const azEl = Sun.azEl(date, lat, lon, c);

    const el = <Radians>(azEl.el + Star.astroRefraction(azEl.el)); // elevation correction for refraction

    return {
      az: azEl.az,
      el,
    };
  }

  /**
   * get astro refraction
   * @param {Radians} h - elevation
   * @returns {number} refraction
   */
  static astroRefraction(h: Radians): Radians {
    if (h < 0) {
      h = <Radians>0;
    }

    return <Radians>(0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)));
  }
}
