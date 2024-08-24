import { Degrees, Facility, Kilometers, Marker, Scenario } from '../main.js';
import { RadarSensor } from './attachable/Radar.js';

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

const marker = new Marker({
  name: 'Example Marker',
  shortDescription: 'This is an example marker.',
  longDescription: 'This is a long description of the marker.',
  lat: 0 as Degrees,
  lon: 10 as Degrees,
  alt: 1000 as Kilometers,
});

scenario.addObject(marker);

const isInFov = facility.attachedObjects.some((sensor) => (sensor as RadarSensor).isRaeInFov((sensor as RadarSensor).rae(marker)));

// eslint-disable-next-line no-console
console.log(isInFov);


/*
 * rectangularSensor.update = (baseObject: BaseObject, deltaTime: number): void => {
 *   rectangularSensor.az = rectangularSensor.az + deltaTime as Degrees;
 * };
 */

// // Usage example:
// const satellite = new SatelliteBuilder({
//   tle1: '1 25544U 98067A   21156.30527927  .00003432  00000-0  69801-4 0  9994' as TleLine1,
//   tle2: '2 25544  51.6455  41.4969 0003508  68.0432  78.3395 15.48957534286754' as TleLine2,
// })
//   .withId(25544)
//   .withName('ISS')
//   .withLaunchInfo(new LaunchInfo({
//     launchDate: '1998-11-20',
//     launchSite: 'Baikonur Cosmodrome',
//     launchVehicle: 'Proton-K',
//   }))
//   .build();

/*
 * const conicSensor = new SimpleConicSensor({
 *   name: 'Example Sensor',
 *   shortDescription: 'This is an example sensor.',
 *   longDescription: 'This is a long description of the sensor.',
 *   az: 0 as Degrees,
 *   el: 0 as Degrees,
 *   rng: 0 as Kilometers,
 *   coneHalfAngle: 0 as Degrees,
 * });
 */

// satellite.attachObject(conicSensor);

/*
 * conicSensor.update = (baseObject: BaseObject, deltaTime: number): void => {
 *   conicSensor.az = conicSensor.az + deltaTime as Degrees;
 * };
 */

// // eslint-disable-next-line no-console
// console.log(satellite);

/*
 * for (let i = 0; i < 10; i++) {
 *   rectangularSensor.update(rectangularSensor.parent as BaseObject, 10);
 *   conicSensor.update(conicSensor.parent as BaseObject, 10);
 *   // eslint-disable-next-line no-console
 *   console.log(rectangularSensor.az);
 *   // eslint-disable-next-line no-console
 *   console.log(conicSensor.az);
 * }
 */

// const json = satellite.toJSON();

// // eslint-disable-next-line no-console
// console.warn(json);

// const newSatellite = Satellite.fromJSON(json);

// // eslint-disable-next-line no-console
// console.warn(newSatellite);

