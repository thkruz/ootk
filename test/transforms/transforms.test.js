/**
 * @file   Tests from Transforms.js to ensure compatibility
 * @since  0.2.0
 */

import { Transforms } from '@lib/ootk-transforms.es.js'; // eslint-disable-line
import transformData from './transforms.json';

const numDigits = 6;

describe('Latitude & longitude conversions', () => {
  const {
    validLatitudes,
    validLongitudes,
    validGeodeticToEcf,
    validEciToGeodetic,
    validEciToEcf,
    validEcfToEci,
    validEcfToLookangles,
    invalidLatitudes,
    invalidLongitudes,
  } = transformData;

  validLatitudes.forEach((item) => {
    it(`convert valid latitude value (${item.radians} radians) to degrees`, () => {
      expect(Transforms.getDegLat(item.radians)).toBeCloseTo(item.degrees, numDigits);
    });
    it(`convert valid latitude value (${item.degrees} degrees) to radians`, () => {
      expect(Transforms.getRadLat(item.degrees)).toBeCloseTo(item.radians, numDigits);
    });
  });

  validLongitudes.forEach((item) => {
    it(`convert valid longitude value (${item.radians} radians) to degrees`, () => {
      expect(Transforms.getDegLon(item.radians)).toBeCloseTo(item.degrees, numDigits);
    });
    it(`convert valid longitude value (${item.degrees} degrees) to radians`, () => {
      expect(Transforms.getRadLon(item.degrees)).toBeCloseTo(item.radians, numDigits);
    });
  });

  validGeodeticToEcf.forEach((item) => {
    it('convert valid LLA coordinates to ECF', () => {
      const ecfCoordinates = Transforms.lla2ecf(item.lla);
      expect(ecfCoordinates.x).toBeCloseTo(item.ecf.x);
      expect(ecfCoordinates.y).toBeCloseTo(item.ecf.y);
      expect(ecfCoordinates.z).toBeCloseTo(item.ecf.z);
    });
  });

  validEciToGeodetic.forEach((item) => {
    it('convert valid ECI coordinates to LLA', () => {
      const llaCoordinates = Transforms.eci2lla(item.eci, item.gmst);
      expect(llaCoordinates.lon).toBeCloseTo(item.lla.lon);
      expect(llaCoordinates.lat).toBeCloseTo(item.lla.lat);
      expect(llaCoordinates.alt).toBeCloseTo(item.lla.alt);
    });
  });

  validEciToEcf.forEach((item) => {
    it('convert valid ECI coordinates to ECF', () => {
      const ecfCoordinates = Transforms.eci2ecf(item.eci, item.gmst);
      expect(ecfCoordinates.x).toBeCloseTo(item.ecf.x);
      expect(ecfCoordinates.y).toBeCloseTo(item.ecf.y);
      expect(ecfCoordinates.z).toBeCloseTo(item.ecf.z);
    });
  });

  validEcfToEci.forEach((item) => {
    it('convert valid ECF coordinates to ECI', () => {
      const eciCoordinates = Transforms.ecf2eci(item.ecf, item.gmst);
      expect(eciCoordinates.x).toBeCloseTo(item.eci.x);
      expect(eciCoordinates.y).toBeCloseTo(item.eci.y);
      expect(eciCoordinates.z).toBeCloseTo(item.eci.z);
    });
  });

  validEcfToLookangles.forEach((item) => {
    it('convert valid ECF coordinates to RAE', () => {
      const raeCoordinates = Transforms.ecf2rae(item.lla, item.satelliteEcf);
      expect(raeCoordinates.rng).toBeCloseTo(item.rae.rng);
      expect(raeCoordinates.az).toBeCloseTo(item.rae.az);
      expect(raeCoordinates.el).toBeCloseTo(item.rae.el);
    });
  });

  invalidLatitudes.forEach((item) => {
    it(`convert invalid latitude value (${item.radians} radians) to degrees`, () => {
      expect(() => Transforms.getDegLat(item.radians)).toThrowError(RangeError);
    });
    it(`convert invalid latitude value (${item.degrees} degrees) to radians`, () => {
      expect(() => Transforms.getRadLat(item.degrees)).toThrowError(RangeError);
    });
  });

  invalidLongitudes.forEach((item) => {
    it(`convert invalid longitude value (${item.radians} radians) to degrees`, () => {
      expect(() => Transforms.getDegLon(item.radians)).toThrowError(RangeError);
    });
    it(`convert invalid longitude value (${item.degrees} degrees) to radians`, () => {
      expect(() => Transforms.getRadLon(item.degrees)).toThrowError(RangeError);
    });
  });
});
