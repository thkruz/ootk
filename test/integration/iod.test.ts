/**
 * Integration test: Initial Orbit Determination
 * Migrated from examples/iod.ts
 */
import {
  DEG2RAD,
  Degrees,
  EpochUTC,
  GibbsIOD,
  HerrickGibbsIOD,
  J2000,
  Kilometers,
  KilometersPerSecond,
  LambertIOD,
  RAE,
  Radians,
  Tle,
  Vector3D,
  calcGmst,
  lla2eci,
} from '../../dist/main.js';

describe('Initial Orbit Determination', () => {
  // Test data setup
  const rae1 = {
    t: EpochUTC.fromDateTime(new Date(1704628462000)),
    rng: 1599.89 as Kilometers,
    az: 174 as Degrees,
    el: 13.6 as Degrees,
  };
  const rae2 = {
    t: EpochUTC.fromDateTime(new Date(1704628462000 + 10 * 1000)),
    rng: 1568.76 as Kilometers,
    az: 171 as Degrees,
    el: 14.2 as Degrees,
  };
  const rae3 = {
    t: EpochUTC.fromDateTime(new Date(1704628462000 + 20 * 1000)),
    rng: 1540.09 as Kilometers,
    az: 169 as Degrees,
    el: 14.7 as Degrees,
  };

  const sensor = {
    lat: (41.754785 * DEG2RAD) as Radians,
    lon: (-70.539151 * DEG2RAD) as Radians,
    alt: 0.085 as Kilometers,
  };

  describe('Lambert IOD', () => {
    it('should estimate orbit from two position observations', () => {
      const gmst = calcGmst(rae1.t.toDateTime());
      const sensorEci = lla2eci(sensor, gmst.gmst);

      const p1 = RAE.fromDegrees(rae1.t, rae1.rng, rae1.az, rae1.el).toStateVector(
        new J2000(
          rae1.t,
          new Vector3D(sensorEci.x, sensorEci.y, sensorEci.z),
          Vector3D.origin as Vector3D<KilometersPerSecond>,
        ),
      );
      const p2 = RAE.fromDegrees(rae2.t, rae2.rng, rae2.az, rae2.el).toStateVector(
        new J2000(
          rae2.t,
          new Vector3D(sensorEci.x, sensorEci.y, sensorEci.z),
          Vector3D.origin as Vector3D<KilometersPerSecond>,
        ),
      );

      const lambert = new LambertIOD();
      const estimate = lambert.estimate(p1.position, p2.position, p1.epoch, p2.epoch);

      expect(estimate).toBeDefined();
      expect(estimate.position).toBeDefined();
      expect(estimate.velocity).toBeDefined();

      // The estimated orbit should have reasonable values
      const elements = estimate.toClassicalElements();

      expect(elements.semimajorAxis).toBeGreaterThan(6378); // Above Earth surface
      expect(elements.eccentricity).toBeGreaterThanOrEqual(0);
      expect(elements.eccentricity).toBeLessThan(1);
    });

    it('should convert Lambert estimate to TLE', () => {
      const gmst = calcGmst(rae1.t.toDateTime());
      const sensorEci = lla2eci(sensor, gmst.gmst);

      const p1 = RAE.fromDegrees(rae1.t, rae1.rng, rae1.az, rae1.el).toStateVector(
        new J2000(
          rae1.t,
          new Vector3D(sensorEci.x, sensorEci.y, sensorEci.z),
          Vector3D.origin as Vector3D<KilometersPerSecond>,
        ),
      );
      const p2 = RAE.fromDegrees(rae2.t, rae2.rng, rae2.az, rae2.el).toStateVector(
        new J2000(
          rae2.t,
          new Vector3D(sensorEci.x, sensorEci.y, sensorEci.z),
          Vector3D.origin as Vector3D<KilometersPerSecond>,
        ),
      );

      const lambert = new LambertIOD();
      const estimate = lambert.estimate(p1.position, p2.position, p1.epoch, p2.epoch);
      const tle = Tle.fromClassicalElements(estimate.toClassicalElements());

      expect(tle).toBeDefined();
      expect(tle.line1).toBeDefined();
      expect(tle.line2).toBeDefined();
      expect(tle.line1.length).toBe(69);
      expect(tle.line2.length).toBe(69);
    });
  });

  describe('Herrick-Gibbs IOD', () => {
    it('should solve orbit from three position observations', () => {
      const gmst = calcGmst(rae1.t.toDateTime());
      const sensorEci = lla2eci(sensor, gmst.gmst);

      const p1 = RAE.fromDegrees(rae1.t, rae1.rng, rae1.az, rae1.el).toStateVector(
        new J2000(
          rae1.t,
          new Vector3D(sensorEci.x, sensorEci.y, sensorEci.z),
          Vector3D.origin as Vector3D<KilometersPerSecond>,
        ),
      );
      const p2 = RAE.fromDegrees(rae2.t, rae2.rng, rae2.az, rae2.el).toStateVector(
        new J2000(
          rae2.t,
          new Vector3D(sensorEci.x, sensorEci.y, sensorEci.z),
          Vector3D.origin as Vector3D<KilometersPerSecond>,
        ),
      );
      const p3 = RAE.fromDegrees(rae3.t, rae3.rng, rae3.az, rae3.el).toStateVector(
        new J2000(
          rae3.t,
          new Vector3D(sensorEci.x, sensorEci.y, sensorEci.z),
          Vector3D.origin as Vector3D<KilometersPerSecond>,
        ),
      );

      const herrickGibbs = new HerrickGibbsIOD();
      const estimate = herrickGibbs.solve(
        p1.position,
        p1.epoch,
        p2.position,
        p2.epoch,
        p3.position,
        p3.epoch,
      );

      expect(estimate).toBeDefined();
      expect(estimate.position).toBeDefined();
      expect(estimate.velocity).toBeDefined();
    });
  });

  describe('Gibbs IOD', () => {
    it('should solve orbit from three ECI positions', () => {
      // Use direct ECI positions for Gibbs method
      const eci1 = {
        x: -4901.84521484375 as Kilometers,
        y: -3592.527587890625 as Kilometers,
        z: 3322.875732421875 as Kilometers,
      };
      const eci2 = {
        x: -4847.90185546875 as Kilometers,
        y: -3631.424560546875 as Kilometers,
        z: 3359.44482421875 as Kilometers,
      };
      const eci3 = {
        x: -4793.376953125 as Kilometers,
        y: -3669.885986328125 as Kilometers,
        z: 3395.60986328125 as Kilometers,
      };

      const p1 = new J2000(
        rae1.t,
        new Vector3D(eci1.x, eci1.y, eci1.z),
        Vector3D.origin as Vector3D<KilometersPerSecond>,
      );
      const p2 = new J2000(
        rae2.t,
        new Vector3D(eci2.x, eci2.y, eci2.z),
        Vector3D.origin as Vector3D<KilometersPerSecond>,
      );
      const p3 = new J2000(
        rae3.t,
        new Vector3D(eci3.x, eci3.y, eci3.z),
        Vector3D.origin as Vector3D<KilometersPerSecond>,
      );

      const gibbs = new GibbsIOD();
      const estimate = gibbs.solve(p1.position, p2.position, p3.position, p2.epoch, p3.epoch);

      expect(estimate).toBeDefined();
      expect(estimate.position).toBeDefined();
      expect(estimate.velocity).toBeDefined();

      // Convert to TLE to verify validity
      const tle = Tle.fromClassicalElements(estimate.toClassicalElements());

      expect(tle.line1).toBeDefined();
      expect(tle.line2).toBeDefined();
    });

    it('should work with spaced observations', () => {
      const eci1 = {
        x: -4901.84521484375 as Kilometers,
        y: -3592.527587890625 as Kilometers,
        z: 3322.875732421875 as Kilometers,
      };
      const eci4 = {
        x: -4738.27734375 as Kilometers,
        y: -3707.9072265625 as Kilometers,
        z: 3431.36669921875 as Kilometers,
      };
      const eci5 = {
        x: -4569.595703125 as Kilometers,
        y: -3819.285400390625 as Kilometers,
        z: 3536.144287109375 as Kilometers,
      };

      const p1 = new J2000(
        rae1.t,
        new Vector3D(eci1.x, eci1.y, eci1.z),
        Vector3D.origin as Vector3D<KilometersPerSecond>,
      );
      const p4 = new J2000(
        EpochUTC.fromDateTime(new Date(1704628492000)),
        new Vector3D(eci4.x, eci4.y, eci4.z),
        Vector3D.origin as Vector3D<KilometersPerSecond>,
      );
      const p5 = new J2000(
        EpochUTC.fromDateTime(new Date(1704628522000)),
        new Vector3D(eci5.x, eci5.y, eci5.z),
        Vector3D.origin as Vector3D<KilometersPerSecond>,
      );

      const herrickGibbs = new HerrickGibbsIOD();
      const estimate = herrickGibbs.solve(
        p1.position,
        p1.epoch,
        p4.position,
        p4.epoch,
        p5.position,
        p5.epoch,
      );

      const tle = Tle.fromClassicalElements(estimate.toClassicalElements());

      expect(tle.line1).toBeDefined();
      expect(tle.line2).toBeDefined();
    });
  });
});
