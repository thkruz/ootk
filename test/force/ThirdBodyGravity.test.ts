import { ThirdBodyGravity } from '../../src/force/ThirdBodyGravity';

describe('ThirdBodyGravity', () => {
  describe('constructor', () => {
    it('should create instance with default values (moon and sun disabled)', () => {
      const gravity = new ThirdBodyGravity();

      expect(gravity.moon).toBe(false);
      expect(gravity.sun).toBe(false);
    });

    it('should create instance with moon enabled only', () => {
      const gravity = new ThirdBodyGravity(true);

      expect(gravity.moon).toBe(true);
      expect(gravity.sun).toBe(false);
    });

    it('should create instance with sun enabled only', () => {
      const gravity = new ThirdBodyGravity(false, true);

      expect(gravity.moon).toBe(false);
      expect(gravity.sun).toBe(true);
    });

    it('should create instance with both moon and sun enabled', () => {
      const gravity = new ThirdBodyGravity(true, true);

      expect(gravity.moon).toBe(true);
      expect(gravity.sun).toBe(true);
    });

    it('should create instance with both moon and sun disabled', () => {
      const gravity = new ThirdBodyGravity(false, false);

      expect(gravity.moon).toBe(false);
      expect(gravity.sun).toBe(false);
    });


  });
});
