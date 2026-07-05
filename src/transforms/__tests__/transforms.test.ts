import {
  DEG2RAD, Degrees, Kilometers, PhasedArrayRadar, Radians, SensorType,
  ValidationError, azel2uv, calcIncFromAz, calcInertAz, rae2raeOffBoresight, uv2azel,
} from '../../main';

// uv2azel
it('should convert valid unit vector to azimuth and elevation', () => {
  const u = 0 as Radians;
  const v = 0 as Radians;

  const azelCoordinates = uv2azel(u, v, (5 * DEG2RAD) as Radians);

  expect(azelCoordinates.az).toMatchSnapshot();
  expect(azelCoordinates.el).toMatchSnapshot();
});

// rae2raeOffBoresight
it('should convert valid RAE coordinates to RAE Off Boresight', () => {
  const rae = {
    rng: 0 as Kilometers,
    az: 0 as Degrees,
    el: 0 as Degrees,
  };

  const sensor = new PhasedArrayRadar({
    id: 4001,
    name: 'Test Radar',
    sensorType: SensorType.PHASED_ARRAY_RADAR,
    boresightAz: [0 as Degrees],
    boresightEl: [0 as Degrees],
    beamwidth: 1 as Degrees,
    fieldOfView: {
      halfAngle: 60 as Degrees,
      minRange: 100 as Kilometers,
      maxRange: 40000 as Kilometers,
    },
  });

  const raeOffBoresightCoordinates = rae2raeOffBoresight(rae, sensor, 0, 10 as Degrees);

  expect(raeOffBoresightCoordinates).toMatchSnapshot();
});


// rae2ruv
// it('should convert valid RAE coordinates to RUV', () => {
//   const rae = {
//     rng: 0 as Kilometers,
//     az: 0 as Degrees,
//     el: 0 as Degrees,
//   };
//   const ruvCoordinates = rae2ruv(rae, 0 as Degrees, 0 as Degrees, 0 as Degrees);
//   expect(ruvCoordinates).toMatchSnapshot();
// });

// azel2uv
it('should convert valid azimuth and elevation to unit vector', () => {
  const az = 0 as Radians;
  const el = 0 as Radians;

  const uvCoordinates = azel2uv(az, el, (5 * DEG2RAD) as Radians);

  expect(uvCoordinates.u).toMatchSnapshot();
  expect(uvCoordinates.v).toMatchSnapshot();
});

// calcInertAz
it('should calculate the correct inertial azimuth for given latitude and inclination', () => {
  const lat = 30 as Degrees; // Example latitude
  const inc = 45 as Degrees; // Example inclination

  const result = calcInertAz(lat, inc);
  const azimuthExpectedValue = 54.735610317245346;

  expect(result).toBeCloseTo(azimuthExpectedValue, 5); // Replace azimuthExpectedValue with the expected result
});

it('should handle edge case where latitude is 0', () => {
  const lat = 0 as Degrees; // Equator
  const inc = 45 as Degrees; // Example inclination

  const result = calcInertAz(lat, inc);
  const azimuthExpectedValue = 45.00000;


  expect(result).toBeCloseTo(azimuthExpectedValue, 5); // Replace azimuthExpectedValue with the expected result
});

it('should throw RangeError when inclination is less than latitude', () => {
  const lat = 30 as Degrees; // Example latitude
  const inc = 0 as Degrees; // Example inclination

  const func = () => calcInertAz(lat, inc);

  expect(func).toThrow(ValidationError);
});

// calcIncFromAz
it('should calculate the correct inclination for given latitude and azimuth', () => {
  const lat = 30 as Degrees; // Example latitude
  const az = 60 as Degrees; // Example azimuth

  const result = calcIncFromAz(lat, az);
  const expectedInclination = 41.40962210927086; // Replace with the expected result

  expect(result).toBeCloseTo(expectedInclination, 5);
});

it('should handle edge case where latitude is 0', () => {
  const lat = 0 as Degrees; // Equator
  const az = 45 as Degrees; // Example azimuth

  const result = calcIncFromAz(lat, az);
  const expectedInclination = 45.00000000000001; // Replace with the expected result

  expect(result).toBeCloseTo(expectedInclination, 5);
});

it('should throw RangeError when azimuth is out of bounds', () => {
  const lat = 30 as Degrees; // Example latitude
  const az = 400 as Degrees; // Invalid azimuth

  const func = () => calcIncFromAz(lat, az);

  expect(func).toThrow(ValidationError);
});


