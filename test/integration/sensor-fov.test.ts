/**
 * Integration test: Sensor field of view calculations
 * Migrated from examples/sensor.ts and examples/satellite-passes.ts
 */
import {
  calcGmst,
  Degrees,
  ecef2eci,
  ecef2rae,
  eci2lla,
  eci2rae,
  GroundStation,
  Kilometers,
  PhasedArrayRadar,
  Satellite,
  SensorType,
  TleLine1,
  TleLine2,
} from '../../dist/main.js';
import { ISS_TLE } from './lib/testData';

describe('Sensor and Field of View', () => {
  describe('Basic GroundStation Creation', () => {
    it('should create a ground station with minimal parameters', () => {
      const station = new GroundStation({
        lat: 41 as Degrees,
        lon: -71 as Degrees,
        alt: 1 as Kilometers,
      });

      expect(station).toBeDefined();
      expect(station.lat).toBe(41);
      expect(station.lon).toBe(-71);
    });

    it('should create a ground station with full parameters', () => {
      const station = new GroundStation({
        lat: 41.754785 as Degrees,
        lon: -70.539151 as Degrees,
        alt: 0.060966 as Kilometers,
        name: 'Cape Cod',
      });

      expect(station.name).toBe('Cape Cod');
      expect(station.lat).toBeCloseTo(41.754785);
    });
  });

  describe('Coordinate Transformations via GroundStation', () => {
    const testStation = new GroundStation({
      lat: 41 as Degrees,
      lon: -71 as Degrees,
      alt: 1 as Kilometers,
    });

    const date = new Date('2023-12-31T20:51:19.934Z');
    const ecef = {
      x: 4000 as Kilometers,
      y: 7000 as Kilometers,
      z: 3000 as Kilometers,
    };

    it('should convert ECEF to RAE', () => {
      const rae = ecef2rae(testStation.lla(), ecef);

      expect(rae).toBeDefined();
      expect(rae.az).toBeDefined();
      expect(rae.el).toBeDefined();
      expect(rae.rng).toBeDefined();
      expect(rae.rng).toBeGreaterThan(0);
    });

    it('should convert ECI to RAE', () => {
      const { gmst } = calcGmst(date);
      const eci = ecef2eci(ecef, gmst);
      const rae = eci2rae(date, eci, testStation);

      expect(rae).toBeDefined();
      expect(rae.az).toBeGreaterThanOrEqual(0);
      expect(rae.az).toBeLessThanOrEqual(360);
    });

    it('should convert ECI to LLA', () => {
      const { gmst } = calcGmst(date);
      const eci = ecef2eci(ecef, gmst);
      const lla = eci2lla(eci, gmst);

      expect(lla).toBeDefined();
      expect(lla.lat).toBeGreaterThanOrEqual(-90);
      expect(lla.lat).toBeLessThanOrEqual(90);
    });
  });

  describe('Satellite Observation', () => {
    const testStation = new GroundStation({
      lat: 41 as Degrees,
      lon: -71 as Degrees,
      alt: 1 as Kilometers,
    });

    const sat = new Satellite({
      tle1: ISS_TLE.line1 as TleLine1,
      tle2: ISS_TLE.line2 as TleLine2,
    });

    const date = new Date('2023-12-31T20:51:19.934Z');

    it('should calculate RAE from satellite', () => {
      const rae = sat.rae(testStation, date);

      expect(rae).toBeDefined();
      expect(rae!.az).toBeGreaterThanOrEqual(0);
      expect(rae!.az).toBeLessThanOrEqual(360);
      expect(rae!.rng).toBeGreaterThan(0);
    });

    it('should convert satellite position to geodetic', () => {
      const j2000 = sat.toJ2000(date);
      const geodetic = j2000.toITRF().toGeodetic();

      expect(geodetic).toBeDefined();
      expect(geodetic.lat).toBeGreaterThanOrEqual(-90);
      expect(geodetic.lat).toBeLessThanOrEqual(90);
    });
  });

  describe('GroundStation and PhasedArrayRadar', () => {
    const groundStation = new GroundStation({
      lat: 41.754785 as Degrees,
      lon: -70.539151 as Degrees,
      alt: 0.060966 as Kilometers,
      name: 'Cape Cod',
    });

    const iss = new Satellite({
      tle1: ISS_TLE.line1 as TleLine1,
      tle2: ISS_TLE.line2 as TleLine2,
    });

    const checkTime = new Date('2024-01-28T12:00:00.000Z');

    it('should create a ground station', () => {
      expect(groundStation).toBeDefined();
      expect(groundStation.name).toBe('Cape Cod');
    });

    it('should create a phased array radar', () => {
      const radar = new PhasedArrayRadar({
        id: 'cape-cod-radar',
        name: 'Cape Cod Radar',
        sensorType: SensorType.PHASED_ARRAY_RADAR,
        beamwidth: 2 as Degrees,
        boresightAz: [0 as Degrees],
        boresightEl: [45 as Degrees],
        fieldOfView: {
          minRange: 100 as Kilometers,
          maxRange: 5556 as Kilometers,
          minAzimuth: 0 as Degrees,
          maxAzimuth: 360 as Degrees,
          minElevation: 10 as Degrees,
          maxElevation: 85 as Degrees,
        },
      });

      expect(radar).toBeDefined();
      expect(radar.name).toBe('Cape Cod Radar');
      expect(radar.fieldOfView.minElevation).toBe(10);
      expect(radar.fieldOfView.maxRange).toBe(5556);
    });

    it('should calculate satellite RAE from ground station', () => {
      const rae = iss.rae(groundStation, checkTime);

      expect(rae).toBeDefined();
      expect(rae!.az).toBeGreaterThanOrEqual(0);
      expect(rae!.az).toBeLessThanOrEqual(360);
    });

    it('should check if satellite can be observed', () => {
      const radar = new PhasedArrayRadar({
        id: 'cape-cod-radar',
        name: 'Cape Cod Radar',
        sensorType: SensorType.PHASED_ARRAY_RADAR,
        beamwidth: 2 as Degrees,
        boresightAz: [0 as Degrees],
        boresightEl: [45 as Degrees],
        fieldOfView: {
          minRange: 100 as Kilometers,
          maxRange: 5556 as Kilometers,
          minAzimuth: 0 as Degrees,
          maxAzimuth: 360 as Degrees,
          minElevation: 10 as Degrees,
          maxElevation: 85 as Degrees,
        },
      });

      groundStation.addSensor(radar);
      radar.setParent(groundStation);

      const canObserve = radar.canObserve(iss, checkTime);

      // Result depends on satellite position at the time
      expect(typeof canObserve).toBe('boolean');
    });

    it('should get RAE from radar', () => {
      const radar = new PhasedArrayRadar({
        id: 'cape-cod-radar',
        name: 'Cape Cod Radar',
        sensorType: SensorType.PHASED_ARRAY_RADAR,
        beamwidth: 2 as Degrees,
        boresightAz: [0 as Degrees],
        boresightEl: [45 as Degrees],
        fieldOfView: {
          minRange: 100 as Kilometers,
          maxRange: 5556 as Kilometers,
          minAzimuth: 0 as Degrees,
          maxAzimuth: 360 as Degrees,
          minElevation: 10 as Degrees,
          maxElevation: 85 as Degrees,
        },
      });

      groundStation.addSensor(radar);
      radar.setParent(groundStation);

      const raeCheck = radar.getRae(iss, checkTime);

      expect(raeCheck).toBeDefined();
    });
  });

  describe('Satellite Tracking Over Time', () => {
    const groundStation = new GroundStation({
      lat: 41.754785 as Degrees,
      lon: -70.539151 as Degrees,
      alt: 0.060966 as Kilometers,
      name: 'Cape Cod',
    });

    const iss = new Satellite({
      tle1: ISS_TLE.line1 as TleLine1,
      tle2: ISS_TLE.line2 as TleLine2,
    });

    const trackStart = new Date('2024-01-28T12:00:00.000Z');

    it('should track satellite position over time', () => {
      const positions: { az: number; el: number; rng: number }[] = [];

      for (let i = 0; i < 12; i++) {
        const trackTime = new Date(trackStart.getTime() + i * 5 * 60 * 1000);
        const trackRae = iss.rae(groundStation, trackTime);

        if (trackRae) {
          positions.push({
            az: trackRae.az,
            el: trackRae.el,
            rng: trackRae.rng,
          });
        }
      }

      expect(positions.length).toBe(12);

      // All azimuths should be valid
      positions.forEach((pos) => {
        expect(pos.az).toBeGreaterThanOrEqual(0);
        expect(pos.az).toBeLessThanOrEqual(360);
        expect(pos.rng).toBeGreaterThan(0);
      });
    });
  });

  describe('Multiple Satellites', () => {
    const groundStation = new GroundStation({
      lat: 41.754785 as Degrees,
      lon: -70.539151 as Degrees,
      alt: 0.060966 as Kilometers,
      name: 'Cape Cod',
    });

    const satellites = [
      {
        name: 'ISS',
        sat: new Satellite({
          tle1: '1 25544U 98067A   24028.54545847  .00031576  00000-0  57240-3 0  9991' as TleLine1,
          tle2: '2 25544  51.6418 292.2590 0002595 167.5319 252.0460 15.49326324436741' as TleLine2,
        }),
      },
      {
        name: 'HST',
        sat: new Satellite({
          tle1: '1 20580U 90037B   24028.50123227  .00000825  00000-0  39644-4 0  9997' as TleLine1,
          tle2: '2 20580  28.4696 273.2640 0002975 297.7865 189.2151 15.09696656316758' as TleLine2,
        }),
      },
    ];

    const checkTime = new Date('2024-01-28T18:00:00.000Z');

    it('should track multiple satellites', () => {
      satellites.forEach((satInfo) => {
        const rae = satInfo.sat.rae(groundStation, checkTime);

        expect(rae).toBeDefined();
        expect(rae!.az).toBeGreaterThanOrEqual(0);
        expect(rae!.az).toBeLessThanOrEqual(360);
      });
    });

    it('should have different positions for different satellites', () => {
      const rae1 = satellites[0].sat.rae(groundStation, checkTime);
      const rae2 = satellites[1].sat.rae(groundStation, checkTime);

      // Different satellites should have different positions
      expect(rae1!.az).not.toBe(rae2!.az);
    });
  });
});
