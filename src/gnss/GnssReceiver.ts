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
import type { GroundObject } from '../objects/GroundObject';
import type { SpaceObject } from '../objects/SpaceObject';
import { type DilutionOfPrecision, calculateDop } from './dop';
import { GnssAntenna, type SerializedGnssAntenna } from './GnssAntenna';
import { GNSS_SIGNALS, type GnssSignal } from './GnssSignal';
import {
  BOLTZMANN_J_PER_K,
  type GnssInterferer,
  type GnssNoiseSpec,
  calculateCn0,
  calculateEffectiveCn0,
  calculateInterfererAtReceiver,
  systemNoiseTemperatureK,
} from './link';

/** Default carrier tracking threshold, 28 dB-Hz (Kaplan and Hegarty 2006, p. 264). */
export const DEFAULT_TRACKING_THRESHOLD_DBHZ = 28;

/** Per-satellite tracking state. */
export type GnssTrackState =
  /** Not visible: below the elevation mask or no position at this time. */
  | 'unseen'
  /** Visible but not locked. */
  | 'lost'
  /** Locked. */
  | 'tracking';

/** A satellite offered to the receiver. */
export interface GnssSatellite {
  /** Stable identifier used to carry tracking state between steps (e.g. NORAD number or PRN). */
  id: string;
  /** The satellite; its `rae()` from the receiver is used for look angles. */
  object: SpaceObject;
  /** Power offset in dB added to the received signal (default 0), see `calculateSignalPower`. */
  powerOffsetDb?: number;
}

/** Parameters for {@link GnssReceiver}. */
export interface GnssReceiverParams {
  /** Signal tracked. */
  signal: GnssSignal;
  /** Receive antenna. */
  antenna: GnssAntenna;
  /** System noise, directly or from noise figure and antenna temperature. */
  noise: GnssNoiseSpec;
  /**
   * C/N0 in dB-Hz above which an unlocked satellite can be acquired. Required: no published
   * default exists, it depends on the receiver. Must be at least the tracking threshold.
   */
  acquisitionThresholdDbHz: number;
  /** C/N0 in dB-Hz below which a locked satellite is lost. Default 28 (Kaplan and Hegarty 2006, p. 264). */
  trackingThresholdDbHz?: number;
  /** Elevation mask in degrees. Default: the signal's `minimumElevationDeg`. */
  elevationMaskDeg?: number;
  /** Receiver implementation loss in dB (positive = loss). Default 0. */
  implementationLossDb?: number;
  /** Receiver front-end bandwidth in Hz. Default: the signal's `defaultReceiverBandwidthHz`. */
  receiverBandwidthHz?: number;
  /** Seconds C/N0 must stay above the acquisition threshold before lock. Default 0 (immediate). */
  reacquisitionTimeSec?: number;
  /** Satellites needed for a fix. Default 4. */
  minSatellitesForFix?: number;
  /** Largest PDOP that still counts as a fix. Default: no limit. */
  maxPdop?: number;
}

/** Serialized form of a {@link GnssReceiver}'s configuration (tracking state is not included). */
export interface SerializedGnssReceiver {
  /** Id of a signal in `GNSS_SIGNALS`. */
  signalId: string;
  /** Receive antenna. */
  antenna: SerializedGnssAntenna;
  /** System noise temperature in K. */
  systemTemperatureK: number;
  /** Acquisition threshold in dB-Hz. */
  acquisitionThresholdDbHz: number;
  /** Tracking threshold in dB-Hz. */
  trackingThresholdDbHz: number;
  /** Elevation mask in degrees. */
  elevationMaskDeg: number;
  /** Implementation loss in dB. */
  implementationLossDb: number;
  /** Receiver bandwidth in Hz. */
  receiverBandwidthHz: number;
  /** Reacquisition time in seconds. */
  reacquisitionTimeSec: number;
  /** Satellites needed for a fix. */
  minSatellitesForFix: number;
  /** Maximum PDOP, or null for no limit. */
  maxPdop: number | null;
}

/** Per-satellite result of a step. */
export interface GnssSatelliteStatus {
  /** Satellite id. */
  id: string;
  /** Tracking state after this step. */
  state: GnssTrackState;
  /** Azimuth in degrees, or null when no position. */
  az: number | null;
  /** Elevation in degrees, or null when no position. */
  el: number | null;
  /** Range in km, or null. */
  rangeKm: number | null;
  /** Unjammed C/N0 in dB-Hz, or null when unseen. */
  cn0DbHz: number | null;
  /** C/N0 including interference in dB-Hz, or null when unseen. */
  effectiveCn0DbHz: number | null;
}

/** Result of {@link GnssReceiver.step}. */
export interface GnssStepResult {
  /** Time of the step. */
  date: Date;
  /** One entry per input satellite, in input order. */
  satellites: GnssSatelliteStatus[];
  /** Number of satellites in the `tracking` state. */
  trackedCount: number;
  /** DOP of the tracked satellites (all Infinity with too few or singular geometry). */
  dop: DilutionOfPrecision;
  /** True when a position fix is available. */
  hasFix: boolean;
  /**
   * Seconds since the receiver last had a fix: 0 while it has one, null if it never has.
   * Holdover modelling is out of scope; this is the input a holdover model needs.
   */
  timeSinceLastFixSec: number | null;
}

/**
 * A stepped GNSS receiver: per-satellite C/N0 with interference, lock hysteresis, and a fix flag.
 *
 * Call {@link GnssReceiver.step} with non-decreasing times. A tracked satellite is kept while its
 * effective C/N0 stays at or above the tracking threshold; an unlocked one is acquired only when
 * it reaches the (higher) acquisition threshold, held for `reacquisitionTimeSec`. The fix needs
 * `minSatellitesForFix` tracked satellites with finite DOP, and PDOP at most `maxPdop` if set.
 */
export class GnssReceiver {
  readonly signal: GnssSignal;
  readonly antenna: GnssAntenna;
  readonly systemTemperatureK: number;
  readonly acquisitionThresholdDbHz: number;
  readonly trackingThresholdDbHz: number;
  readonly elevationMaskDeg: number;
  readonly implementationLossDb: number;
  readonly receiverBandwidthHz: number;
  readonly reacquisitionTimeSec: number;
  readonly minSatellitesForFix: number;
  readonly maxPdop: number;

  private tracked_ = new Set<string>();
  private acquireTimers_ = new Map<string, number>();
  private lastDate_: Date | null = null;
  private lastFixDate_: Date | null = null;

  constructor(params: GnssReceiverParams) {
    this.signal = params.signal;
    this.antenna = params.antenna;
    this.systemTemperatureK = systemNoiseTemperatureK(params.noise);
    this.trackingThresholdDbHz = params.trackingThresholdDbHz ?? DEFAULT_TRACKING_THRESHOLD_DBHZ;
    this.acquisitionThresholdDbHz = params.acquisitionThresholdDbHz;
    this.elevationMaskDeg = params.elevationMaskDeg ?? params.signal.minimumElevationDeg;
    this.implementationLossDb = params.implementationLossDb ?? 0;
    this.receiverBandwidthHz = params.receiverBandwidthHz ?? params.signal.defaultReceiverBandwidthHz;
    this.reacquisitionTimeSec = params.reacquisitionTimeSec ?? 0;
    this.minSatellitesForFix = params.minSatellitesForFix ?? 4;
    this.maxPdop = params.maxPdop ?? Infinity;

    if (!Number.isFinite(this.acquisitionThresholdDbHz) || !Number.isFinite(this.trackingThresholdDbHz)) {
      throw new ValidationError('Thresholds must be finite', 'acquisitionThresholdDbHz', this.acquisitionThresholdDbHz);
    }
    if (this.acquisitionThresholdDbHz < this.trackingThresholdDbHz) {
      throw new ValidationError('Acquisition threshold must be at least the tracking threshold', 'acquisitionThresholdDbHz', this.acquisitionThresholdDbHz);
    }
    if (!(this.receiverBandwidthHz > 0)) {
      throw new ValidationError('Receiver bandwidth must be positive', 'receiverBandwidthHz', this.receiverBandwidthHz);
    }
    if (!(this.reacquisitionTimeSec >= 0)) {
      throw new ValidationError('Reacquisition time must be non-negative', 'reacquisitionTimeSec', this.reacquisitionTimeSec);
    }
    if (!Number.isInteger(this.minSatellitesForFix) || this.minSatellitesForFix < 4) {
      throw new ValidationError('At least 4 satellites are needed for a fix', 'minSatellitesForFix', this.minSatellitesForFix);
    }
    if (!(this.maxPdop > 0)) {
      throw new ValidationError('maxPdop must be positive', 'maxPdop', this.maxPdop);
    }
  }

  /** Forgets all tracking state, as after a power cycle. */
  reset(): void {
    this.tracked_.clear();
    this.acquireTimers_.clear();
    this.lastDate_ = null;
    this.lastFixDate_ = null;
  }

  /**
   * Advances the receiver to `date`.
   * @param date - Step time; must not be earlier than the previous step.
   * @param receiver - Receiver location (a ground object; moving ones are evaluated at `date`).
   * @param satellites - Satellites offered this step.
   * @param interferers - Active interferers (default none).
   * @returns Per-satellite status, DOP and fix state.
   * @throws ValidationError if time goes backwards or the receiver has no position at `date`.
   */
  step(date: Date, receiver: GroundObject, satellites: readonly GnssSatellite[], interferers: readonly GnssInterferer[] = []): GnssStepResult {
    if (this.lastDate_ && date.getTime() < this.lastDate_.getTime()) {
      throw new ValidationError('Step time must not go backwards', 'date', date);
    }
    const dt = this.lastDate_ ? (date.getTime() - this.lastDate_.getTime()) / 1000 : 0;
    const lla = receiver.llaAt(date);

    if (!lla) {
      throw new ValidationError('Receiver has no position at this time', 'receiver', receiver);
    }

    const jammers = interferers.map((j) => calculateInterfererAtReceiver(j, lla, this.antenna, this.signal, this.receiverBandwidthHz, date));
    const noiseDbw = 10 * Math.log10(BOLTZMANN_J_PER_K * this.systemTemperatureK);
    const statuses: GnssSatelliteStatus[] = [];
    const lookAngles: { az: number; el: number }[] = [];

    for (const sat of satellites) {
      const rae = sat.object.rae(receiver, date);

      if (!rae || rae.el < this.elevationMaskDeg) {
        this.tracked_.delete(sat.id);
        this.acquireTimers_.delete(sat.id);
        statuses.push({
          id: sat.id,
          state: 'unseen',
          az: rae ? rae.az : null,
          el: rae ? rae.el : null,
          rangeKm: rae ? rae.rng : null,
          cn0DbHz: null,
          effectiveCn0DbHz: null,
        });
        continue;
      }

      const gain = this.antenna.getGainToward(rae.az, rae.el);
      const cn0 = calculateCn0(
        { signal: this.signal, rxGainDbic: gain, implementationLossDb: this.implementationLossDb, powerOffsetDb: sat.powerOffsetDb },
        this.systemTemperatureK,
      );
      // C = C/N0 + N0 (dBW); J/C in dB for each in-band interferer.
      const cDbw = cn0 + noiseDbw;
      const terms = jammers.filter((j) => j.inBandFraction > 0).map((j) => ({ jOverCDb: j.jammerPowerDbw - cDbw, q: j.q }));
      const eff = calculateEffectiveCn0(cn0, terms, this.signal.chipRateHz);

      if (this.tracked_.has(sat.id)) {
        if (eff < this.trackingThresholdDbHz) {
          this.tracked_.delete(sat.id);
        }
      } else if (eff >= this.acquisitionThresholdDbHz) {
        const held = (this.acquireTimers_.get(sat.id) ?? 0) + dt;

        if (held >= this.reacquisitionTimeSec) {
          this.tracked_.add(sat.id);
          this.acquireTimers_.delete(sat.id);
        } else {
          this.acquireTimers_.set(sat.id, held);
        }
      } else {
        this.acquireTimers_.delete(sat.id);
      }

      const isTracked = this.tracked_.has(sat.id);

      if (isTracked) {
        lookAngles.push({ az: rae.az, el: rae.el });
      }
      statuses.push({
        id: sat.id,
        state: isTracked ? 'tracking' : 'lost',
        az: rae.az,
        el: rae.el,
        rangeKm: rae.rng,
        cn0DbHz: cn0,
        effectiveCn0DbHz: eff,
      });
    }

    const dop = calculateDop(lookAngles);
    const hasFix = lookAngles.length >= this.minSatellitesForFix && Number.isFinite(dop.pdop) && dop.pdop <= this.maxPdop;

    if (hasFix) {
      this.lastFixDate_ = date;
    }
    this.lastDate_ = date;

    return {
      date,
      satellites: statuses,
      trackedCount: lookAngles.length,
      dop,
      hasFix,
      timeSinceLastFixSec: this.lastFixDate_ ? (date.getTime() - this.lastFixDate_.getTime()) / 1000 : null,
    };
  }

  /** Configuration snapshot; tracking state is not included. */
  serialize(): SerializedGnssReceiver {
    return {
      signalId: this.signal.id,
      antenna: this.antenna.serialize(),
      systemTemperatureK: this.systemTemperatureK,
      acquisitionThresholdDbHz: this.acquisitionThresholdDbHz,
      trackingThresholdDbHz: this.trackingThresholdDbHz,
      elevationMaskDeg: this.elevationMaskDeg,
      implementationLossDb: this.implementationLossDb,
      receiverBandwidthHz: this.receiverBandwidthHz,
      reacquisitionTimeSec: this.reacquisitionTimeSec,
      minSatellitesForFix: this.minSatellitesForFix,
      maxPdop: Number.isFinite(this.maxPdop) ? this.maxPdop : null,
    };
  }

  /**
   * Rebuilds a receiver from {@link GnssReceiver.serialize} output.
   * @param data - Serialized configuration.
   * @returns The receiver, with no tracking state.
   * @throws ValidationError if the signal id is not in `GNSS_SIGNALS`.
   */
  static deserialize(data: SerializedGnssReceiver): GnssReceiver {
    const signal = GNSS_SIGNALS[data.signalId];

    if (!signal) {
      throw new ValidationError('Unknown GNSS signal id', 'signalId', data.signalId);
    }

    return new GnssReceiver({
      signal,
      antenna: GnssAntenna.deserialize(data.antenna),
      noise: { systemTemperatureK: data.systemTemperatureK },
      acquisitionThresholdDbHz: data.acquisitionThresholdDbHz,
      trackingThresholdDbHz: data.trackingThresholdDbHz,
      elevationMaskDeg: data.elevationMaskDeg,
      implementationLossDb: data.implementationLossDb,
      receiverBandwidthHz: data.receiverBandwidthHz,
      reacquisitionTimeSec: data.reacquisitionTimeSec,
      minSatellitesForFix: data.minSatellitesForFix,
      maxPdop: data.maxPdop ?? undefined,
    });
  }
}
