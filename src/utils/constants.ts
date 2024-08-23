import { Days, Degrees, Milliseconds, Minutes, Radians, Seconds } from '../types/types.js';

/**
 * Full circle in radians (PI * 2)
 *
 * https://tauday.com/tau-manifesto
 */
export const TAU = (2.0 * Math.PI) as Radians;

/**
 * Represents half of the mathematical constant PI.
 */
export const halfPi = (0.5 * Math.PI) as Radians;

/**
 * Converts degrees to radians.
 */
export const DEG2RAD = (Math.PI / 180.0) as Radians;

/**
 * Converts radians to degrees.
 */
export const RAD2DEG = (180.0 / Math.PI) as Degrees;

/**
 * Conversion factor from seconds to degrees.
 */
export const sec2deg = (1.0 / 60.0 / 60.0) as Degrees;

/**
 * Conversion factor from seconds to days.
 */
export const sec2day: number = sec2deg / 24.0;

/**
 * Conversion factor from arcseconds to radians.
 */
export const asec2rad = (sec2deg * DEG2RAD) as Radians;

/**
 * Convert ten-thousandths of an arcsecond to radians.
 */
export const ttasec2rad = (asec2rad / 10000.0) as Radians;

/**
 * Convert milliarcseconds to radians.
 */
export const masec2rad = (asec2rad / 1000.0) as Radians;

/**
 * The angular velocity of the Earth in radians per second.
 */
export const angularVelocityOfEarth = 7.292115e-5;

/**
 * Astronomical unit in kilometers.
 */
export const astronomicalUnit = 149597870.0;

// / Convert milliseconds to seconds.
export const msec2sec = 1e-3 as Seconds;

// / Speed of light.
export const cMPerSec = 299792458;
export const cKmPerSec = 299792458 / 1000;
export const cKmPerMs = 299792458 / 1000 / 1000;

// / Milliseconds per day.
export const MS_PER_DAY = 86400000;

// / Seconds per day.
export const secondsPerDay = 86400.0;

// / Convert seconds to minutes.
export const sec2min = (1.0 / 60.0) as Minutes;

// / Seconds per sidereal day.
export const secondsPerSiderealDay = 86164.0905;

// / Seconds per week.
export const secondsPerWeek: number = secondsPerDay * 7.0;

/**
 * Half the number of radians in a circle.
 */
export const PI = Math.PI as Radians;

export const x2o3 = 2.0 / 3.0;
export const temp4 = 1.5e-12;

/**
 * The number of minutes in a day.
 */
export const MINUTES_PER_DAY = 1440 as Minutes;

/**
 * The number of milliseconds in a day.
 */
export const MILLISECONDS_TO_DAYS = 1.15741e-8;

/**
 * The number of milliseconds in a day.
 */
export const MILLISECONDS_PER_DAY = <Days>1000 * 60 * 60 * 24;

/**
 * The number of milliseconds in a second.
 */
export const MILLISECONDS_PER_SECOND = <Milliseconds>1000;

export const RADIUS_OF_EARTH = 6371; // Radius of Earth in kilometers

export const earthGravityParam = 398600.4415;
