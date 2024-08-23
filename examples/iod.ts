import { LambertIOD } from '@src/orbit_determination/LambertIOD.js';
import { GibbsIOD } from './../src/orbit_determination/GibbsIOD.js';
import { HerrickGibbsIOD } from './../src/orbit_determination/HerrickGibbsIOD.js';
import { EpochUTC, Kilometers, Degrees, DEG2RAD, Radians, calcGmst, lla2eci, RAE, J2000, Vector3D, KilometersPerSecond, Tle } from '@src/main.js';

/* eslint-disable no-console */

const lambert = new LambertIOD();

const rae1 = {
  t: EpochUTC.fromDateTime(new Date(1704628462000)),
  rng: 1599.89 as Kilometers,
  az: 174 as Degrees,
  el: 13.6 as Degrees,
};
const rae2 = {
  t: EpochUTC.fromDateTime(new Date(1704628462000 + 10 * 1000)),
  rng: 1568.76 as Kilometers,
  az: 171 as Degrees,
  el: 14.2 as Degrees,
};
const rae3 = {
  t: EpochUTC.fromDateTime(new Date(1704628462000 + 20 * 1000)),
  rng: 1540.09 as Kilometers,
  az: 169 as Degrees,
  el: 14.7 as Degrees,
};
const sensor = {
  lat: (41.754785 * DEG2RAD) as Radians,
  lon: (-70.539151 * DEG2RAD) as Radians,
  alt: 0.085 as Kilometers,
};

const gmst = calcGmst(rae1.t.toDateTime());
const sensorEci = lla2eci(sensor, gmst.gmst);

const p1 = RAE.fromDegrees(rae1.t, rae1.rng, rae1.az, rae1.el).toStateVector(
  new J2000(rae1.t,
    new Vector3D(sensorEci.x, sensorEci.y, sensorEci.z), Vector3D.origin as Vector3D<KilometersPerSecond>,
  ),
);
const p2 = RAE.fromDegrees(rae2.t, rae2.rng, rae2.az, rae2.el).toStateVector(
  new J2000(rae2.t,
    new Vector3D(sensorEci.x, sensorEci.y, sensorEci.z), Vector3D.origin as Vector3D<KilometersPerSecond>,
  ),
);
const p3 = RAE.fromDegrees(rae3.t, rae3.rng, rae3.az, rae3.el).toStateVector(
  new J2000(rae3.t,
    new Vector3D(sensorEci.x, sensorEci.y, sensorEci.z), Vector3D.origin as Vector3D<KilometersPerSecond>,
  ),
);

const eci1 = {
  x: -4901.84521484375 as Kilometers,
  y: -3592.527587890625 as Kilometers,
  z: 3322.875732421875 as Kilometers,
};
const eci2 = {
  x: -4847.90185546875 as Kilometers,
  y: -3631.424560546875 as Kilometers,
  z: 3359.44482421875 as Kilometers,
};
const eci3 = {
  x: -4793.376953125 as Kilometers,
  y: -3669.885986328125 as Kilometers,
  z: 3395.60986328125 as Kilometers,
};
const p1b = new J2000(rae1.t, new Vector3D(eci1.x, eci1.y, eci1.z), Vector3D.origin as Vector3D<KilometersPerSecond>);
const p2b = new J2000(rae2.t, new Vector3D(eci2.x, eci2.y, eci2.z), Vector3D.origin as Vector3D<KilometersPerSecond>);
const p3b = new J2000(rae3.t, new Vector3D(eci3.x, eci3.y, eci3.z), Vector3D.origin as Vector3D<KilometersPerSecond>);

const eci4 = { x: -4738.27734375 as Kilometers, y: -3707.9072265625 as Kilometers, z: 3431.36669921875 as Kilometers};
const p4b = new J2000(
  EpochUTC.fromDateTime(new Date(1704628492000)),
  new Vector3D(eci4.x, eci4.y, eci4.z),
  Vector3D.origin as Vector3D<KilometersPerSecond>,
);

const eci5 = {
  x: -4569.595703125 as Kilometers,
  y: -3819.285400390625 as Kilometers,
  z: 3536.144287109375 as Kilometers,
};
const p5b = new J2000(
  EpochUTC.fromDateTime(new Date(1704628522000)),
  new Vector3D(eci5.x, eci5.y, eci5.z),
  Vector3D.origin as Vector3D<KilometersPerSecond>,
);

const estimate = lambert.estimate(p1.position, p2.position, p1.epoch, p2.epoch);
const estimate2 = new HerrickGibbsIOD().solve(p1.position, p1.epoch, p2.position, p2.epoch, p3.position, p3.epoch);
const estimate3 = new GibbsIOD().solve(p1b.position, p2b.position, p3b.position, p2b.epoch, p3b.epoch);
const estimate4 = new HerrickGibbsIOD().solve(
  p1b.position,
  p1b.epoch,
  p4b.position,
  p4b.epoch,
  p5b.position,
  p5b.epoch,
);

Tle.fromClassicalElements(estimate.toClassicalElements());
Tle.fromClassicalElements(estimate2.toClassicalElements());
const tle = Tle.fromClassicalElements(estimate3.toClassicalElements());

console.log(tle.line1);
console.log(tle.line2);

const tle2 = Tle.fromClassicalElements(estimate4.toClassicalElements());

console.log(tle2.line1);
console.log(tle2.line2);
