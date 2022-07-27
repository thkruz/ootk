import { DAY_TO_MS, DEG2RAD } from '../utils/constants';
import { EciVec3, GreenwichMeanSiderealTime, LlaVec3, RaeVec3, SpaceObjectType } from '../types/types';

import { Sgp4 } from '../sgp4/sgp4';
import { SpaceObject } from './space-object';
import { Transforms } from '../transforms/transforms';
import { Utils } from '../utils/utils';

interface ObjectInfo {
  name?: string;
  type?: SpaceObjectType;
  vmag?: number;
  ra: number;
  dec: number;
  pname?: string;
  bf?: string;
  h?: string;
}

export class Star extends SpaceObject {
  public pname: string;
  public bf: string;
  public h: string;

  public dec: number;
  public ra: number;

  constructor(info: ObjectInfo) {
    if (info.type && info.type !== SpaceObjectType.STAR) {
      throw new Error('Invalid object type');
    } else {
      info.type = SpaceObjectType.STAR;
    }

    super(info);

    this.ra = info.ra;
    this.dec = info.dec;

    if (info.pname) {
      this.pname = info.pname;
    }

    if (info.bf) {
      this.bf = info.bf;
    }

    if (info.h) {
      this.h = info.h;
    }
  }

  getEci(lla: LlaVec3 = { lat: 180, lon: 0, alt: 0 }, date: Date = this.time): EciVec3 {
    const rae = this.getRae(lla, date);
    const { gmst } = Star.calculateTimeVariables(date);

    // Arbitrary distance to enable using ECI coordinates
    return Transforms.ecf2eci(Transforms.rae2ecf(rae, { lat: 0, lon: 0, alt: 0 }), gmst);
  }

  getRae(lla: LlaVec3 = { lat: 180, lon: 0, alt: 0 }, date: Date = this.time): RaeVec3 {
    const starPos = Utils.SunMath.getStarAzEl(date, lla.lat * DEG2RAD, lla.lon * DEG2RAD, this.ra, this.dec);

    return { az: starPos.az, el: starPos.el, rng: 250000 };
  }

  private static calculateTimeVariables(date: Date): { gmst: GreenwichMeanSiderealTime; j: number } {
    const j =
      Utils.jday(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      ) +
      date.getUTCMilliseconds() * DAY_TO_MS;
    const gmst = Sgp4.gstime(j);

    return { gmst, j };
  }
}
