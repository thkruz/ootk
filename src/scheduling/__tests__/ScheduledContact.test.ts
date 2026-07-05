import {
  AccessWindow,
  Degrees,
  GroundStation,
  Kilometers,
  Satellite,
  TleLine1,
  TleLine2,
} from '../../main';
import { ScheduledContact } from '../ScheduledContact';

describe('ScheduledContact', () => {
  // ISS TLE for testing
  const issTle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
  const issTle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

  const station = new GroundStation({
    id: 1,
    name: 'Test Station',
    lat: 38.9 as Degrees,
    lon: -77.0 as Degrees,
    alt: 0.1 as Kilometers,
  });

  const satellite = new Satellite({ tle1: issTle1, tle2: issTle2 });

  const mockAccessWindow: AccessWindow = {
    start: new Date('2024-01-01T10:00:00Z'),
    end: new Date('2024-01-01T10:15:00Z'),
    duration: 15 * 60 * 1000, // 15 minutes in ms
    maxElevation: 45 as Degrees,
    maxElevationTime: new Date('2024-01-01T10:07:30Z'),
    rangeAtMaxEl: 500 as Kilometers,
    observer: station,
    target: satellite,
  } as AccessWindow;

  describe('constructor', () => {
    it('should create a ScheduledContact with default times from accessWindow', () => {
      const contact = new ScheduledContact({
        accessWindow: mockAccessWindow,
        priority: 5,
      });

      expect(contact.accessWindow).toBe(mockAccessWindow);
      expect(contact.priority).toBe(5);
      expect(contact.scheduledStart).toEqual(mockAccessWindow.start);
      expect(contact.scheduledEnd).toEqual(mockAccessWindow.end);
      expect(contact.scheduledDuration).toBe(15 * 60 * 1000);
    });

    it('should allow custom scheduled times for partial contacts', () => {
      const customStart = new Date('2024-01-01T10:05:00Z');
      const customEnd = new Date('2024-01-01T10:10:00Z');

      const contact = new ScheduledContact({
        accessWindow: mockAccessWindow,
        priority: 3,
        scheduledStart: customStart,
        scheduledEnd: customEnd,
      });

      expect(contact.scheduledStart).toEqual(customStart);
      expect(contact.scheduledEnd).toEqual(customEnd);
      expect(contact.scheduledDuration).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should store metadata', () => {
      const contact = new ScheduledContact({
        accessWindow: mockAccessWindow,
        priority: 1,
        metadata: { dataVolume: 100, linkType: 'S-band' },
      });

      expect(contact.metadata).toEqual({ dataVolume: 100, linkType: 'S-band' });
    });
  });

  describe('getters', () => {
    let contact: ScheduledContact;

    beforeEach(() => {
      contact = new ScheduledContact({
        accessWindow: mockAccessWindow,
        priority: 5,
      });
    });

    it('should delegate start to accessWindow', () => {
      expect(contact.start).toEqual(mockAccessWindow.start);
    });

    it('should delegate end to accessWindow', () => {
      expect(contact.end).toEqual(mockAccessWindow.end);
    });

    it('should delegate duration to accessWindow', () => {
      expect(contact.duration).toBe(mockAccessWindow.duration);
    });

    it('should delegate maxElevation to accessWindow', () => {
      expect(contact.maxElevation).toBe(mockAccessWindow.maxElevation);
    });

    it('should delegate maxElevationTime to accessWindow', () => {
      expect(contact.maxElevationTime).toEqual(mockAccessWindow.maxElevationTime);
    });

    it('should delegate rangeAtMaxEl to accessWindow', () => {
      expect(contact.rangeAtMaxEl).toBe(mockAccessWindow.rangeAtMaxEl);
    });

    it('should delegate observer to accessWindow', () => {
      expect(contact.observer).toBe(mockAccessWindow.observer);
    });

    it('should delegate target to accessWindow', () => {
      expect(contact.target).toBe(mockAccessWindow.target);
    });

    it('should provide station convenience getter', () => {
      expect(contact.station).toBe(station);
    });

    it('should provide satellite convenience getter', () => {
      expect(contact.satellite).toBe(satellite);
    });
  });

  describe('overlaps', () => {
    const baseContact = new ScheduledContact({
      accessWindow: mockAccessWindow,
      priority: 5,
    });

    it('should return true for overlapping contacts', () => {
      const overlapping = new ScheduledContact({
        accessWindow: {
          ...mockAccessWindow,
          start: new Date('2024-01-01T10:10:00Z'),
          end: new Date('2024-01-01T10:20:00Z'),
        } as AccessWindow,
        priority: 3,
      });

      expect(baseContact.overlaps(overlapping)).toBe(true);
    });

    it('should return false for non-overlapping contacts', () => {
      const nonOverlapping = new ScheduledContact({
        accessWindow: {
          ...mockAccessWindow,
          start: new Date('2024-01-01T10:20:00Z'),
          end: new Date('2024-01-01T10:30:00Z'),
        } as AccessWindow,
        priority: 3,
      });

      expect(baseContact.overlaps(nonOverlapping)).toBe(false);
    });

    it('should return false when one ends exactly when other starts', () => {
      const adjacent = new ScheduledContact({
        accessWindow: {
          ...mockAccessWindow,
          start: new Date('2024-01-01T10:15:00Z'),
          end: new Date('2024-01-01T10:25:00Z'),
        } as AccessWindow,
        priority: 3,
      });

      expect(baseContact.overlaps(adjacent)).toBe(false);
    });
  });

  describe('conflictsWith', () => {
    const station2 = new GroundStation({
      id: 2,
      name: 'Test Station 2',
      lat: 40.0 as Degrees,
      lon: -75.0 as Degrees,
      alt: 0.1 as Kilometers,
    });

    const baseContact = new ScheduledContact({
      accessWindow: mockAccessWindow,
      priority: 5,
    });

    it('should return true when same station and overlapping', () => {
      const conflicting = new ScheduledContact({
        accessWindow: {
          ...mockAccessWindow,
          start: new Date('2024-01-01T10:10:00Z'),
          end: new Date('2024-01-01T10:20:00Z'),
        } as AccessWindow,
        priority: 3,
      });

      expect(baseContact.conflictsWith(conflicting)).toBe(true);
    });

    it('should return false when different stations', () => {
      const differentStation = new ScheduledContact({
        accessWindow: {
          ...mockAccessWindow,
          observer: station2,
          start: new Date('2024-01-01T10:10:00Z'),
          end: new Date('2024-01-01T10:20:00Z'),
        } as AccessWindow,
        priority: 3,
      });

      expect(baseContact.conflictsWith(differentStation)).toBe(false);
    });

    it('should return false when same station but not overlapping', () => {
      const nonOverlapping = new ScheduledContact({
        accessWindow: {
          ...mockAccessWindow,
          start: new Date('2024-01-01T10:20:00Z'),
          end: new Date('2024-01-01T10:30:00Z'),
        } as AccessWindow,
        priority: 3,
      });

      expect(baseContact.conflictsWith(nonOverlapping)).toBe(false);
    });

    it('should consider handover time buffer', () => {
      // Contact ends at 10:15, adjacent starts at 10:15
      const adjacent = new ScheduledContact({
        accessWindow: {
          ...mockAccessWindow,
          start: new Date('2024-01-01T10:15:00Z'),
          end: new Date('2024-01-01T10:25:00Z'),
        } as AccessWindow,
        priority: 3,
      });

      // No conflict without handover time
      expect(baseContact.conflictsWith(adjacent, 0)).toBe(false);

      // Conflict with 1 minute handover time
      expect(baseContact.conflictsWith(adjacent, 60000)).toBe(true);
    });
  });

  describe('withTimes', () => {
    it('should create a new contact with updated times', () => {
      const original = new ScheduledContact({
        accessWindow: mockAccessWindow,
        priority: 5,
        metadata: { key: 'value' },
      });

      const newStart = new Date('2024-01-01T10:05:00Z');
      const newEnd = new Date('2024-01-01T10:10:00Z');
      const modified = original.withTimes(newStart, newEnd);

      // New contact should have updated times
      expect(modified.scheduledStart).toEqual(newStart);
      expect(modified.scheduledEnd).toEqual(newEnd);
      expect(modified.scheduledDuration).toBe(5 * 60 * 1000);

      // Original should be unchanged
      expect(original.scheduledStart).toEqual(mockAccessWindow.start);
      expect(original.scheduledEnd).toEqual(mockAccessWindow.end);

      // Other properties should be preserved
      expect(modified.accessWindow).toBe(original.accessWindow);
      expect(modified.priority).toBe(original.priority);
      expect(modified.metadata).toEqual(original.metadata);
    });
  });

  describe('toString', () => {
    it('should return formatted string with contact details', () => {
      const contact = new ScheduledContact({
        accessWindow: mockAccessWindow,
        priority: 5,
      });

      const result = contact.toString();

      expect(result).toContain('[ScheduledContact]');
      expect(result).toContain('Station: Test Station');
      expect(result).toContain('Time: 10:00:00 - 10:15:00');
      expect(result).toContain('Max Elevation: 45.0°');
      expect(result).toContain('Priority: 5');
    });
  });
});
