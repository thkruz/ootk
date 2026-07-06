import { EpochUTC, EpochWindow } from '../../main';

describe('EpochWindow', () => {
  it('should be constructed from a start and end epoch', () => {
    const start = EpochUTC.fromDateTimeString('1980-01-06T00:00:00.000Z');
    const end = EpochUTC.fromDateTimeString('1980-01-07T00:00:00.000Z');
    const epoch = new EpochWindow(start, end);

    expect(epoch.start).toEqual(start);
    expect(epoch.end).toEqual(end);
  });

  it('should store start and end epochs correctly', () => {
    const start = EpochUTC.fromDateTimeString('2000-01-01T12:00:00.000Z');
    const end = EpochUTC.fromDateTimeString('2000-01-02T12:00:00.000Z');
    const window = new EpochWindow(start, end);

    expect(window.start).toBe(start);
    expect(window.end).toBe(end);
  });

  it('should allow different epoch values', () => {
    const start = EpochUTC.fromDateTimeString('2020-06-15T08:30:00.000Z');
    const end = EpochUTC.fromDateTimeString('2020-06-15T18:45:00.000Z');
    const window = new EpochWindow(start, end);

    expect(window.start).toEqual(start);
    expect(window.end).toEqual(end);
  });
});
