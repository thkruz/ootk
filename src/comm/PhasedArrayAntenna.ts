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

import { ValidationError } from '../errors';
import type { Degrees } from '../types/types';
import { Antenna, AntennaParams } from './Antenna';
import { Decibels, SPEED_OF_LIGHT_KM_S, SerializedAntenna } from './CommTypes';
import { GnssAntenna, type SerializedGnssAntenna } from '../gnss/GnssAntenna';

const DEG2RAD = Math.PI / 180;

/** Default far-sidelobe gain outside the scan limit: -10 dBi, the ITU-R S.465 far-sidelobe level used by {@link Antenna}. */
export const DEFAULT_PHASED_ARRAY_SIDELOBE_FLOOR_DBI = -10;

/**
 * Default total scan-loss exponent (see {@link PhasedArrayAntennaParams.scanLossExponent}). 1.3 is
 * taken from the 1.2 to 1.5 range typical of real arrays given in the originating feature request
 * (ootk issue); it is a modelling default, not a value from a cited standard or paper.
 */
export const DEFAULT_SCAN_LOSS_EXPONENT = 1.3;

/** Parameters for constructing a PhasedArrayAntenna. */
export interface PhasedArrayAntennaParams extends AntennaParams {
  /** Azimuth of the panel normal in degrees, clockwise from north (default 0) */
  normalAz?: Degrees;
  /** Elevation of the panel normal in degrees above the local horizon (default 90, zenith) */
  normalEl?: Degrees;
  /** Maximum scan angle from the panel normal in degrees, 0 < x < 90 (default 60) */
  maxScanAngle?: number;
  /**
   * Total exponent n of the gain roll-off, G(theta) = G0 + 10 n log10(cos theta). n = 1 is pure
   * projected-aperture loss (effective area A cos theta); n greater than 1 adds element-pattern
   * roll-off on top. Must be positive. Default 1.3.
   */
  scanLossExponent?: number;
  /** Gain in dBi returned beyond maxScanAngle or behind the panel (default -10 dBi) */
  sidelobeFloor?: Decibels;
  /**
   * Beam pointing error in degrees (default 0). Modelled as an extra off-axis angle added to the
   * scan angle inside the scan-loss term only; the scan-limit test uses the geometric angle.
   */
  pointingError?: number;
}

/** Parameters for {@link PhasedArrayAntenna.fromAperture}. */
export interface PhasedArrayApertureParams extends Omit<PhasedArrayAntennaParams, 'gain'> {
  /** Aperture width in meters */
  widthMeters: number;
  /** Aperture height in meters */
  heightMeters: number;
  /** Operating frequency in Hz */
  frequency: number;
  /** Aperture efficiency 0-1 (default 0.55) */
  efficiency?: number;
}

/** Serialized form of a PhasedArrayAntenna. */
export interface SerializedPhasedArrayAntenna extends SerializedAntenna {
  /** Discriminator used to pick the right deserializer */
  type: 'phased-array';
  normalAz: Degrees;
  normalEl: Degrees;
  maxScanAngle: number;
  scanLossExponent: number;
  sidelobeFloor: Decibels;
  pointingError: number;
}

/**
 * Electronically scanned flat-panel antenna with scan loss and a maximum scan angle.
 *
 * Gain toward a direction at scan angle theta from the panel normal (inside the scan limit) is
 *
 *   G(theta) = G0 + 10 n log10(cos(theta + pointingError))
 *
 * where n is the TOTAL roll-off exponent. n = 1 is the physical projected-aperture loss (the
 * effective area of a flat aperture is A cos theta; Balanis, Antenna Theory, 4th ed., ch. 2 and
 * ch. 12). n greater than 1 adds element-pattern roll-off, as seen on real arrays. Inside the scan
 * limit the gain is clamped to not fall below the sidelobe floor. Beyond
 * maxScanAngle, or for a target behind the panel, the gain is the sidelobe floor.
 *
 * Directions are in the topocentric ENU look frame used by {@link Antenna.getGainToward}, so the
 * panel is assumed to be mounted on a ground object. Because it extends {@link Antenna} it can be
 * used wherever an Antenna is accepted.
 *
 * @example
 * ```typescript
 * const panel = PhasedArrayAntenna.fromAperture({
 *   widthMeters: 0.5, heightMeters: 0.3, frequency: 11.7e9, efficiency: 0.6, maxScanAngle: 60,
 * });
 * const g = panel.getGainToward(120 as Degrees, 40 as Degrees);
 * ```
 */
export class PhasedArrayAntenna extends Antenna {
  /** Azimuth of the panel normal (deg, clockwise from north) */
  readonly normalAz: Degrees;
  /** Elevation of the panel normal (deg above the horizon) */
  readonly normalEl: Degrees;
  /** Maximum scan angle from the normal (deg) */
  readonly maxScanAngle: number;
  /** Total scan-loss exponent n */
  readonly scanLossExponent: number;
  /** Gain outside the scan limit (dBi) */
  readonly sidelobeFloor: Decibels;
  /** Beam pointing error (deg) */
  readonly pointingError: number;

  private readonly normal_: [number, number, number];

  constructor(params: PhasedArrayAntennaParams) {
    super(params);

    const maxScan = params.maxScanAngle ?? 60;
    const exponent = params.scanLossExponent ?? DEFAULT_SCAN_LOSS_EXPONENT;
    const pointingError = params.pointingError ?? 0;

    if (!(maxScan > 0 && maxScan < 90)) {
      throw new ValidationError('maxScanAngle must be between 0 and 90 degrees (exclusive)', 'maxScanAngle', maxScan);
    }
    if (!(exponent > 0) || !Number.isFinite(exponent)) {
      throw new ValidationError('scanLossExponent must be a positive number', 'scanLossExponent', exponent);
    }
    if (!(pointingError >= 0) || !Number.isFinite(pointingError)) {
      throw new ValidationError('pointingError must be zero or positive degrees', 'pointingError', pointingError);
    }

    this.normalAz = params.normalAz ?? (0 as Degrees);
    this.normalEl = params.normalEl ?? (90 as Degrees);
    this.maxScanAngle = maxScan;
    this.scanLossExponent = exponent;
    this.sidelobeFloor = params.sidelobeFloor ?? (DEFAULT_PHASED_ARRAY_SIDELOBE_FLOOR_DBI as Decibels);
    this.pointingError = pointingError;
    this.normal_ = PhasedArrayAntenna.enuUnit_(this.normalAz, this.normalEl);
  }

  /**
   * Builds a panel from its physical aperture. Peak gain is the aperture relation
   * G = eta 4 pi A / lambda^2 (Balanis, Antenna Theory, 4th ed., ch. 2: D0 = 4 pi Ae / lambda^2 with
   * Ae = eta A), with lambda = c / f.
   *
   * @param params - Aperture size (m), frequency (Hz), efficiency 0-1 and the other panel parameters
   * @returns A phased array with the computed broadside gain
   */
  static fromAperture(params: PhasedArrayApertureParams): PhasedArrayAntenna {
    const { widthMeters, heightMeters, frequency, ...rest } = params;

    if (!(widthMeters > 0) || !(heightMeters > 0)) {
      throw new ValidationError('Aperture width and height must be positive', 'widthMeters', widthMeters);
    }
    if (!(frequency > 0)) {
      throw new ValidationError('Frequency must be positive', 'frequency', frequency);
    }
    const efficiency = params.efficiency ?? 0.55;

    if (efficiency <= 0 || efficiency > 1) {
      throw new ValidationError('Antenna efficiency must be between 0 and 1', 'efficiency', efficiency);
    }

    const lambdaM = (SPEED_OF_LIGHT_KM_S * 1000) / frequency;
    const gain = 10 * Math.log10((efficiency * 4 * Math.PI * widthMeters * heightMeters) / lambdaM ** 2);

    return new PhasedArrayAntenna({ ...rest, gain: gain as Decibels, efficiency });
  }

  private static enuUnit_(az: number, el: number): [number, number, number] {
    const a = az * DEG2RAD;
    const e = el * DEG2RAD;

    return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
  }

  /**
   * Angle between the panel normal and a look direction.
   * @param az - Look azimuth in degrees (clockwise from north)
   * @param el - Look elevation in degrees above the horizon
   * @returns Scan angle in degrees, 0 to 180 (the dot-product argument is clamped to [-1, 1])
   */
  scanAngleTo(az: Degrees, el: Degrees): Degrees {
    const t = PhasedArrayAntenna.enuUnit_(az, el);
    const n = this.normal_;
    const dot = n[0] * t[0] + n[1] * t[1] + n[2] * t[2];

    return (Math.acos(Math.max(-1, Math.min(1, dot))) / DEG2RAD) as Degrees;
  }

  /**
   * True when the direction is inside the scan limit (scan angle at most maxScanAngle).
   * @param az - Look azimuth in degrees
   * @param el - Look elevation in degrees
   */
  isWithinScan(az: Degrees, el: Degrees): boolean {
    return this.scanAngleTo(az, el) <= this.maxScanAngle;
  }

  /**
   * Gain change relative to peak at a given scan angle: 10 n log10(cos(theta + pointingError)) inside
   * the scan limit, and (sidelobeFloor - gain) beyond it. The argument is the SCAN angle from the
   * panel normal, not the off-boresight angle of a beamwidth pattern.
   *
   * @param scanAngleDegrees - Scan angle from the panel normal in degrees
   * @returns Gain change in dB relative to broadside
   */
  getOffAxisLoss(scanAngleDegrees: number): Decibels {
    // Signed angles are symmetric about broadside, so the scan limit applies to the magnitude.
    const scan = Math.abs(scanAngleDegrees);

    if (scan > this.maxScanAngle) {
      return (this.sidelobeFloor - this.gain) as Decibels;
    }
    const c = Math.cos((scan + this.pointingError) * DEG2RAD);

    if (c <= 0) {
      return (this.sidelobeFloor - this.gain) as Decibels;
    }

    // Never below the sidelobe floor inside the scan limit, so the gain does not dip under the floor
    // (e.g. a 5 dBi peak scanned to 89 degrees) and then jump up past maxScanAngle.
    return Math.max(10 * this.scanLossExponent * Math.log10(c), this.sidelobeFloor - this.gain) as Decibels;
  }

  /**
   * Gain toward a look direction in the local ENU frame: G0 + scan loss inside maxScanAngle, the
   * sidelobe floor outside it or when the target is behind the panel.
   *
   * @param lookAz - Look azimuth in degrees (clockwise from north)
   * @param lookEl - Look elevation in degrees above the horizon
   * @returns Gain in dBi
   */
  getGainToward(lookAz: Degrees, lookEl: Degrees): Decibels {
    return this.getEffectiveGain(this.scanAngleTo(lookAz, lookEl));
  }

  override clone(): PhasedArrayAntenna {
    return new PhasedArrayAntenna(this.params_());
  }

  override serialize(): SerializedPhasedArrayAntenna {
    return {
      ...super.serialize(),
      type: 'phased-array',
      normalAz: this.normalAz,
      normalEl: this.normalEl,
      maxScanAngle: this.maxScanAngle,
      scanLossExponent: this.scanLossExponent,
      sidelobeFloor: this.sidelobeFloor,
      pointingError: this.pointingError,
    };
  }

  /**
   * Creates a PhasedArrayAntenna from serialized data.
   * @param data - Output of {@link PhasedArrayAntenna.serialize}
   */
  static deserialize(data: SerializedPhasedArrayAntenna): PhasedArrayAntenna {
    return new PhasedArrayAntenna({
      gain: data.gain,
      beamwidth: data.beamwidth,
      efficiency: data.efficiency,
      normalAz: data.normalAz,
      normalEl: data.normalEl,
      maxScanAngle: data.maxScanAngle,
      scanLossExponent: data.scanLossExponent,
      sidelobeFloor: data.sidelobeFloor,
      pointingError: data.pointingError,
    });
  }

  override toString(): string {
    return [
      '[PhasedArrayAntenna]',
      `  Peak gain: ${this.gain.toFixed(1)} dBi`,
      `  Normal: az ${this.normalAz.toFixed(1)}°, el ${this.normalEl.toFixed(1)}°`,
      `  Max scan: ${this.maxScanAngle.toFixed(1)}°, exponent ${this.scanLossExponent}`,
      `  Sidelobe floor: ${this.sidelobeFloor.toFixed(1)} dBi`,
      `  Pointing error: ${this.pointingError.toFixed(2)}°`,
    ].join('\n');
  }

  private params_(): PhasedArrayAntennaParams {
    return {
      gain: this.gain,
      beamwidth: this.beamwidth,
      efficiency: this.efficiency,
      normalAz: this.normalAz,
      normalEl: this.normalEl,
      maxScanAngle: this.maxScanAngle,
      scanLossExponent: this.scanLossExponent,
      sidelobeFloor: this.sidelobeFloor,
      pointingError: this.pointingError,
    };
  }
}

/**
 * Deserializes any antenna, dispatching on the `type` discriminator: `'phased-array'` produces a
 * {@link PhasedArrayAntenna}, `'gnss'` a {@link GnssAntenna} (keeping its elevation-gain table),
 * anything else a plain {@link Antenna}.
 * @param data - Serialized antenna
 * @returns The reconstructed antenna
 */
export function deserializeAntenna(data: SerializedAntenna | SerializedPhasedArrayAntenna | SerializedGnssAntenna): Antenna {
  if ('type' in data && data.type === 'phased-array') {
    return PhasedArrayAntenna.deserialize(data);
  }
  if ('type' in data && data.type === 'gnss') {
    return GnssAntenna.deserialize(data);
  }

  return Antenna.deserialize(data);
}
