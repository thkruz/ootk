import { Sun } from '@src/body';
import { Degrees, Meters } from '@src/main';

/* eslint-disable no-console */
console.log(Sun.getTimes(new Date(), 41 as Degrees, -71 as Degrees, 0 as Meters));
