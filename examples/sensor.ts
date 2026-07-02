/* eslint-disable no-console */
/**
 * Example demonstrating ground stations, attached sensors, and the low-level
 * coordinate transforms (ECEF, ECI, LLA, RAE) used for look-angle math.
 */

// #region imports
import {
  calcGmst,
  Degrees,
  ecef2eci,
  ecef2rae,
  EcefVec3,
  eci2lla,
  eci2rae,
  GroundStation,
  Kilometers,
  PhasedArrayRadar,
  Satellite,
  SensorType,
  TleLine1,
  TleLine2,
} from 'ootk';
// #endregion imports

// #region create-ground-station
// A GroundStation is a fixed location on Earth. It owns the position;
// sensors attach to it as components.
const groundStation = new GroundStation({
  lat: 41 as Degrees,
  lon: -71 as Degrees,
  alt: 1 as Kilometers,
  name: 'Test Station',
});

console.log(groundStation.toString());
// #endregion create-ground-station

// #region attach-sensor
// Sensors no longer carry their own lat/lon/alt. Build a concrete sensor
// (here a phased array radar) with a FieldOfView, then attach it to a platform.
const capeCodRadar = new PhasedArrayRadar({
  id: 1,
  name: 'Cape Cod',
  sensorType: SensorType.PHASED_ARRAY_RADAR,
  beamwidth: 2 as Degrees,
  boresightAz: [47 as Degrees, 167 as Degrees], // two faces
  boresightEl: [20 as Degrees, 20 as Degrees],
  fieldOfView: {
    halfAngle: 60 as Degrees,
    minRange: 200 as Kilometers,
    maxRange: 5556 as Kilometers,
    minElevation: 3 as Degrees,
  },
});

groundStation.addSensor(capeCodRadar);
capeCodRadar.setParent(groundStation);

console.log(`\n${capeCodRadar.toString()}`);
// #endregion attach-sensor

// #region ecef-to-rae
// Convert an ECEF position directly to range/azimuth/elevation as seen
// from the ground station.
const ecef = {
  x: 4000 as Kilometers,
  y: 7000 as Kilometers,
  z: 3000 as Kilometers,
} as EcefVec3<Kilometers>;

const rae = ecef2rae(groundStation.lla(), ecef);

console.log('\nRAE from ECEF:');
console.log(rae);
// #endregion ecef-to-rae

// #region eci-conversions
// The same point can be routed through the inertial (ECI) frame.
// GMST is needed to rotate between Earth-fixed and inertial frames.
const date = new Date('2023-12-31T20:51:19.934Z');
const { gmst } = calcGmst(date);
const eci = ecef2eci(ecef, gmst);

const rae2 = eci2rae(date, eci, groundStation);
const lla = eci2lla(eci, gmst);

console.log('\nRAE from ECI (should match the ECEF path):');
console.log(rae2);
console.log('\nGeodetic coordinates of the ECI point:');
console.log(lla);
// #endregion eci-conversions

// #region satellite-look-angles
// Satellites expose the same math directly: rae() gives look angles from a
// ground object, and toJ2000() chains into other frames.
const sat = new Satellite({
  tle1: '1 00005U 58002B   23361.70345217  .00000401  00000-0  53694-3 0 99999' as TleLine1,
  tle2: '2 00005  34.2395 218.8683 1841681  30.7692 338.8934 10.85144797345180' as TleLine2,
});

console.log('\nSatellite look angles from the ground station:');
console.log(sat.rae(groundStation, date));

console.log('\nSatellite geodetic position (J2000 -> ITRF -> Geodetic):');
console.log(sat.toJ2000(date).toITRF().toGeodetic());

// The attached sensor can apply its field-of-view constraints on top.
console.log(`\nIs the satellite in the radar's FOV? ${capeCodRadar.canObserve(sat, date) ? 'YES' : 'NO'}`);
// #endregion satellite-look-angles
