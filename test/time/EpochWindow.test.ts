import { EpochUTC, EpochWindow } from '../../src/main';

describe('EpochWindow', () => {
  it('should be constructed from a start and end epoch', () => {
    const start = EpochUTC.fromDateTimeString('1980-01-06T00:00:00.000Z');
    const end = EpochUTC.fromDateTimeString('1980-01-07T00:00:00.000Z');
    const epoch = new EpochWindow(start, end);

    expect(epoch.start).toEqual(start);
    expect(epoch.end).toEqual(end);
  });
});
