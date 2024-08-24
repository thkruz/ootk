/* eslint-disable no-console */

import {
  calcGmst,
  DEG2RAD,
  Degrees,
  ecf2eci,
  ecf2rae,
  eci2lla,
  eci2rae,
  Kilometers,
  Satellite,
  Scenario,
  Facility,
  RadarSensor,
  TleLine1,
  TleLine2,
} from '../dist/main';

const scenario = new Scenario({
  name: 'Example Scenario',
  currentTime: new Date(),
  stepSize: 60,
});

const facility = new Facility({
  name: 'Example Facility',
  shortDescription: 'This is an example facility.',
  longDescription: 'This is a long description of the facility.',
  lat: 0 as Degrees,
  lon: 0 as Degrees,
  alt: 0 as Kilometers,
  orientation: {
    azimuth: 0 as Degrees,
    elevation: 0 as Degrees,
  },
});

scenario.addObject(facility);

const capeCodA = new RadarSensor({
  name: 'CapeCodA',
  shortDescription: 'Cape Cod Face A',
  longDescription: 'This is a long description of the sensor.',
  orientation: {
    azimuth: 47 as Degrees,
    elevation: 20 as Degrees,
  },
  minRng: 0 as Kilometers,
  maxRng: 5556 as Kilometers,
  minAz: -65 as Degrees,
  minEl: -20 as Degrees,
  maxAz: 65 as Degrees,
  maxEl: 65 as Degrees,
  coneHalfAngle: 2 as Degrees,
});
const capeCodB = new RadarSensor({
  name: 'CapeCodB',
  shortDescription: 'Cape Cod Face B',
  longDescription: 'This is a long description of the sensor.',
  orientation: {
    azimuth: 167 as Degrees,
    elevation: 20 as Degrees,
  },
  minRng: 0 as Kilometers,
  maxRng: 5556 as Kilometers,
  minAz: -65 as Degrees,
  minEl: -20 as Degrees,
  maxAz: 65 as Degrees,
  maxEl: 65 as Degrees,
  coneHalfAngle: 2 as Degrees,
});

facility.attachObject(capeCodA);
facility.attachObject(capeCodB);

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

const rae = ecf2rae(facility.lla(), ecf);

const { gmst } = calcGmst(date);
const rae2 = eci2rae(date, ecf2eci(ecf, gmst), facility);
const lla = eci2lla(ecf2eci(ecf, gmst), gmst);

console.log(rae);
console.log(rae2);
console.log({
  lat: lla.lat * DEG2RAD,
  lon: lla.lon * DEG2RAD,
  alt: lla.alt,
});

// sat.propagateTo(date);

console.log(sat.rae(facility, date));
console.log(sat.toJ2000(date).toITRF().toGeodetic());
