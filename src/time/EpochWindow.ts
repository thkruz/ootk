import { EpochUTC } from './Epoch';

export class EpochWindow {
  start: EpochUTC;
  end: EpochUTC;
  constructor(start: EpochUTC, end: EpochUTC) {
    this.start = start;
    this.end = end;
  }
}
