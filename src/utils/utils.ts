import * as Types from '../types/types';
import { EciVec3, Kilometers } from '../types/types';
import { MILLISECONDS_TO_DAYS } from './constants';
import { sign } from './functions';
import { MoonMath } from './moon-math';

class Utils {
  static MoonMath = MoonMath;
  static Types = Types;

  // eslint-disable-next-line max-params
  static jday = (year?: number, mon?: number, day?: number, hr?: number, minute?: number, sec?: number) => {
    if (!year) {
      const now = new Date();
      const jDayStart = new Date(now.getUTCFullYear(), 0, 0);
      const jDayDiff = now.getDate() - jDayStart.getDate();

      return Math.floor(jDayDiff / MILLISECONDS_TO_DAYS);
    }

    return (
      367.0 * year -
      Math.floor(7 * (year + Math.floor((mon + 9) / 12.0)) * 0.25) +
      Math.floor((275 * mon) / 9.0) +
      day +
      1721013.5 +
      ((sec / 60.0 + minute) / 60.0 + hr) / 24.0
    );
  };

  static createVec(start: number, stop: number, step: number): number[] {
    const array = [];

    for (let i = start; i <= stop; i += step) {
      array.push(i);
    }

    return array;
  }

  static distance(pos1: EciVec3, pos2: EciVec3): Kilometers {
    return <Kilometers>Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2 + (pos1.z - pos2.z) ** 2);
  }

  static dopplerFactor(location: EciVec3, position: EciVec3, velocity: EciVec3): Kilometers {
    const mfactor = 7.292115e-5;
    const c = 299792.458; // Speed of light in km/s

    const range = <EciVec3>{
      x: position.x - location.x,
      y: position.y - location.y,
      z: position.z - location.z,
    };
    const distance = Math.sqrt(range.x ** 2 + range.y ** 2 + range.z ** 2);

    const rangeVel = <EciVec3>{
      x: velocity.x + mfactor * location.y,
      y: velocity.y - mfactor * location.x,
      z: velocity.z,
    };

    const rangeRate = (range.x * rangeVel.x + range.y * rangeVel.y + range.z * rangeVel.z) / distance;

    return <Kilometers>(1 + (rangeRate / c) * sign(rangeRate));
  }
}

export { Utils };
