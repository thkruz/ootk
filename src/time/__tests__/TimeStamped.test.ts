import { EpochUTC, TimeStamped } from '../../main';

describe('TimeStamped', () => {
  it('should be constructed from an epoch', () => {
    const epoch = EpochUTC.fromDateTimeString('1980-01-06T00:00:00.000Z');
    const timeStamped = new TimeStamped(epoch, 'test');

    expect(timeStamped).toMatchSnapshot();
  });

  it('should store the epoch correctly', () => {
    const epoch = EpochUTC.fromDateTimeString('2000-01-01T12:00:00.000Z');
    const timeStamped = new TimeStamped(epoch, 42);

    expect(timeStamped.epoch_).toBe(epoch);
  });

  it('should store the value correctly', () => {
    const epoch = EpochUTC.fromDateTimeString('2000-01-01T12:00:00.000Z');
    const value = { test: 'data' };
    const timeStamped = new TimeStamped(epoch, value);

    expect(timeStamped.value).toBe(value);
  });

  it('should work with different value types', () => {
    const epoch = EpochUTC.fromDateTimeString('2000-01-01T12:00:00.000Z');

    const numberStamped = new TimeStamped(epoch, 123);

    expect(numberStamped.value).toBe(123);

    const stringStamped = new TimeStamped(epoch, 'test string');

    expect(stringStamped.value).toBe('test string');

    const objectStamped = new TimeStamped(epoch, { key: 'value' });

    expect(objectStamped.value).toEqual({ key: 'value' });
  });

  it('should have readonly epoch and value properties', () => {
    const epoch = EpochUTC.fromDateTimeString('2000-01-01T12:00:00.000Z');
    const timeStamped = new TimeStamped(epoch, 'test');

    expect(() => {
      timeStamped.epoch = EpochUTC.fromDateTimeString('2000-01-02T12:00:00.000Z');
    }).toThrow();

    expect(() => {
      timeStamped.value = 'new value';
    }).toThrow();
  });

  it('should get the epoch correctly', () => {
    const epoch = EpochUTC.fromDateTimeString('2000-01-01T12:00:00.000Z');
    const timeStamped = new TimeStamped(epoch, 'test');

    expect(timeStamped.epoch).toBe(epoch);
    expect(timeStamped.epoch).toEqual(epoch);
  });
});
