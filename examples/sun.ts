/* eslint-disable no-console */
/**
 * Example demonstrating solar calculations.
 *
 * This example shows:
 * - Computing sunrise, sunset, twilight, and golden hour times
 * - Getting the Sun's position in ECI coordinates
 * - Computing the Sun's azimuth and elevation for a ground observer
 */

// #region imports
import { Degrees, GroundStation, Kilometers, Meters, Sun } from 'ootk';
// #endregion imports

// #region observer-setup
// Fixed date so the output is reproducible
const date = new Date('2024-01-28T12:00:00.000Z');

// Ground observer near Cape Cod, Massachusetts
const lat = 41 as Degrees;
const lon = -71 as Degrees;
const alt = 0 as Meters;

const station = new GroundStation({
  name: 'Cape Cod',
  lat,
  lon,
  alt: 0 as Kilometers,
});

console.log(`Observer: ${station.name} (${lat} deg N, ${Math.abs(lon)} deg W)`);
console.log(`Date: ${date.toISOString()}`);
// #endregion observer-setup

// #region sun-event-times
console.log('\n=== Sun Event Times ===\n');

// Sun.getTimes returns every solar event for the day: rise/set, twilights,
// golden hour, blue hour, solar noon, and nadir. Times are Date objects.
const times = Sun.getTimes(date, lat, lon, alt, true);

console.log(`Astronomical dawn: ${times.astronomicalDawn.toISOString()}`);
console.log(`Nautical dawn:     ${times.nauticalDawn.toISOString()}`);
console.log(`Civil dawn:        ${times.civilDawn.toISOString()}`);
console.log(`Sunrise:           ${times.sunriseStart.toISOString()}`);
console.log(`Solar noon:        ${times.solarNoon.toISOString()}`);
console.log(`Sunset:            ${times.sunsetEnd.toISOString()}`);
console.log(`Civil dusk:        ${times.civilDusk.toISOString()}`);
console.log(`Nautical dusk:     ${times.nauticalDusk.toISOString()}`);
console.log(`Astronomical dusk: ${times.astronomicalDusk.toISOString()}`);
console.log(`Golden hour (PM):  ${times.goldenHourDuskStart.toISOString()}`);
// #endregion sun-event-times

// #region sunrise-sunset
console.log('\n=== Sunrise/Sunset via astronomy-engine ===\n');

// getSunriseSunset uses the higher-precision astronomy-engine search.
// The search runs forward from the given date, so start at midnight UTC.
// It returns null when the Sun never crosses the horizon (polar day/night).
const midnight = new Date('2024-01-28T00:00:00.000Z');
const { sunrise, sunset } = Sun.getSunriseSunset(station, midnight, 0 as Degrees);

console.log(`Sunrise: ${sunrise ? sunrise.toISOString() : 'none'}`);
console.log(`Sunset:  ${sunset ? sunset.toISOString() : 'none'}`);
// #endregion sunrise-sunset

// #region sun-position
console.log('\n=== Sun Position (ECI) ===\n');

// Sun.eci returns the Sun's position in Earth-centered inertial coordinates
const sunEci = Sun.eci(date);

console.log(`X: ${sunEci.x.toExponential(4)} km`);
console.log(`Y: ${sunEci.y.toExponential(4)} km`);
console.log(`Z: ${sunEci.z.toExponential(4)} km`);

const distance = Sun.getDistanceFromEarth(date);

console.log(`\nDistance from Earth: ${distance.toExponential(4)} km`);
console.log(`                     ${(distance / 149597870.7).toFixed(4)} AU`);
// #endregion sun-position

// #region sun-azimuth-elevation
console.log('\n=== Sun Azimuth/Elevation for Observer ===\n');

// getAzEl computes the topocentric look angles, with atmospheric refraction
// applied by default
const azEl = Sun.getAzEl(station, date);

console.log(`Azimuth:   ${azEl.az.toFixed(4)} deg`);
console.log(`Elevation: ${azEl.el.toFixed(4)} deg`);

const ra = Sun.getRightAscension(date);
const dec = Sun.getDeclination(date);

console.log(`\nRight Ascension: ${(ra * (12 / Math.PI)).toFixed(4)} hours`);
console.log(`Declination:     ${(dec * (180 / Math.PI)).toFixed(4)} deg`);
// #endregion sun-azimuth-elevation
