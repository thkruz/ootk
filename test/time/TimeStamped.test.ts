import { EpochUTC, TimeStamped } from '../../src/main';

describe('TimeStamped', () => {
  it('should be constructed from an epoch', () => {
    const epoch = EpochUTC.fromDateTimeString('1980-01-06T00:00:00.000Z');
    const timeStamped = new TimeStamped(epoch, 'test');

    expect(timeStamped).toMatchSnapshot();
  });
});
