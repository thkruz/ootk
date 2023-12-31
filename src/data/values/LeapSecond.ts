// / Leap second data.
export class LeapSecond {
  // / Julian date.
  jd: number;

  // / Offset seconds.
  offset: number;

  // / Create a new [LeapSecond] object.
  constructor(jd: number, offset: number) {
    this.jd = jd;
    this.offset = offset;
  }
}
