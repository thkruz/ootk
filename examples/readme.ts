/* eslint-disable multiline-comment-style */
/* eslint-disable no-console */

import { Degrees, Kilometers, SpaceObjectType, TleLine1, TleLine2 } from '@src/main';
import { DetailedSatellite, DetailedSensor } from '@src/objects';

// Examples for README.md
// import { DetailedSatellite, DetailedSensor, Degrees, Kilometers, SpaceObjectType, TleLine1, TleLine2 } from "ootk";

// Using api.keeptrack.space API
fetch('https://api.keeptrack.space/v1/sat/25544')
  .then((res) => res.json())
  .then((satData) => {
    const satellite = new DetailedSatellite({
      id: satData.id,
      tle1: satData.tle1 as TleLine1,
      tle2: satData.tle2 as TleLine2,
    });

    // Get the satellite's position at the current time
    const eci = satellite.eci();

    // Log the satellite's position - y component only
    console.log(eci.position.y);

    // Access other satellite properties
    console.log(satellite.inclination); // inclination in degrees
    console.log(satellite.eccentricity); // eccentricity
    console.log(satellite.period); // period in minutes

    // Get LLA (Latitude, Longitude, Altitude)
    const lla = satellite.lla();

    console.log(lla); // { lat: degrees, lon: degrees, alt: kilometers }

    const sensor = new DetailedSensor({
      lat: 41.754785 as Degrees,
      lon: -70.539151 as Degrees,
      alt: 0.060966 as Kilometers,
      minAz: 347 as Degrees,
      maxAz: 227 as Degrees,
      minEl: 3 as Degrees,
      maxEl: 85 as Degrees,
      minRng: 0 as Kilometers,
      maxRng: 5556 as Kilometers,
      name: 'Cape Cod',
      type: SpaceObjectType.PHASED_ARRAY_RADAR,
    });

    // Assuming we have a satellite object from the previous example
    const rae = sensor.rae(satellite);

    // Log the azimuth from sensor to satellite
    console.log(rae.az);

    // Check if a satellite is in the sensor's field of view right now
    const isSatInFov = sensor.isSatInFov(satellite);

    console.log(isSatInFov); // true or false

    // Calculate passes for a satellite (in 30 second intervals)
    const passes = sensor.calculatePasses(30, satellite);

    console.log(passes); // Array of pass information

    // Convert sensor position to J2000 coordinates
    const j2000 = sensor.toJ2000();

    console.log(j2000); // J2000 object with position and velocity
  });
