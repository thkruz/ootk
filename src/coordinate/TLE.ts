import { Earth } from '../body/Earth';
import { Vector3D } from '../operations/Vector3D';
import { Sgp4, Sgp4GravConstants } from '../sgp4/sgp4';
import { EpochUTC } from '../time/EpochUTC';
import { DEG2RAD, RAD2DEG, secondsPerDay, TAU } from '../utils/constants';
import { newtonNu } from '../utils/functions';
import { EciVec3, SatelliteRecord, StateVectorSgp4 } from './../types/types';
import { ClassicalElements } from './ClassicalElements';
import { FormatTle } from './FormatTle';
import { TEME } from './TEME';

export enum Sgp4OpsMode {
  afspc = 'a',
  improved = 'i',
}

export class TLE {
  line1: string;
  line2: string;
  epoch: EpochUTC;
  satnum: number;
  private _satrec: SatelliteRecord;
  private static alpha5_ = {
    A: '10',
    B: '11',
    C: '12',
    D: '13',
    E: '14',
    F: '15',
    G: '16',
    H: '17',
    J: '18',
    K: '19',
    L: '20',
    M: '21',
    N: '22',
    P: '23',
    Q: '24',
    R: '25',
    S: '26',
    T: '27',
    U: '28',
    V: '29',
    W: '30',
    X: '31',
    Y: '32',
    Z: '33',
  };

  constructor(
    line1: string,
    line2: string,
    opsMode: Sgp4OpsMode = Sgp4OpsMode.afspc,
    gravConst: Sgp4GravConstants = Sgp4GravConstants.wgs72,
  ) {
    this.line1 = line1;
    this.line2 = line2;
    this.epoch = TLE.parseEpoch_(line1.substring(18, 32));
    this.satnum = TLE.parseSatnum_(line1.substring(2, 7));
    this._satrec = Sgp4.createSatrec(line1, line2, gravConst, opsMode);
  }

  toString(): string {
    return `${this.line1}\n${this.line2}`;
  }

  get semimajorAxis(): number {
    return TLE.tleSma_(this.line2);
  }

  get eccentricity(): number {
    return TLE.tleEcc_(this.line2);
  }

  get inclination(): number {
    return TLE.tleInc_(this.line2);
  }

  get inclinationDegrees(): number {
    return TLE.tleInc_(this.line2) * RAD2DEG;
  }

  get apogee(): number {
    return this.semimajorAxis * (1 + this.eccentricity);
  }

  get perigee(): number {
    return this.semimajorAxis * (1 - this.eccentricity);
  }

  get period(): number {
    return TAU * Math.sqrt(this.semimajorAxis ** 3 / Earth.mu);
  }

  private static parseEpoch_(epochStr: string): EpochUTC {
    let year = parseInt(epochStr.substring(0, 2));

    if (year >= 57) {
      year += 1900;
    } else {
      year += 2000;
    }
    const days = parseFloat(epochStr.substring(2, 14)) - 1;

    return EpochUTC.fromDateTimeString(`${year}-01-01T00:00:00.000Z`).roll(days * secondsPerDay);
  }

  private static parseSatnum_(satnumStr: string): number {
    const values = satnumStr.toUpperCase().split('');

    if (values[0] in TLE.alpha5_) {
      values[0] = TLE.alpha5_[values[0]];
    }

    return parseInt(values.join(''));
  }

  propagate(epoch: EpochUTC): TEME {
    const r = new Float64Array(3);
    const v = new Float64Array(3);

    const stateVector = Sgp4.propagate(this._satrec, epoch.difference(this.epoch) / 60.0);

    if (!stateVector) {
      throw new Error('Propagation failed');
    }

    TLE.sv2rv_(stateVector, r, v);

    return new TEME(epoch, new Vector3D(r[0], r[1], r[2]), new Vector3D(v[0], v[1], v[2]));
  }

  private static sv2rv_(stateVector: StateVectorSgp4, r: Float64Array, v: Float64Array) {
    const pos = stateVector.position as EciVec3;
    const vel = stateVector.velocity as EciVec3;

    r[0] = pos.x;
    r[1] = pos.y;
    r[2] = pos.z;
    v[0] = vel.x;
    v[1] = vel.y;
    v[2] = vel.z;
  }

  private currentState_(): TEME {
    const r = new Float64Array(3);
    const v = new Float64Array(3);

    const stateVector = Sgp4.propagate(this._satrec, 0.0);

    TLE.sv2rv_(stateVector, r, v);

    return new TEME(this.epoch, new Vector3D(r[0], r[1], r[2]), new Vector3D(v[0], v[1], v[2]));
  }

  get state(): TEME {
    return this.currentState_();
  }

  private static tleSma_(line2: string): number {
    const n = parseFloat(line2.substring(52, 63));

    return Earth.mu ** (1 / 3) / ((TAU * n) / secondsPerDay) ** (2 / 3);
  }

  private static tleEcc_(line2: string): number {
    return parseFloat(`0.${line2.substring(26, 33)}`);
  }

  private static tleInc_(line2: string): number {
    return parseFloat(line2.substring(8, 16)) * DEG2RAD;
  }

  static fromClassicalElements(elements: ClassicalElements): TLE {
    const { epochYr, epochDay } = elements.epoch.toEpochYearAndDay();
    const intl = '58001A  ';
    const scc = '00001';

    const tles = FormatTle.createTle({
      inc: FormatTle.inclination(elements.inclinationDegrees),
      meanmo: FormatTle.meanMotion(elements.revsPerDay()),
      ecen: FormatTle.eccentricity(elements.eccentricity.toFixed(7)),
      argPe: FormatTle.argumentOfPerigee(elements.argPerigeeDegrees),
      meana: FormatTle.meanAnomaly(newtonNu(elements.eccentricity, elements.trueAnomaly).m * RAD2DEG),
      rasc: FormatTle.rightAscension(elements.rightAscensionDegrees),
      epochday: epochDay,
      epochyr: epochYr,
      scc,
      intl,
    });

    return new TLE(tles.tle1, tles.tle2);
  }
}
