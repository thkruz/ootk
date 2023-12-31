import { Degrees, Meters } from '@src/ootk';
import { Sun } from '../src/body/Sun';
/* eslint-disable no-console */

console.log(Sun.getTimes(new Date(), 41 as Degrees, -71 as Degrees, 0 as Meters));
