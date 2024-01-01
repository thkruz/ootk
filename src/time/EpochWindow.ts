import type { EpochUTC } from './EpochUTC';

export class EpochWindow {
  start: EpochUTC;
  end: EpochUTC;
  constructor(start: EpochUTC, end: EpochUTC) {
    this.start = start;
    this.end = end;
  }
}
