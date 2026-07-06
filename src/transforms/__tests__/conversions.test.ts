import { Degrees, PI, Radians, ValidationError } from '../../main';
import { deg2rad, getDegLat, getDegLon, getRadLat, getRadLon, rad2deg } from '../conversions';

describe('conversions', () => {
  describe('rad2deg', () => {
    it('should convert radians to degrees', () => {
      expect(rad2deg(PI as Radians)).toBeCloseTo(180);
      expect(rad2deg((PI / 2) as Radians)).toBeCloseTo(90);
      expect(rad2deg(0 as Radians)).toBe(0);
      expect(rad2deg((-PI / 2) as Radians)).toBeCloseTo(-90);
      expect(rad2deg(-PI as Radians)).toBeCloseTo(-180);
    });
  });

  describe('deg2rad', () => {
    it('should convert degrees to radians', () => {
      expect(deg2rad(180 as Degrees)).toBeCloseTo(PI);
      expect(deg2rad(90 as Degrees)).toBeCloseTo(PI / 2);
      expect(deg2rad(0 as Degrees)).toBe(0);
      expect(deg2rad(-90 as Degrees)).toBeCloseTo(-PI / 2);
      expect(deg2rad(-180 as Degrees)).toBeCloseTo(-PI);
    });
  });

  describe('getDegLat', () => {
    it('should convert radians to degrees for latitude', () => {
      expect(getDegLat((PI / 2) as Radians)).toBeCloseTo(90);
      expect(getDegLat(0 as Radians)).toBe(0);
      expect(getDegLat((-PI / 2) as Radians)).toBeCloseTo(-90);
    });

    it('should throw RangeError for values outside [-PI/2; PI/2]', () => {
      expect(() => getDegLat(PI as Radians)).toThrow(ValidationError);
      expect(() => getDegLat((-PI) as Radians)).toThrow(ValidationError);
      expect(() => getDegLat((PI / 2 + 0.1) as Radians)).toThrow('Latitude radians must be in range [-PI/2; PI/2]');
    });
  });

  describe('getDegLon', () => {
    it('should convert radians to degrees for longitude', () => {
      expect(getDegLon(PI as Radians)).toBeCloseTo(180);
      expect(getDegLon(0 as Radians)).toBe(0);
      expect(getDegLon(-PI as Radians)).toBeCloseTo(-180);
    });

    it('should throw RangeError for values outside [-PI; PI]', () => {
      expect(() => getDegLon((PI + 0.1) as Radians)).toThrow(ValidationError);
      expect(() => getDegLon((-PI - 0.1) as Radians)).toThrow(ValidationError);
      expect(() => getDegLon((2 * PI) as Radians)).toThrow('Longitude radians must be in range [-PI; PI]');
    });
  });

  describe('getRadLat', () => {
    it('should convert degrees to radians for latitude', () => {
      expect(getRadLat(90 as Degrees)).toBeCloseTo(PI / 2);
      expect(getRadLat(0 as Degrees)).toBe(0);
      expect(getRadLat(-90 as Degrees)).toBeCloseTo(-PI / 2);
    });

    it('should throw RangeError for values outside [-90; 90]', () => {
      expect(() => getRadLat(91 as Degrees)).toThrow(ValidationError);
      expect(() => getRadLat(-91 as Degrees)).toThrow(ValidationError);
      expect(() => getRadLat(180 as Degrees)).toThrow('Latitude degrees must be in range [-90; 90]');
    });
  });

  describe('getRadLon', () => {
    it('should convert degrees to radians for longitude', () => {
      expect(getRadLon(180 as Degrees)).toBeCloseTo(PI);
      expect(getRadLon(0 as Degrees)).toBe(0);
      expect(getRadLon(-180 as Degrees)).toBeCloseTo(-PI);
    });

    it('should throw RangeError for values outside [-180; 180]', () => {
      expect(() => getRadLon(181 as Degrees)).toThrow(ValidationError);
      expect(() => getRadLon(-181 as Degrees)).toThrow(ValidationError);
      expect(() => getRadLon(360 as Degrees)).toThrow('Longitude degrees must be in range [-180; 180]');
    });
  });
});
