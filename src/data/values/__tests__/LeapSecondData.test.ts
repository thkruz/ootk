import { leapSecondData } from '../LeapSecondData';

describe('LeapSecondData', () => {
  describe('getLeapSeconds', () => {
    it('should return the last offset when jd is greater than or equal to the last jd', () => {
      const result = leapSecondData.getLeapSeconds(2457754.5);

      expect(result).toBe(37);
    });

    it('should return the last offset when jd is after the last known leap second', () => {
      const result = leapSecondData.getLeapSeconds(2460000.0);

      expect(result).toBe(37);
    });

    it('should return the first offset when jd is less than or equal to the first jd', () => {
      const result = leapSecondData.getLeapSeconds(2441317.5);

      expect(result).toBe(10);
    });

    it('should return the first offset when jd is before the first known leap second', () => {
      const result = leapSecondData.getLeapSeconds(2440000.0);

      expect(result).toBe(10);
    });

    it('should return correct offset for a date between two leap seconds', () => {
      const result = leapSecondData.getLeapSeconds(2441400.0);

      expect(result).toBe(10);
    });

    it('should return correct offset at the exact boundary of a leap second', () => {
      const result = leapSecondData.getLeapSeconds(2441499.5);

      expect(result).toBe(11);
    });

    it('should return correct offset for a middle range date', () => {
      const result = leapSecondData.getLeapSeconds(2450000.0);

      expect(result).toBe(29);
    });

    it('should return correct offset for date just before a leap second transition', () => {
      const result = leapSecondData.getLeapSeconds(2441499.4);

      expect(result).toBe(10);
    });

    it('should return correct offset for a recent date', () => {
      const result = leapSecondData.getLeapSeconds(2457300.0);

      expect(result).toBe(36);
    });
  });
});
