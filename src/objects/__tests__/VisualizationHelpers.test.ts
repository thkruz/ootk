import {
  Degrees,
  ecef2eci,
  GroundStation,
  History,
  Kilometers,
  OpticalSensor,
  Satellite,
  SensorType,
  TleLine1,
  TleLine2,
  ValidationError,
  VisualizationHelpers,
} from '../../main';

describe('VisualizationHelpers', () => {
  // ISS TLE for testing
  const tle1 = '1 25544U 98067A   22203.46960946  .00003068  00000+0  61583-4 0  9996' as TleLine1;
  const tle2 = '2 25544  51.6415 161.8339 0005168  35.9781  54.7009 15.50067047350657' as TleLine2;

  describe('historyToTimeSeries', () => {
    it('should correctly map entries with extractor', () => {
      const history = new History<{ value: number }>({ maxLength: 100 });
      const now = new Date('2022-07-22T11:16:14Z');

      history.add(now, { value: 10 });
      history.add(new Date(now.getTime() + 60000), { value: 20 });
      history.add(new Date(now.getTime() + 120000), { value: 30 });

      const timeSeries = VisualizationHelpers.historyToTimeSeries(
        history,
        (entry) => entry.data.value * 2,
      );

      expect(timeSeries.length).toBe(3);
      expect(timeSeries[0].value).toBe(20);
      expect(timeSeries[1].value).toBe(40);
      expect(timeSeries[2].value).toBe(60);
    });

    it('should preserve time ordering', () => {
      const history = new History<{ x: number }>({ maxLength: 100 });
      const dates = [
        new Date('2022-07-22T11:16:14Z'),
        new Date('2022-07-22T11:17:14Z'),
        new Date('2022-07-22T11:18:14Z'),
      ];

      dates.forEach((date, i) => history.add(date, { x: i }));

      const timeSeries = VisualizationHelpers.historyToTimeSeries(
        history,
        (entry) => entry.data.x,
      );

      expect(timeSeries[0].time).toEqual(dates[0]);
      expect(timeSeries[1].time).toEqual(dates[1]);
      expect(timeSeries[2].time).toEqual(dates[2]);
    });

    it('should work with empty history', () => {
      const history = new History<{ value: number }>({ maxLength: 100 });

      const timeSeries = VisualizationHelpers.historyToTimeSeries(
        history,
        (entry) => entry.data.value,
      );

      expect(timeSeries).toEqual([]);
    });

    it('should work with complex extractor functions', () => {
      const history = new History<{ x: number; y: number; z: number }>({ maxLength: 100 });

      history.add(new Date(), { x: 3, y: 4, z: 0 });

      const timeSeries = VisualizationHelpers.historyToTimeSeries(
        history,
        (entry) => Math.sqrt(entry.data.x ** 2 + entry.data.y ** 2 + entry.data.z ** 2),
      );

      expect(timeSeries[0].value).toBe(5); // 3-4-5 right triangle
    });
  });

  describe('generateOrbitTrack', () => {
    it('should return correct number of points', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');

      const track = VisualizationHelpers.generateOrbitTrack(sat, start, 1, 10);

      // Should have approximately 10 points per period
      expect(track.length).toBeGreaterThanOrEqual(9);
      expect(track.length).toBeLessThanOrEqual(11);
    });

    it('should have valid altitude values for LEO satellite', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');

      const track = VisualizationHelpers.generateOrbitTrack(sat, start, 1, 10);

      expect(track.length).toBeGreaterThan(0);

      // ISS altitude should be between 300-450 km
      track.forEach((point) => {
        expect(point.altitude).toBeGreaterThan(300);
        expect(point.altitude).toBeLessThan(450);
      });
    });

    it('should include position and velocity', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');

      const track = VisualizationHelpers.generateOrbitTrack(sat, start, 1, 10);

      expect(track.length).toBeGreaterThan(0);

      const point = track[0];

      expect(point.position).toBeDefined();
      expect(point.position.x).not.toBe(0);
      expect(point.position.y).toBeDefined();
      expect(point.position.z).toBeDefined();
      expect(point.velocity).toBeDefined();
      expect(point.velocity.x).not.toBe(0);
    });

    it('should return empty array for invalid periods', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');

      expect(VisualizationHelpers.generateOrbitTrack(sat, start, 0, 10)).toEqual([]);
      expect(VisualizationHelpers.generateOrbitTrack(sat, start, -1, 10)).toEqual([]);
    });

    it('should return empty array for invalid samples', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');

      expect(VisualizationHelpers.generateOrbitTrack(sat, start, 1, 0)).toEqual([]);
      expect(VisualizationHelpers.generateOrbitTrack(sat, start, 1, -1)).toEqual([]);
    });

    it('should generate multiple periods', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');

      const onePeriod = VisualizationHelpers.generateOrbitTrack(sat, start, 1, 10);
      const twoPeriods = VisualizationHelpers.generateOrbitTrack(sat, start, 2, 10);

      expect(twoPeriods.length).toBeGreaterThan(onePeriod.length);
      expect(twoPeriods.length).toBeGreaterThanOrEqual(onePeriod.length * 1.8);
    });
  });

  describe('generateGroundTrack', () => {
    it('should return correct number of points for time span', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');
      const end = new Date(start.getTime() + 10 * 60000); // 10 minutes
      const stepMs = 60000; // 1 minute

      const track = VisualizationHelpers.generateGroundTrack(sat, start, end, stepMs);

      // Should have 11 points (0, 1, 2, ..., 10 minutes inclusive)
      expect(track.length).toBe(11);
    });

    it('should have latitude in valid range', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');
      const end = new Date(start.getTime() + 60 * 60000); // 1 hour

      const track = VisualizationHelpers.generateGroundTrack(sat, start, end);

      track.forEach((point) => {
        expect(point.lat).toBeGreaterThanOrEqual(-90);
        expect(point.lat).toBeLessThanOrEqual(90);
      });
    });

    it('should have longitude in valid range', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');
      const end = new Date(start.getTime() + 60 * 60000); // 1 hour

      const track = VisualizationHelpers.generateGroundTrack(sat, start, end);

      track.forEach((point) => {
        expect(point.lon).toBeGreaterThanOrEqual(-180);
        expect(point.lon).toBeLessThanOrEqual(180);
      });
    });

    it('should return empty array for invalid time range', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');
      const end = new Date(start.getTime() - 60000); // End before start

      expect(VisualizationHelpers.generateGroundTrack(sat, start, end)).toEqual([]);
    });

    it('should return empty array for invalid step', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');
      const end = new Date(start.getTime() + 60000);

      expect(VisualizationHelpers.generateGroundTrack(sat, start, end, 0)).toEqual([]);
      expect(VisualizationHelpers.generateGroundTrack(sat, start, end, -1)).toEqual([]);
    });

    it('should have positive altitude', () => {
      const sat = new Satellite({ tle1, tle2 });
      const start = new Date('2022-07-22T11:16:14Z');
      const end = new Date(start.getTime() + 10 * 60000);

      const track = VisualizationHelpers.generateGroundTrack(sat, start, end);

      track.forEach((point) => {
        expect(point.alt).toBeGreaterThan(0);
      });
    });
  });

  describe('generateFOVBoundary', () => {
    // Create a ground station and sensor for testing
    const createTestSensor = () => {
      const gs = new GroundStation({
        id: 9005,
        name: 'Test Ground Station',
        lat: 40.0 as Degrees,
        lon: -75.0 as Degrees,
        alt: 0.1 as Kilometers,
      });

      const sensor = new OpticalSensor({
        id: 9006,
        name: 'Test Sensor',
        sensorType: SensorType.OPTICAL,
        fieldOfView: {
          boresightAz: 0 as Degrees,
          boresightEl: 45 as Degrees,
          halfAngle: 30 as Degrees,
          minRange: 100 as Kilometers,
          maxRange: 40000 as Kilometers,
        },
      });

      sensor.setParent(gs);

      return sensor;
    };

    it('should throw error if sensor has no parent', () => {
      const sensor = new OpticalSensor({
        id: 9007,
        name: 'Orphan Sensor',
        sensorType: SensorType.OPTICAL,
        fieldOfView: {
          boresightAz: 0 as Degrees,
          boresightEl: 45 as Degrees,
          halfAngle: 30 as Degrees,
          minRange: 100 as Kilometers,
          maxRange: 40000 as Kilometers,
        },
      });

      expect(() => VisualizationHelpers.generateFOVBoundary(sensor)).toThrow(ValidationError);
      expect(() => VisualizationHelpers.generateFOVBoundary(sensor)).toThrow(
        'Sensor must have a parent platform',
      );
    });

    it('should return correct number of samples', () => {
      const sensor = createTestSensor();
      const samples = 36;

      const boundary = VisualizationHelpers.generateFOVBoundary(sensor, samples);

      expect(boundary.length).toBe(samples);
    });

    it('should return empty array for invalid samples', () => {
      const sensor = createTestSensor();

      expect(VisualizationHelpers.generateFOVBoundary(sensor, 0)).toEqual([]);
      expect(VisualizationHelpers.generateFOVBoundary(sensor, -1)).toEqual([]);
    });

    it('should have valid ECEF coordinates', () => {
      const sensor = createTestSensor();

      const boundary = VisualizationHelpers.generateFOVBoundary(sensor, 36);

      boundary.forEach((point) => {
        expect(point.ecef).toBeDefined();
        expect(typeof point.ecef.x).toBe('number');
        expect(typeof point.ecef.y).toBe('number');
        expect(typeof point.ecef.z).toBe('number');
        // ECEF coordinates should be reasonable (not NaN or Infinity)
        expect(Number.isFinite(point.ecef.x)).toBe(true);
        expect(Number.isFinite(point.ecef.y)).toBe(true);
        expect(Number.isFinite(point.ecef.z)).toBe(true);
      });
    });

    it('should allow conversion to TEME with ecef2eci', () => {
      const sensor = createTestSensor();

      const boundary = VisualizationHelpers.generateFOVBoundary(sensor, 12);
      const gmst = 1.5; // Example GMST value

      // Convert each point to TEME
      const temePoints = boundary.map((pt) => ecef2eci(pt.ecef, gmst));

      temePoints.forEach((teme) => {
        expect(Number.isFinite(teme.x)).toBe(true);
        expect(Number.isFinite(teme.y)).toBe(true);
        expect(Number.isFinite(teme.z)).toBe(true);
      });
    });

    it('should have azimuth values in valid range', () => {
      const sensor = createTestSensor();

      const boundary = VisualizationHelpers.generateFOVBoundary(sensor, 36);

      boundary.forEach((point) => {
        expect(point.az).toBeGreaterThanOrEqual(0);
        expect(point.az).toBeLessThan(360);
      });
    });

    it('should have elevation values in valid range', () => {
      const sensor = createTestSensor();

      const boundary = VisualizationHelpers.generateFOVBoundary(sensor, 36);

      boundary.forEach((point) => {
        expect(point.el).toBeGreaterThanOrEqual(-90);
        expect(point.el).toBeLessThanOrEqual(90);
      });
    });

    it('should work with zenith-pointed sensor', () => {
      const gs = new GroundStation({
        id: 9001,
        name: 'Test Ground Station',
        lat: 40.0 as Degrees,
        lon: -75.0 as Degrees,
        alt: 0.1 as Kilometers,
      });

      const sensor = new OpticalSensor({
        id: 9002,
        name: 'Zenith Sensor',
        sensorType: SensorType.OPTICAL,
        fieldOfView: {
          boresightAz: 0 as Degrees,
          boresightEl: 90 as Degrees, // Pointing straight up
          halfAngle: 45 as Degrees,
          minRange: 100 as Kilometers,
          maxRange: 40000 as Kilometers,
        },
      });

      sensor.setParent(gs);

      const boundary = VisualizationHelpers.generateFOVBoundary(sensor, 36);

      expect(boundary.length).toBe(36);
      // All elevations should be near 45 degrees for zenith-pointed 45-deg half-angle
      boundary.forEach((point) => {
        expect(point.el).toBeGreaterThan(40);
        expect(point.el).toBeLessThanOrEqual(90);
      });
    });

    it('should work with elliptical FOV', () => {
      const gs = new GroundStation({
        id: 9003,
        name: 'Test Ground Station',
        lat: 40.0 as Degrees,
        lon: -75.0 as Degrees,
        alt: 0.1 as Kilometers,
      });

      const sensor = new OpticalSensor({
        id: 9004,
        name: 'Elliptical Sensor',
        sensorType: SensorType.OPTICAL,
        fieldOfView: {
          boresightAz: 0 as Degrees,
          boresightEl: 45 as Degrees,
          halfAngle: 60 as Degrees, // Major axis
          minorHalfAngle: 20 as Degrees, // Minor axis
          minRange: 100 as Kilometers,
          maxRange: 40000 as Kilometers,
        },
      });

      sensor.setParent(gs);

      const boundary = VisualizationHelpers.generateFOVBoundary(sensor, 72);

      expect(boundary.length).toBe(72);
      boundary.forEach((point) => {
        expect(Number.isFinite(point.ecef.x)).toBe(true);
        expect(Number.isFinite(point.ecef.y)).toBe(true);
        expect(Number.isFinite(point.ecef.z)).toBe(true);
      });
    });

    it('should use custom range when provided', () => {
      const sensor = createTestSensor();
      const customRange = 20000 as Kilometers;

      const boundary = VisualizationHelpers.generateFOVBoundary(sensor, 12, customRange);

      boundary.forEach((point) => {
        expect(point.range).toBe(customRange);
      });
    });

    it('should use maxRange by default', () => {
      const sensor = createTestSensor();

      const boundary = VisualizationHelpers.generateFOVBoundary(sensor, 12);

      boundary.forEach((point) => {
        expect(point.range).toBe(40000); // maxRange from sensor FOV
      });
    });
  });
});
