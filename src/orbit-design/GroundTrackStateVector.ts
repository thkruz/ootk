/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

import { Earth } from '../body/Earth';
import { GreenwichMeanSiderealTime, Kilometers, KilometersPerSecond, Radians } from '../types/types';

/** Cartesian TEME vector, km (position) or km/s (velocity). */
export interface StateVec3 {
  x: number;
  y: number;
  z: number;
}

export interface GroundTrackState {
  /** TEME position at the epoch (km). */
  position: StateVec3;
  /** TEME velocity at the epoch (km/s). */
  velocity: StateVec3;
}

export interface GroundTrackStateOptions {
  /** Semi-major axis of the desired orbit (km). */
  semimajorAxisKm: Kilometers;
  /** Eccentricity of the desired orbit (0 for circular). */
  eccentricity: number;
  /** Inclination of the desired orbit (radians, 0..pi). */
  inclinationRad: Radians;
  /** Geodetic latitude of the launch site / target sub-point (radians). */
  latRad: Radians;
  /** Geodetic longitude of the launch site / target sub-point (radians, -pi..pi). */
  lonRad: Radians;
  /** GMST at the epoch (radians). */
  gmstRad: GreenwichMeanSiderealTime;
  /** Direction of ground-track motion at the sub-point: 'N' (ascending) or 'S' (descending). */
  direction: 'N' | 'S';
}

// WGS84 constants matching {@link eci2lla}/{@link llaRad2ecef} so the position round-trips exactly.
const WGS84_A = 6378.137; // equatorial radius, km
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F;

/**
 * Minimum eccentricity used when the requested orbit is (near-)circular.
 *
 * An exactly-circular state (e = 0) has an undefined eccentricity vector, so the
 * osculating-to-mean fit downstream (`rv2tle` -> `J2000.toClassicalElements`)
 * can decompose it into a perigee/anomaly split whose argument of latitude is
 * inconsistent with the position, throwing the fitted TLE thousands of km off
 * (a broad grid sweep diverged in 37/290 near-circular cases at e = 0, worst
 * ~20000 km; flooring at 1e-3 dropped that to 0/290). A TLE circular orbit is
 * never truly e = 0 anyway - SGP4 imposes ~0.0012 osculating eccentricity - so
 * this floor (an ISS-like ~14 km apogee/perigee spread at LEO) is within the
 * noise of what "circular" means for a two-line element set.
 */
const MIN_ECCENTRICITY = 1e-3;

/**
 * Builds a TEME state vector that places a satellite at **perigee, directly over a
 * geodetic sub-point**, on an orbit of the requested shape and inclination, moving
 * North (ascending) or South (descending) at that point.
 *
 * This is the closed-form replacement for the {@link OrbitFinder} ground-track
 * search: instead of synthesizing candidate TLEs and iterating SGP4 until the
 * sub-point converges (~2.8 km tolerance), it constructs the exact state
 * analytically. Feed the result to `rv2tle` to fit SGP4 mean elements.
 *
 * The position is built with the full WGS84 ellipsoid so `eci2lla(position, gmst)`
 * returns the requested lat/lon exactly. The velocity is perpendicular to the
 * radius vector (flight-path angle 0, i.e. perigee) with the horizontal azimuth
 * fixed by the standard `cos(i) = sin(azimuth) * cos(geocentricLat)` relation, so
 * the fitted orbit has the requested inclination. For a circular orbit (e = 0)
 * this reduces to radius = a and speed = sqrt(mu / a).
 *
 * @returns the TEME position/velocity, or `null` when the target latitude is
 * unreachable for the requested inclination (|cos(i)| > cos(geocentricLat)).
 */
export const groundTrackStateVector = (opts: GroundTrackStateOptions): GroundTrackState | null => {
  const { semimajorAxisKm: a, inclinationRad: inc, latRad, lonRad, gmstRad, direction } = opts;
  const e = Math.max(opts.eccentricity, MIN_ECCENTRICITY);

  // Perigee geometry: radius and inertial speed with a zero flight-path angle.
  const rPerigee = a * (1 - e);
  const vPerigee = Math.sqrt((Earth.mu / a) * ((1 + e) / (1 - e)));

  // 1. Solve the ellipsoid height h so the geodetic point sits at geocentric radius rPerigee.
  //    |llaRad2ecef(lat, lon, h)|^2 = h^2 + 2(cN + sM)h + (cN^2 + sM^2), with c=cos^2 lat,
  //    s=sin^2 lat, N=prime-vertical radius, M=N(1-e2). Setting this to rPerigee^2 is a
  //    quadratic in h; take the physical (outer) root.
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const nPrime = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const mPrime = nPrime * (1 - WGS84_E2);
  const c = cosLat * cosLat;
  const s = sinLat * sinLat;
  const bCoef = c * nPrime + s * mPrime;
  const cCoef = c * nPrime * nPrime + s * mPrime * mPrime - rPerigee * rPerigee;
  const disc = bCoef * bCoef - cCoef;

  if (disc < 0) {
    // Perigee radius is below the ellipsoid surface at this latitude (sub-orbital).
    return null;
  }
  const height = -bCoef + Math.sqrt(disc);

  // 2. Geodetic position in ECEF, then rotate to TEME by GMST so eci2lla round-trips.
  const cosLonE = Math.cos(lonRad);
  const sinLonE = Math.sin(lonRad);
  const xEcef = (nPrime + height) * cosLat * cosLonE;
  const yEcef = (nPrime + height) * cosLat * sinLonE;
  const zEcef = (mPrime + height) * sinLat;

  const cosG = Math.cos(gmstRad);
  const sinG = Math.sin(gmstRad);
  const position: StateVec3 = {
    x: xEcef * cosG - yEcef * sinG,
    y: xEcef * sinG + yEcef * cosG,
    z: zEcef,
  };

  // 3. Velocity: perpendicular to the (geocentric) radius, azimuth from the inclination relation.
  const rMag = Math.hypot(position.x, position.y, position.z);
  const rHat: StateVec3 = { x: position.x / rMag, y: position.y / rMag, z: position.z / rMag };
  const geocentricLat = Math.asin(rHat.z);
  const cosGeoLat = Math.cos(geocentricLat);

  const sinAz = Math.cos(inc) / cosGeoLat;

  if (sinAz < -1 || sinAz > 1) {
    // Target latitude exceeds what this inclination can reach.
    return null;
  }
  // Ascending ('N') heads north (cos azimuth > 0); descending ('S') heads south.
  const cosAz = (direction === 'N' ? 1 : -1) * Math.sqrt(Math.max(0, 1 - sinAz * sinAz));

  // Local inertial East/North tangent basis at the sub-point (up = rHat).
  const eastMag = Math.hypot(rHat.x, rHat.y);
  const eastHat: StateVec3 = eastMag > 1e-9
    ? { x: -rHat.y / eastMag, y: rHat.x / eastMag, z: 0 }
    : { x: 1, y: 0, z: 0 }; // degenerate at the poles; any east is fine
  // north = rHat x east (right-handed with up = rHat)
  const northHat: StateVec3 = {
    x: rHat.y * eastHat.z - rHat.z * eastHat.y,
    y: rHat.z * eastHat.x - rHat.x * eastHat.z,
    z: rHat.x * eastHat.y - rHat.y * eastHat.x,
  };

  const velocity: StateVec3 = {
    x: vPerigee * (sinAz * eastHat.x + cosAz * northHat.x),
    y: vPerigee * (sinAz * eastHat.y + cosAz * northHat.y),
    z: vPerigee * (sinAz * eastHat.z + cosAz * northHat.z),
  };

  return { position, velocity };
};

/** Semi-major axis (km) from an SGP4 mean motion in revolutions/day. */
export const semimajorAxisFromMeanMotion = (meanMotionRevPerDay: number): Kilometers => {
  const n = (meanMotionRevPerDay * 2 * Math.PI) / 86_400; // rad/s

  return ((Earth.mu / (n * n)) ** (1 / 3)) as Kilometers;
};

/** Perigee speed (km/s) — exported for callers that need the vis-viva speed alongside the state. */
export const perigeeSpeed = (semimajorAxisKm: Kilometers, eccentricity: number): KilometersPerSecond =>
  Math.sqrt((Earth.mu / semimajorAxisKm) * ((1 + eccentricity) / (1 - eccentricity))) as KilometersPerSecond;
