import {
  calcGmst,
  Degrees,
  ecef2eci,
  ecef2enu,
  ecef2rae,
  eci2ecef,
  eci2lla,
  eci2rae,
  getDegLat,
  getDegLon,
  getRadLat,
  getRadLon,
  Kilometers,
  lla2ecef,
  lla2eci,
  Radians,
  rae2ecef,
  rae2eci,
  rae2enu,
  rae2sez,
  ValidationError,
  Vec3,
} from '../../main';
import { GroundStation } from '../../objects/GroundStation';
import { transformsData } from './transformsData';

const numDigits = 6;

describe('Latitude & longitude conversions', () => {
  const {
    validLatitudes,
    validLongitudes,
    validGeodeticToEcef,
    validEciToGeodetic,
    validEciToEcef,
    validEcefToEci,
    validEcefToLookangles,
    invalidLatitudes,
    invalidLongitudes,
  } = transformsData;

  validLatitudes.forEach((item) => {
    it(`convert valid latitude value (${item.radians} radians) to degrees`, () => {
      expect(getDegLat(item.radians)).toBeCloseTo(item.degrees, numDigits);
    });
    it(`convert valid latitude value (${item.degrees} degrees) to radians`, () => {
      expect(getRadLat(item.degrees)).toBeCloseTo(item.radians, numDigits);
    });
  });

  validLongitudes.forEach((item) => {
    it(`convert valid longitude value (${item.radians} radians) to degrees`, () => {
      expect(getDegLon(item.radians)).toBeCloseTo(item.degrees, numDigits);
    });
    it(`convert valid longitude value (${item.degrees} degrees) to radians`, () => {
      expect(getRadLon(item.degrees)).toBeCloseTo(item.radians, numDigits);
    });
  });

  validGeodeticToEcef.forEach((item) => {
    it('convert valid LLA coordinates to ECEF', () => {
      const ecefCoordinates = lla2ecef(item.lla);

      expect(ecefCoordinates.x).toBeCloseTo(item.ecef.x);
      expect(ecefCoordinates.y).toBeCloseTo(item.ecef.y);
      expect(ecefCoordinates.z).toBeCloseTo(item.ecef.z);
    });
  });

  validEciToGeodetic.forEach((item) => {
    it('convert valid ECI coordinates to LLA', () => {
      const llaCoordinates = eci2lla(item.eci, item.gmst);

      expect(llaCoordinates.lon).toBeCloseTo(item.lla.lon);
      expect(llaCoordinates.lat).toBeCloseTo(item.lla.lat);
      expect(llaCoordinates.alt).toBeCloseTo(item.lla.alt);
    });
  });

  validEciToEcef.forEach((item) => {
    it('convert valid ECI coordinates to ECEF', () => {
      const ecefCoordinates = eci2ecef(item.eci, item.gmst);

      expect(ecefCoordinates.x).toBeCloseTo(item.ecef.x);
      expect(ecefCoordinates.y).toBeCloseTo(item.ecef.y);
      expect(ecefCoordinates.z).toBeCloseTo(item.ecef.z);
    });
  });

  validEcefToEci.forEach((item) => {
    it('convert valid ECEF coordinates to ECI', () => {
      const eciCoordinates = ecef2eci(item.ecef, item.gmst);

      expect(eciCoordinates.x).toBeCloseTo(item.eci.x);
      expect(eciCoordinates.y).toBeCloseTo(item.eci.y);
      expect(eciCoordinates.z).toBeCloseTo(item.eci.z);
    });
  });

  validEcefToLookangles.forEach((item) => {
    it('convert valid ECEF coordinates to RAE', () => {
      const raeCoordinates = ecef2rae(item.lla, item.satelliteEcef);

      expect(raeCoordinates.rng).toBeCloseTo(item.rae.rng, 0);
      expect(raeCoordinates.az).toBeCloseTo(item.rae.az, 1);
      expect(raeCoordinates.el).toBeCloseTo(item.rae.el, 1);
    });
  });

  invalidLatitudes.forEach((item) => {
    it(`convert invalid latitude value (${item.radians} radians) to degrees`, () => {
      expect(() => getDegLat(item.radians)).toThrow(ValidationError);
    });
    it(`convert invalid latitude value (${item.degrees} degrees) to radians`, () => {
      expect(() => getRadLat(item.degrees)).toThrow(ValidationError);
    });
  });

  invalidLongitudes.forEach((item) => {
    it(`convert invalid longitude value (${item.radians} radians) to degrees`, () => {
      expect(() => getDegLon(item.radians)).toThrow(ValidationError);
    });
    it(`convert invalid longitude value (${item.degrees} degrees) to radians`, () => {
      expect(() => getRadLon(item.degrees)).toThrow(ValidationError);
    });
  });
});

describe('Rae2Sez', () => {
  it('should convert valid RAE coordinates to SEZ', () => {
    const { rae, sez } = transformsData.validRae2Sez[0] as {
      rae: {
        rng: Kilometers;
        az: Radians;
        el: Radians;
      }
      sez: {
        s: number;
        e: number;
        z: number;
      };
    };

    const sezCoordinates = rae2sez(rae);

    expect(sezCoordinates.s).toBeCloseTo(sez.s);
    expect(sezCoordinates.e).toBeCloseTo(sez.e);
    expect(sezCoordinates.z).toBeCloseTo(sez.z);
  });
});

describe('Rae2Ecef', () => {
  it('should convert valid RAE coordinates to ECEF', () => {
    // const { rae, ecef, lla } = transformData.validRae2Ecef[0];
    const ecef = {
      x: 4000,
      y: 4000,
      z: 4000,
    };
    const lla = {
      lon: 0 as Degrees,
      lat: 0 as Degrees,
      alt: 0 as Kilometers,
    };
    const rae = ecef2rae(lla, ecef);

    const ecefCoordinates = rae2ecef(rae, lla);

    expect(ecefCoordinates.x).toBeCloseTo(ecef.x);
    expect(ecefCoordinates.y).toBeCloseTo(ecef.y);
    expect(ecefCoordinates.z).toBeCloseTo(ecef.z);
  });

  // ecef2enu
  it('should convert valid ECEF coordinates to ENU', () => {
    const ecef = {
      x: 4000,
      y: 4000,
      z: 4000,
    };
    const lla = {
      lon: 0 as Degrees,
      lat: 0 as Degrees,
      alt: 0 as Kilometers,
    };

    const enuCoordinates = ecef2enu(ecef, lla);

    expect(enuCoordinates).toMatchSnapshot();
  });

  // enu2rf
  it('should convert valid ENU coordinates to RF', () => {
    const ecef = {
      x: 4000,
      y: 4000,
      z: 4000,
    };
    const lla = {
      lon: 0 as Degrees,
      lat: 0 as Degrees,
      alt: 0 as Kilometers,
    };

    const enuCoordinates = ecef2enu(ecef, lla);

    expect(enuCoordinates).toMatchSnapshot();
  });

  // lla2eci
  it('should convert valid LLA coordinates to ECI', () => {
    const lla = {
      lon: 0 as Radians,
      lat: 0 as Radians,
      alt: 0 as Kilometers,
    };
    const exampleDate = new Date(1705109326817);
    const { gmst } = calcGmst(exampleDate);
    const eciCoordinates = lla2eci(lla, gmst);

    expect(eciCoordinates).toMatchSnapshot();
  });

  // rae2eci
  it('should convert valid RAE coordinates to ECI', () => {
    const rae = {
      rng: 0 as Kilometers,
      az: 0 as Degrees,
      el: 0 as Degrees,
    };
    const station = new GroundStation({
      lat: 0 as Degrees,
      lon: 0 as Degrees,
      alt: 0 as Kilometers,
    });
    const exampleDate = new Date(1705109326817);
    const { gmst } = calcGmst(exampleDate);

    const eciCoordinates = rae2eci(rae, station, gmst);

    expect(eciCoordinates).toMatchSnapshot();
  });

  // rae2enu
  it('should convert valid RAE coordinates to ENU', () => {
    const rae = {
      rng: 0 as Kilometers,
      az: 0 as Degrees,
      el: 0 as Degrees,
    };
    const enuCoordinates = rae2enu(rae);

    expect(enuCoordinates).toMatchSnapshot();
  });

  // eci2rae
  it('should convert valid ECI coordinates to RAE', () => {
    const eci = {
      x: 4000,
      y: 4000,
      z: 4000,
    } as Vec3<Kilometers>;
    const station = new GroundStation({
      lat: 0 as Degrees,
      lon: 0 as Degrees,
      alt: 0 as Kilometers,
    });

    const exampleDate = new Date(1705109326817);
    const raeCoordinates = eci2rae(exampleDate, eci, station);

    expect(raeCoordinates).toMatchSnapshot();
  });
});
