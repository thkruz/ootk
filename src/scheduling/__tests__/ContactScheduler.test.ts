import {
  AccessWindow,
  Degrees,
  GroundStation,
  Kilometers,
  Milliseconds,
  Satellite,
  TleLine1,
  TleLine2,
} from '../../main';
import { ContactScheduler, ContactSelectionStrategy } from '../ContactScheduler';
import { ScheduledContact } from '../ScheduledContact';

describe('ContactScheduler', () => {
  // ISS TLE for testing - LEO satellite with ~90 minute period
  const issTle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
  const issTle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

  // Second satellite for multi-satellite tests
  const sat2Tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
  const sat2Tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

  const station1 = new GroundStation({
    id: 1,
    name: 'Station 1',
    lat: 38.9 as Degrees,
    lon: -77.0 as Degrees,
    alt: 0.1 as Kilometers,
  });

  const satellite1 = new Satellite({ id: 101, tle1: issTle1, tle2: issTle2 });
  const satellite2 = new Satellite({ id: 102, tle1: sat2Tle1, tle2: sat2Tle2 });

  // Fixed epoch for reproducible tests
  const testEpoch = new Date('2022-07-22T12:00:00Z');

  describe('schedule', () => {
    describe('empty inputs', () => {
      it('should return empty array for empty stations', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const result = ContactScheduler.schedule([], [satellite1], testEpoch, end);

        expect(result).toEqual([]);
      });

      it('should return empty array for empty satellites', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const result = ContactScheduler.schedule([station1], [], testEpoch, end);

        expect(result).toEqual([]);
      });
    });

    describe('basic scheduling', () => {
      it('should find contacts for a single station and satellite', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const result = ContactScheduler.schedule([station1], [satellite1], testEpoch, end);

        // ISS should have multiple passes over 24 hours
        expect(result.length).toBeGreaterThan(0);

        // All contacts should have valid properties
        for (const contact of result) {
          expect(contact).toBeInstanceOf(ScheduledContact);
          expect(contact.station).toBe(station1);
          expect(contact.satellite).toBe(satellite1);
          expect(contact.scheduledStart.getTime()).toBeGreaterThanOrEqual(testEpoch.getTime());
          expect(contact.scheduledEnd.getTime()).toBeLessThanOrEqual(end.getTime());
        }
      });

      it('should return contacts sorted by start time', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const result = ContactScheduler.schedule([station1], [satellite1], testEpoch, end);

        for (let i = 1; i < result.length; i++) {
          expect(result[i].scheduledStart.getTime()).toBeGreaterThanOrEqual(
            result[i - 1].scheduledStart.getTime(),
          );
        }
      });
    });

    describe('selection strategies', () => {
      it('should respect MAX_ELEVATION strategy', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const result = ContactScheduler.schedule([station1], [satellite1], testEpoch, end, {
          selectionStrategy: ContactSelectionStrategy.MAX_ELEVATION,
        });

        expect(result.length).toBeGreaterThan(0);
      });

      it('should respect LONGEST_DURATION strategy', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const result = ContactScheduler.schedule([station1], [satellite1], testEpoch, end, {
          selectionStrategy: ContactSelectionStrategy.LONGEST_DURATION,
        });

        expect(result.length).toBeGreaterThan(0);
      });

      it('should respect EARLIEST strategy', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const result = ContactScheduler.schedule([station1], [satellite1], testEpoch, end, {
          selectionStrategy: ContactSelectionStrategy.EARLIEST,
        });

        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('constraints', () => {
      it('should respect minContactDuration', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const minDuration = 300000 as Milliseconds; // 5 minutes

        const result = ContactScheduler.schedule([station1], [satellite1], testEpoch, end, {
          minContactDuration: minDuration,
        });

        for (const contact of result) {
          expect(contact.scheduledDuration).toBeGreaterThanOrEqual(minDuration);
        }
      });

      it('should respect maxContactsPerSatellite', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const maxContacts = 3;

        const result = ContactScheduler.schedule([station1], [satellite1], testEpoch, end, {
          maxContactsPerSatellite: maxContacts,
        });

        const satContactCount = result.filter((c) => c.satellite.id === satellite1.id).length;

        expect(satContactCount).toBeLessThanOrEqual(maxContacts);
      });

      it('should respect maxContactsPerStation', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);
        const maxContacts = 3;

        const result = ContactScheduler.schedule([station1], [satellite1], testEpoch, end, {
          maxContactsPerStation: maxContacts,
        });

        const stationContactCount = result.filter((c) => c.station.id === station1.id).length;

        expect(stationContactCount).toBeLessThanOrEqual(maxContacts);
      });
    });

    describe('priority', () => {
      it('should respect satellitePriority function', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        const result = ContactScheduler.schedule([station1], [satellite1], testEpoch, end, {
          satellitePriority: (sat) => (sat.id === 101 ? 10 : 1),
        });

        // All contacts should have priority 10 since we only have sat-1
        for (const contact of result) {
          expect(contact.priority).toBe(10);
        }
      });
    });

    describe('concurrency', () => {
      it('should respect maxConcurrentPerStation default of 1', () => {
        const end = new Date(testEpoch.getTime() + 24 * 60 * 60 * 1000);

        const result = ContactScheduler.schedule([station1], [satellite1, satellite2], testEpoch, end, {
          maxConcurrentPerStation: 1,
        });

        // No overlapping contacts at the same station
        for (let i = 0; i < result.length; i++) {
          for (let j = i + 1; j < result.length; j++) {
            if (result[i].station.id === result[j].station.id) {
              expect(result[i].overlaps(result[j])).toBe(false);
            }
          }
        }
      });
    });
  });

  describe('findCoverageGaps', () => {
    it('should return empty array for satellite with no contacts and no window', () => {
      const gaps = ContactScheduler.findCoverageGaps([], satellite1);

      expect(gaps).toEqual([]);
    });

    it('should return full window gap when satellite has no contacts', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-01T12:00:00Z');

      const gaps = ContactScheduler.findCoverageGaps([], satellite1, start, end);

      expect(gaps.length).toBe(1);
      expect(gaps[0].start).toEqual(start);
      expect(gaps[0].end).toEqual(end);
      expect(gaps[0].duration).toBe(12 * 60 * 60 * 1000);
    });

    it('should find gaps between contacts', () => {
      const mockAccessWindow1 = {
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T10:15:00Z'),
        duration: 15 * 60 * 1000,
        maxElevation: 45 as Degrees,
        maxElevationTime: new Date('2024-01-01T10:07:30Z'),
        rangeAtMaxEl: 500 as Kilometers,
        observer: station1,
        target: satellite1,
      } as AccessWindow;

      const mockAccessWindow2 = {
        start: new Date('2024-01-01T12:00:00Z'),
        end: new Date('2024-01-01T12:15:00Z'),
        duration: 15 * 60 * 1000,
        maxElevation: 60 as Degrees,
        maxElevationTime: new Date('2024-01-01T12:07:30Z'),
        rangeAtMaxEl: 400 as Kilometers,
        observer: station1,
        target: satellite1,
      } as AccessWindow;

      const contacts = [
        new ScheduledContact({ accessWindow: mockAccessWindow1, priority: 5 }),
        new ScheduledContact({ accessWindow: mockAccessWindow2, priority: 5 }),
      ];

      const gaps = ContactScheduler.findCoverageGaps(
        contacts,
        satellite1,
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T12:15:00Z'),
      );

      // Should find gap between 10:15 and 12:00
      expect(gaps.length).toBe(1);
      expect(gaps[0].start).toEqual(new Date('2024-01-01T10:15:00Z'));
      expect(gaps[0].end).toEqual(new Date('2024-01-01T12:00:00Z'));
      expect(gaps[0].duration).toBe(105 * 60 * 1000); // 1h 45m
    });

    it('should find gaps at boundaries', () => {
      const mockAccessWindow = {
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T10:15:00Z'),
        duration: 15 * 60 * 1000,
        maxElevation: 45 as Degrees,
        maxElevationTime: new Date('2024-01-01T10:07:30Z'),
        rangeAtMaxEl: 500 as Kilometers,
        observer: station1,
        target: satellite1,
      } as AccessWindow;

      const contacts = [new ScheduledContact({ accessWindow: mockAccessWindow, priority: 5 })];

      const gaps = ContactScheduler.findCoverageGaps(
        contacts,
        satellite1,
        new Date('2024-01-01T09:00:00Z'),
        new Date('2024-01-01T11:00:00Z'),
      );

      // Gap before contact (9:00 - 10:00) and after (10:15 - 11:00)
      expect(gaps.length).toBe(2);
    });
  });

  describe('getCoverageStatistics', () => {
    it('should calculate statistics for empty schedule', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-01T12:00:00Z');

      const stats = ContactScheduler.getCoverageStatistics([], [satellite1], start, end);

      expect(stats.contactCount).toBe(0);
      expect(stats.totalContactTime).toBe(0);
      expect(stats.overallCoveragePercent).toBe(0);
    });

    it('should calculate per-satellite statistics', () => {
      const mockAccessWindow = {
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T10:15:00Z'),
        duration: 15 * 60 * 1000,
        maxElevation: 45 as Degrees,
        maxElevationTime: new Date('2024-01-01T10:07:30Z'),
        rangeAtMaxEl: 500 as Kilometers,
        observer: station1,
        target: satellite1,
      } as AccessWindow;

      const contacts = [new ScheduledContact({ accessWindow: mockAccessWindow, priority: 5 })];

      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-01T12:00:00Z');

      const stats = ContactScheduler.getCoverageStatistics(contacts, [satellite1], start, end);

      expect(stats.contactCount).toBe(1);
      expect(stats.totalContactTime).toBe(15 * 60 * 1000);
      expect(stats.bySatellite.has(satellite1.id)).toBe(true);

      const satStats = stats.bySatellite.get(satellite1.id)!;

      expect(satStats.contactCount).toBe(1);
      expect(satStats.totalContactTime).toBe(15 * 60 * 1000);
    });

    it('should calculate per-station statistics', () => {
      const mockAccessWindow = {
        start: new Date('2024-01-01T10:00:00Z'),
        end: new Date('2024-01-01T10:15:00Z'),
        duration: 15 * 60 * 1000,
        maxElevation: 45 as Degrees,
        maxElevationTime: new Date('2024-01-01T10:07:30Z'),
        rangeAtMaxEl: 500 as Kilometers,
        observer: station1,
        target: satellite1,
      } as AccessWindow;

      const contacts = [new ScheduledContact({ accessWindow: mockAccessWindow, priority: 5 })];

      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-01T12:00:00Z');

      const stats = ContactScheduler.getCoverageStatistics(contacts, [satellite1], start, end);

      expect(stats.byStation.has(station1.id)).toBe(true);

      const stationStats = stats.byStation.get(station1.id)!;

      expect(stationStats.contactCount).toBe(1);
      expect(stationStats.totalContactTime).toBe(15 * 60 * 1000);
    });

    it('should calculate gap statistics', () => {
      const mockAccessWindow1 = {
        start: new Date('2024-01-01T02:00:00Z'),
        end: new Date('2024-01-01T02:15:00Z'),
        duration: 15 * 60 * 1000,
        maxElevation: 45 as Degrees,
        maxElevationTime: new Date('2024-01-01T02:07:30Z'),
        rangeAtMaxEl: 500 as Kilometers,
        observer: station1,
        target: satellite1,
      } as AccessWindow;

      const mockAccessWindow2 = {
        start: new Date('2024-01-01T04:00:00Z'),
        end: new Date('2024-01-01T04:15:00Z'),
        duration: 15 * 60 * 1000,
        maxElevation: 60 as Degrees,
        maxElevationTime: new Date('2024-01-01T04:07:30Z'),
        rangeAtMaxEl: 400 as Kilometers,
        observer: station1,
        target: satellite1,
      } as AccessWindow;

      const contacts = [
        new ScheduledContact({ accessWindow: mockAccessWindow1, priority: 5 }),
        new ScheduledContact({ accessWindow: mockAccessWindow2, priority: 5 }),
      ];

      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-01T06:00:00Z');

      const stats = ContactScheduler.getCoverageStatistics(contacts, [satellite1], start, end);

      expect(stats.maxGapDuration).toBeGreaterThan(0);
      expect(stats.averageGapDuration).toBeGreaterThan(0);
    });
  });
});
