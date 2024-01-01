/* eslint-disable no-console */
import { Satellite } from '@src/objects/Satellite';
import { Sensor } from '../src/objects';
import { Degrees, Kilometers, SpaceObjectType, TleLine1, TleLine2, Transforms } from '../src/ootk';

const capeCodRadar = new Sensor({
  lat: <Degrees>41.754785,
  lon: <Degrees>-70.539151,
  alt: <Kilometers>0.060966,
  minAz: 347 as Degrees,
  maxAz: 227 as Degrees,
  minEl: 3 as Degrees,
  maxEl: 85 as Degrees,
  minRng: 0 as Kilometers,
  maxRng: 5556 as Kilometers,
  name: 'Cape Cod',
  type: SpaceObjectType.PHASED_ARRAY_RADAR,
});

const testSensor = new Sensor({
  lat: <Degrees>41,
  lon: <Degrees>-71,
  alt: <Kilometers>1,
});

const sat = new Satellite({
  tle1: '1 00005U 58002B   23361.70345217  .00000401  00000-0  53694-3 0 99999' as TleLine1,
  tle2: '2 00005  34.2395 218.8683 1841681  30.7692 338.8934 10.85144797345180' as TleLine2,
});

const date = new Date('2023-12-31T20:51:19.934Z');

const rae = Transforms.ecf2rae(testSensor, {
  x: 4000 as Kilometers,
  y: 7000 as Kilometers,
  z: 3000 as Kilometers,
});

console.log(rae);

// sat.propagateTo(date);

// console.log(sat.raeOpt(capeCodRadar, date));
console.log(sat.getJ2000().inertial);
