import { DEG2RAD, Degrees, Kilometers, Radians, RfSensor, SpaceObjectType, azel2uv, rae2raeOffBoresight, uv2azel } from '../../src/main.js';

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

  const senor = new RfSensor({
    type: SpaceObjectType.PHASED_ARRAY_RADAR,
    lat: 0 as Degrees,
    lon: 0 as Degrees,
    alt: 0 as Kilometers,
    minAz: 0 as Degrees,
    maxAz: 0 as Degrees,
    minEl: 0 as Degrees,
    maxEl: 0 as Degrees,
    minRng: 0 as Kilometers,
    maxRng: 0 as Kilometers,
    boresightAz: [0 as Degrees],
    boresightEl: [0 as Degrees],
    beamwidth: 0 as Degrees,
  });

  const raeOffBoresightCoordinates = rae2raeOffBoresight(rae, senor, 0, 10 as Degrees);

  expect(raeOffBoresightCoordinates).toMatchSnapshot();
});

// eslint-disable-next-line multiline-comment-style
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
