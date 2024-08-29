import { DEG2RAD, Degrees, Kilometers, Radians, azel2uv, rae2raeOffBoresight, uv2azel } from '../../src/main.js';

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

  const orientation = {
    azimuth: 0 as Degrees,
    elevation: 0 as Degrees,
  };
  const raeOffBoresightCoordinates = rae2raeOffBoresight(rae, orientation, 0 as Degrees);

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
