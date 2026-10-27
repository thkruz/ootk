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

import { DEG2RAD } from '../utils/constants';
import { DataHandler } from '../data/DataHandler';
import { Earth } from '../body/Earth';
import { ITRF } from '../coordinate/ITRF';
import { J2000 } from '../coordinate/J2000';
import { Kilometers, KilometersPerSecond, Radians } from '../types/types';
import { Vector3D } from '../operations/Vector3D';
import { Sun } from '../body/SunBody';
import { Force } from './Force';

/**
 * Harris-Priester atmospheric drag force model.
 *
 * Density follows the standard Harris-Priester model (Montenbruck and Gill, Satellite Orbits,
 * section 3.5.2): rho = rhoMin + (rhoMax - rhoMin) * cos^n(psi / 2), where psi is the
 * angle between the satellite and the diurnal bulge apex (lagging the Sun by 30 deg in right
 * ascension) and rhoMin, rhoMax are interpolated exponentially from the table, which is the
 * mean-solar-activity table.
 *
 * ootk extension: the whole HP density is multiplied by a solar-activity factor that is exactly
 * 1 at F10.7 = 150 SFU (so the default reproduces standard HP) and that never alters the
 * day/night ratio. See `solarActivityFactor_` in the source for the derivation. Typical
 * F10.7 values:
 * - Solar minimum: ~70 SFU
 * - Mean solar activity: ~150 SFU (default, standard HP)
 * - Solar maximum: ~250 SFU
 *
 * F10.7 data is available from:
 * - CelesTrak: https://celestrak.org/SpaceData/
 * - NOAA SWPC: https://www.swpc.noaa.gov/
 */
export class AtmosphericDrag implements Force {
  /** Spacecraft mass in kg. */
  mass: number;
  /** Cross-sectional area in m^2. */
  area: number;
  /** Drag coefficient (dimensionless). */
  dragCoeff: number;
  /**
   * Harris-Priester cosine exponent n in cos^n(psi / 2) (not the cosine of an angle).
   * Montenbruck and Gill recommend 2 for low-inclination orbits and 6 for polar orbits.
   */
  cosine: number;
  /** F10.7 solar radio flux index in solar flux units (SFU). */
  f107: number;

  /**
   * Creates an atmospheric drag force model.
   * @param mass Spacecraft mass in kg.
   * @param area Cross-sectional area in m^2.
   * @param dragCoeff Drag coefficient (typically 2.0-2.5).
   * @param cosine Harris-Priester cosine exponent n (typically 2-6), not an angle cosine.
   * @param f107 F10.7 solar radio flux in SFU (default: 150, mean solar activity, standard HP).
   */
  constructor(mass: number, area: number, dragCoeff: number, cosine: number, f107 = 150) {
    this.mass = mass;
    this.area = area;
    this.dragCoeff = dragCoeff;
    this.cosine = cosine;
    this.f107 = f107;
  }

  /*
   * Thermosphere constants for the solar-activity factor. Lower boundary (120 km) temperature,
   * temperature gradient and species number densities are the US Standard Atmosphere 1976 values
   * (NOAA-S/T 76-1562, tables I-VIII; number densities rounded); re is the US76 effective Earth
   * radius for geopotential height.
   */
  private static readonly SF_Z0_ = 120; // km
  /** Top of the 120 km to 200 km band where the solar-activity factor is blended to 1. */
  private static readonly SF_BLEND_TOP_ = 200; // km
  private static readonly SF_T0_ = 360; // K
  private static readonly SF_DTDZ_ = 12; // K/km
  private static readonly SF_RE_ = 6356.766; // km
  private static readonly SF_G0_ = 9.80665; // m/s^2
  private static readonly SF_R_ = 8.31432; // J/(mol K), US76 gas constant
  private static readonly SF_NA_ = 6.022169e26; // 1/kmol, US76 Avogadro constant
  /** [molar mass kg/kmol, thermal diffusion factor alpha, number density at 120 km 1/m^3]. */
  private static readonly SF_SPECIES_: ReadonlyArray<readonly [number, number, number]> = [
    [28.0134, 0, 3.726e17], // N2
    [31.9988, 0, 4.0e16], // O2
    [15.9994, 0, 9.275e16], // O
    [4.0026, -0.4, 3.4e13], // He
  ];

  /**
   * Total mass density of a diffusive-equilibrium thermosphere above 120 km for a given
   * exospheric temperature, using the US Standard Atmosphere 1976 temperature profile
   * T(xi) = Tinf - (Tinf - T0) * exp(-lambda * xi), lambda = (dT/dz)_0 / (Tinf - T0),
   * xi = (z - z0) * (re + z0) / (re + z) (geopotential height), and the closed-form
   * diffusive-equilibrium solution for that profile (Walker, 1965, J. Atmos. Sci. 22, 462):
   *   n_i(z) = n_i(z0) * (T0 / T)^(1 + alpha_i + gamma_i) * exp(-lambda * gamma_i * xi),
   *   gamma_i = M_i * g0' / (lambda * R * Tinf), g0' = g0 * (re / (re + z0))^2.
   * At Tinf = 1000 K it reproduces the US76 total density to within about 10% from 200 to
   * 800 km (H, absent here, matters only near 1000 km).
   * @param heightKm Geometric height in km (at or above 120).
   * @param tInf Exospheric temperature in K (above 360).
   * @returns Mass density in kg/m^3.
   */
  private static thermosphereDensity_(heightKm: number, tInf: number): number {
    const z0 = AtmosphericDrag.SF_Z0_;
    const t0 = AtmosphericDrag.SF_T0_;
    const re = AtmosphericDrag.SF_RE_;
    const lambda = AtmosphericDrag.SF_DTDZ_ / (tInf - t0); // 1/km
    const xi = ((heightKm - z0) * (re + z0)) / (re + heightKm); // km
    const t = tInf - (tInf - t0) * Math.exp(-lambda * xi);
    const g = AtmosphericDrag.SF_G0_ * (re / (re + z0)) ** 2;
    let massDensity = 0;

    for (const [molarMass, alpha, n0] of AtmosphericDrag.SF_SPECIES_) {
      // lambda converted to 1/m so gamma is dimensionless; molar mass converted to kg/mol.
      const gamma = ((molarMass / 1000) * g) / ((lambda / 1000) * (AtmosphericDrag.SF_R_ * tInf));
      const n = n0 * (t0 / t) ** (1 + alpha + gamma) * Math.exp(-lambda * gamma * xi);

      massDensity += (n * molarMass) / AtmosphericDrag.SF_NA_;
    }

    return massDensity;
  }

  /**
   * Multiplicative solar-activity factor applied to the whole Harris-Priester density.
   *
   * The HP table is for mean solar activity, so the factor is the ratio of thermosphere
   * densities at the requested and the reference activity:
   *   factor = rho(h, Tinf(F10.7)) / rho(h, Tinf(150)),
   * with Tinf = 379 + 3.24 * F10.7 K (Jacchia 1971, SAO Special Report 332, nighttime minimum
   * exospheric temperature) and rho the US76 diffusive-equilibrium thermosphere above 120 km
   * (see thermosphereDensity_). The factor is exactly 1 at F10.7 = 150 and at or below 120 km,
   * scales day and night alike (so the HP diurnal bulge ratio is unchanged), and gives about
   * 0.20 / 2.27 at 400 km and 0.28 / 4.6 at 800 km for F10.7 = 70 / 250. It is a first-order
   * correction (no 81-day average, no Ap, no hydrogen), not a substitute for Jacchia-Roberts
   * or NRLMSISE-00.
   *
   * Between 120 and 200 km the factor is blended linearly to 1:
   *   factor(h) = 1 + s (factor(200 km) - 1), s = (h - 120) / 80.
   * The ratio itself inverts below about 190 km (with the boundary density fixed at 120 km, a
   * hotter thermosphere is slightly LESS dense there: 1.057 at F10.7 = 50 and 140 km), so the
   * blend is anchored at the 200 km ratio, which increases with F10.7. Blending the local ratio
   * instead would keep the inversion and is not monotonic at 180 km for F10.7 above 250. The
   * blended factor is continuous at 200 km and non-decreasing in F10.7 at every height.
   * @param heightKm Geodetic height in km.
   * @param f107 F10.7 solar radio flux in SFU (negative values are treated as 0).
   * @returns Dimensionless density multiplier.
   */
  private static solarActivityFactor_(heightKm: number, f107: number): number {
    const referenceF107 = 150;

    if (!(heightKm > AtmosphericDrag.SF_Z0_) || f107 === referenceF107) {
      return 1.0;
    }
    const tInf = (flux: number): number => 379 + 3.24 * Math.max(0, flux);
    const ratioAt = (h: number): number => AtmosphericDrag.thermosphereDensity_(h, tInf(f107)) /
      AtmosphericDrag.thermosphereDensity_(h, tInf(referenceF107));

    if (heightKm >= AtmosphericDrag.SF_BLEND_TOP_) {
      return ratioAt(heightKm);
    }
    const s = (heightKm - AtmosphericDrag.SF_Z0_) / (AtmosphericDrag.SF_BLEND_TOP_ - AtmosphericDrag.SF_Z0_);

    return 1 + s * (ratioAt(AtmosphericDrag.SF_BLEND_TOP_) - 1);
  }

  /**
   * Harris-Priester density with the ootk F10.7 extension.
   * @param state Satellite state in ITRF.
   * @param n Harris-Priester cosine exponent.
   * @param f107 F10.7 solar radio flux in SFU.
   * @returns Density in kg/m^3 (0 outside the 100 to 1000 km table range).
   */
  private static _getHPDensity(state: ITRF, n: number, f107: number): number {
    const hpa = DataHandler.getInstance().getHpAtmosphere(state.height);

    if (hpa === null) {
      return 0.0;
    }
    const sunPos = Sun.eciApparent(state.epoch.toDateTime());
    const sunVec = new J2000(
      state.epoch,
      sunPos,
      Vector3D.origin as Vector3D<KilometersPerSecond>,
    ).toITRF().position.normalize();
    const bulVec = sunVec.rotZ(-30.0 * DEG2RAD as Radians);
    const cosPsi = bulVec.normalize().dot(state.position.normalize());
    const c2Psi2 = 0.5 * (1.0 + cosPsi);
    const cPsi2 = Math.sqrt(c2Psi2);
    const cosPow = cPsi2 > 1e-12 ? c2Psi2 * cPsi2 ** (n - 2) : 0.0;
    const altitude = hpa.height;
    const [h0, min0, max0] = hpa.hp0;
    const [h1, min1, max1] = hpa.hp1;
    const dH = (h0 - altitude) / (h0 - h1);
    const rhoMin = min0 * (min1 / min0) ** dH;
    const rhoMax = max0 * (max1 / max0) ** dH;

    // Standard HP (M&G section 3.5.2), then the whole density scaled by solar activity.
    return (rhoMin + (rhoMax - rhoMin) * cosPow) * AtmosphericDrag.solarActivityFactor_(altitude, f107);
  }

  acceleration(state: J2000): Vector3D {
    const itrfState = state.toITRF();
    const density = AtmosphericDrag._getHPDensity(itrfState, this.cosine, this.f107);

    if (density === 0) {
      return Vector3D.origin;
    }
    const rotation = new ITRF(
      state.epoch,
      Earth.rotation as unknown as Vector3D<Kilometers>,
      Vector3D.origin as Vector3D<KilometersPerSecond>,
    ).toJ2000().position;
    const vRel = state.velocity.subtract(rotation.cross(state.position) as unknown as Vector3D<KilometersPerSecond>)
      .scale(1000.0 as KilometersPerSecond);
    const vm = vRel.magnitude();
    const fScale = -0.5 * density * ((this.dragCoeff * this.area) / this.mass) * vm;

    return vRel.scale(fScale / 1000.0);
  }
}
