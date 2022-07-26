export class TleFormatData {
  public start: number;

  public stop: number;

  public length: number;

  constructor(start: number, end: number) {
    this.start = start - 1;
    this.stop = end;
    this.length = this.stop - this.start;
  }
}
