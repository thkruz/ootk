import { DetailedSatellite } from '../dist/main.js';

const tle1 = '1 56006U 23042W   24012.45049317  .00000296  00000-0  36967-4 0  9992';
const tle2 = '2 56006  43.0043  13.3620 0001137 267.5965  92.4747 15.02542972 44491';
const satellite = new DetailedSatellite({
  tle1,
  tle2,
});

// eslint-disable-next-line no-console
console.log(satellite);
