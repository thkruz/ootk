import { TleLine1, TleLine2, Tle } from '../../../main.js';

interface SatelliteCoreParams {
  name: string;
  altId: string;
  altName: string;
  sccNum: string;
  intlDes: string;
  tle1: TleLine1;
  tle2: TleLine2;
}

export class SatelliteCore {
  name: string;
  altId: string;
  altName: string;
  sccNum: string;
  sccNum5: string;
  sccNum6: string;
  intlDes: string;
  tle1: TleLine1;
  tle2: TleLine2;

  constructor(params: SatelliteCoreParams) {
    this.name = params.name;
    this.altId = params.altId;
    this.altName = params.altName;
    this.sccNum = params.sccNum;
    this.sccNum5 = Tle.convert6DigitToA5(params.sccNum);
    this.sccNum6 = Tle.convertA5to6Digit(this.sccNum5);
    this.intlDes = params.intlDes;
    this.tle1 = params.tle1;
    this.tle2 = params.tle2;
  }
}
