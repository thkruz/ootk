/* eslint-disable no-console */
import { Satellite } from '@src/objects/Satellite';
import { calcGmst, ecf2eci, eci2lla, eci2rae } from '@src/transforms/transforms';
import { DEG2RAD } from '@src/utils/constants';
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

const ecf = {
  x: 4000 as Kilometers,
  y: 7000 as Kilometers,
  z: 3000 as Kilometers,
};
// const ecf2 = { x: 982.8336640053099, y: -6779.137352354403, z: 3813.7284924837254 } as EcfVec3<Kilometers>;

const rae = Transforms.ecf2rae(testSensor, ecf);

const { gmst } = calcGmst(date);
const rae2 = eci2rae(date, ecf2eci(ecf, gmst), testSensor);
const lla = eci2lla(ecf2eci(ecf, gmst), gmst);

console.log(rae);
console.log(rae2);
console.log({
  lat: lla.lat * DEG2RAD,
  lon: lla.lon * DEG2RAD,
  alt: lla.alt,
});

// sat.propagateTo(date);

console.log(sat.raeOpt(testSensor, date));
console.log(sat.getJ2000(date).toITRF().toGeodetic());
