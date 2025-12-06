import { Satellite, TleLine1, TleLine2 } from '../../main';

describe('Satellite', () => {
  // ISS TLE for testing
  const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
  const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

  describe('history tracking', () => {
    it('should not have history enabled by default', () => {
      const sat = new Satellite({ tle1, tle2 });

      expect(sat.isHistoryEnabled).toBe(false);
      expect(sat.history).toBeNull();
    });

    it('should enable history via constructor config', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      expect(sat.isHistoryEnabled).toBe(true);
      expect(sat.history).not.toBeNull();
    });

    it('should record position after eci() when history enabled', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      const date1 = new Date('2022-07-22T11:16:14Z'); // Close to TLE epoch
      const date2 = new Date('2022-07-22T11:17:14Z'); // 1 minute later

      sat.eci(date1);
      sat.eci(date2);

      const history = sat.history!;

      expect(history.length).toBe(2);
      expect(history.getAll()[0].time).toEqual(date1);
      expect(history.getAll()[1].time).toEqual(date2);

      // Verify position data was recorded
      const entry = history.getAll()[0];

      expect(entry.data.position).toBeDefined();
      expect(entry.data.velocity).toBeDefined();
      expect(entry.data.position.x).not.toBe(0);
    });

    it('should respect sampling interval', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100, samplingInterval: 60000 }, // 60s minimum
      });

      const date1 = new Date('2022-07-22T11:16:14Z');
      const date2 = new Date('2022-07-22T11:16:44Z'); // 30s later (within interval)
      const date3 = new Date('2022-07-22T11:17:44Z'); // 90s after date1 (outside interval)

      sat.eci(date1);
      sat.eci(date2); // Should be skipped due to sampling interval
      sat.eci(date3);

      expect(sat.history!.length).toBe(2); // Only date1 and date3
    });

    it('should respect maxLength', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 3, autoClean: true },
      });

      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        const date = new Date('2022-07-22T11:16:14Z');

        date.setMinutes(date.getMinutes() + i);
        sat.eci(date);
      }

      // Should only keep the last 3
      expect(sat.history!.length).toBe(3);
    });

    it('should enable/disable history post-construction', () => {
      const sat = new Satellite({ tle1, tle2 });

      sat.enableHistory({ maxLength: 50 });
      expect(sat.isHistoryEnabled).toBe(true);

      sat.eci(new Date('2022-07-22T11:16:14Z'));
      expect(sat.history!.length).toBe(1);

      sat.disableHistory();
      expect(sat.history).toBeNull();
      expect(sat.isHistoryEnabled).toBe(false);
    });

    it('should not record when history disabled', () => {
      const sat = new Satellite({ tle1, tle2 });

      sat.eci(new Date('2022-07-22T11:16:14Z'));
      sat.eci(new Date('2022-07-22T11:17:14Z'));

      // History should still be null
      expect(sat.history).toBeNull();
    });

    it('should handle propagation failure without recording', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      // Try propagating to a date far in the future (will likely fail or be invalid)
      const farFuture = new Date('2100-01-01T00:00:00Z');
      const result = sat.eci(farFuture);

      // Even if it returns null or fails, history should not throw
      // and should not record invalid entries
      if (result === null) {
        expect(sat.history!.length).toBe(0);
      }
    });

    it('should preserve history data across multiple queries', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      const dates = [
        new Date('2022-07-22T11:16:14Z'),
        new Date('2022-07-22T11:17:14Z'),
        new Date('2022-07-22T11:18:14Z'),
      ];

      dates.forEach((date) => sat.eci(date));

      const history = sat.history!;
      const entries = history.getAll();

      expect(entries.length).toBe(3);

      // Verify each entry has correct structure
      entries.forEach((entry, i) => {
        expect(entry.time).toEqual(dates[i]);
        expect(entry.data.position).toBeDefined();
        expect(entry.data.velocity).toBeDefined();
        expect(typeof entry.data.position.x).toBe('number');
        expect(typeof entry.data.position.y).toBe('number');
        expect(typeof entry.data.position.z).toBe('number');
      });
    });

    it('should support getRange on history', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      const startDate = new Date('2022-07-22T11:16:14Z');

      // Add 5 entries, 1 minute apart
      for (let i = 0; i < 5; i++) {
        const date = new Date(startDate.getTime() + i * 60000);

        sat.eci(date);
      }

      // Get range for middle 3 entries
      const rangeStart = new Date(startDate.getTime() + 60000); // 2nd entry
      const rangeEnd = new Date(startDate.getTime() + 180000); // 4th entry

      const range = sat.history!.getRange(rangeStart, rangeEnd);

      expect(range.length).toBe(3);
    });

    it('should support getLast on history', () => {
      const sat = new Satellite({
        tle1,
        tle2,
        historyConfig: { maxLength: 100 },
      });

      const dates = [
        new Date('2022-07-22T11:16:14Z'),
        new Date('2022-07-22T11:17:14Z'),
        new Date('2022-07-22T11:18:14Z'),
      ];

      dates.forEach((date) => sat.eci(date));

      const last2 = sat.history!.getLast(2);

      expect(last2.length).toBe(2);
      expect(last2[0].time).toEqual(dates[1]);
      expect(last2[1].time).toEqual(dates[2]);
    });
  });
});
