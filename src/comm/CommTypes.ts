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

import type { GroundObject } from '../objects/GroundObject';
import type { SpaceObject } from '../objects/SpaceObject';
import type { Degrees, Kilometers } from '../types/types';

// ==================== Unit Type Aliases ====================

/** Frequency in Hertz */
export type Hertz = number & { _brand: 'Hertz' };

/** Power in Watts */
export type Watts = number & { _brand: 'Watts' };

/** Power in decibels relative to 1 milliwatt */
export type Dbm = number & { _brand: 'Dbm' };

/** Power in decibels relative to 1 watt */
export type Dbw = number & { _brand: 'Dbw' };

/** Gain or loss in decibels */
export type Decibels = number & { _brand: 'Decibels' };

// ==================== Enums ====================

/**
 * Modulation types for communication signals.
 */
export enum ModulationType {
  /** Binary Phase Shift Keying */
  BPSK = 'BPSK',
  /** Quadrature Phase Shift Keying */
  QPSK = 'QPSK',
  /** 8-Phase Shift Keying */
  PSK8 = '8PSK',
  /** 16-Quadrature Amplitude Modulation */
  QAM16 = '16QAM',
  /** 64-Quadrature Amplitude Modulation */
  QAM64 = '64QAM',
  /** Frequency Modulation */
  FM = 'FM',
  /** Amplitude Modulation */
  AM = 'AM',
  /** On-Off Keying */
  OOK = 'OOK',
  /** Gaussian Minimum Shift Keying */
  GMSK = 'GMSK',
  /** Offset QPSK */
  OQPSK = 'OQPSK',
}

/**
 * Communication device types for classification.
 */
export enum CommDeviceType {
  TRANSMITTER = 'TRANSMITTER',
  RECEIVER = 'RECEIVER',
  TRANSPONDER = 'TRANSPONDER',
  BEACON = 'BEACON',
}

// ==================== Interfaces ====================

/**
 * Union type representing valid communication device platforms.
 * Devices can be mounted on ground objects (stations) or space objects (satellites).
 */
export type CommPlatform = GroundObject | SpaceObject;

/**
 * Link budget calculation result.
 * All values in decibels unless otherwise noted.
 */
export interface LinkBudget {
  /** Effective Isotropic Radiated Power (dBW) */
  eirp: Dbw;
  /** Free Space Path Loss (dB) - positive value representing loss */
  fspl: Decibels;
  /** Received power at receiver input (dBW) */
  receivedPower: Dbw;
  /** Signal-to-Noise Ratio (dB) */
  snr: Decibels;
  /** Distance between transmitter and receiver (km) */
  distance: number;
  /** Frequency used for calculation (Hz) */
  frequency: Hertz;
  /** Transmit antenna gain toward the receiver (dBi). Peak gain unless the antenna has a pattern. */
  txAntennaGain?: Decibels;
  /** Receive antenna gain toward the transmitter (dBi). Peak gain unless the antenna has a pattern. */
  rxAntennaGain?: Decibels;
  /** Additional loss terms applied (fixed caller terms, then model terms), each a positive loss in dB */
  losses?: LinkLossTerm[];
  /** Sum of `losses` (dB, positive = loss) */
  totalAdditionalLoss?: Decibels;
  /** Geometry the budget was computed from */
  geometry?: LinkGeometry;
}

/** One named loss contribution to a link budget. */
export interface LinkLossTerm {
  /** Label, for example "rain" or "pointing" */
  name: string;
  /** Loss in dB; positive reduces received power */
  db: Decibels;
}

/** Look direction and position of a ground-mounted link end. */
export interface LinkEndGeometry {
  /** Azimuth from this end toward the other end (deg, clockwise from north) */
  lookAz: Degrees;
  /** Elevation from this end toward the other end (deg above local horizon) */
  lookEl: Degrees;
  /** Geodetic latitude of this end (deg) */
  latitude: Degrees;
  /** Altitude above the WGS84 ellipsoid (km) */
  altitude: Kilometers;
}

/**
 * Geometry between the two ends of a link, computed once per link budget call.
 * An end that is a space platform has no entry (its body-frame attitude is not modelled).
 */
export interface LinkGeometry {
  /** Straight-line distance between the ends (km) */
  distance: Kilometers;
  /** Transmit end geometry, present only when the transmitter is on a ground object */
  tx?: LinkEndGeometry;
  /** Receive end geometry, present only when the receiver is on a ground object */
  rx?: LinkEndGeometry;
}

/**
 * Function producing extra loss terms (atmosphere, rain, ...) for a link.
 * @param geometry - Link geometry for this call
 * @param frequency - Carrier frequency in Hz
 * @returns Loss terms in dB (positive = loss)
 */
export type LinkLossModel = (geometry: LinkGeometry, frequency: Hertz) => LinkLossTerm[];

/** Options for `Transmitter.calculateLinkBudget`. */
export interface LinkBudgetOptions {
  /** Fixed caller-supplied loss terms */
  losses?: LinkLossTerm[];
  /** Models evaluated against the link geometry; their terms follow the fixed terms */
  lossModels?: LinkLossModel[];
}

/**
 * Relay link budget for transponder relay calculations.
 * Includes both uplink and downlink budgets.
 */
export interface RelayLinkBudget {
  /** Uplink budget (ground to satellite) */
  uplink: LinkBudget;
  /** Downlink budget (satellite to ground) */
  downlink: LinkBudget;
  /** Overall end-to-end SNR (dB) */
  endToEndSnr: Decibels;
  /** Total propagation delay including transponder delay (seconds) */
  totalDelay: number;
}

/**
 * Serialized representation of a communication device.
 */
export interface SerializedCommDevice {
  /** The class name of the device */
  type: string;
  /** Unique identifier */
  id: number;
  /** Human-readable name */
  name: string;
  /** Device type classification */
  deviceType: CommDeviceType;
  /** Parent platform ID (reference only, not full object) */
  parentId?: number;
  /** Additional type-specific data */
  [key: string]: unknown;
}

/**
 * Serialized representation of an antenna.
 */
export interface SerializedAntenna {
  /** Antenna gain in dB */
  gain: Decibels;
  /** Beamwidth in degrees (optional) */
  beamwidth?: number;
  /** Efficiency factor 0-1 (optional) */
  efficiency?: number;
}

// ==================== Conversion Utilities ====================

/**
 * Converts Watts to dBW.
 * @param watts - Power in Watts
 * @returns Power in dBW
 */
export function wattsToDbw(watts: Watts): Dbw {
  return (10 * Math.log10(watts)) as Dbw;
}

/**
 * Converts dBW to Watts.
 * @param dbw - Power in dBW
 * @returns Power in Watts
 */
export function dbwToWatts(dbw: Dbw): Watts {
  return (10 ** (dbw / 10)) as Watts;
}

/**
 * Converts dBm to dBW.
 * @param dbm - Power in dBm
 * @returns Power in dBW
 */
export function dbmToDbw(dbm: Dbm): Dbw {
  return (dbm - 30) as Dbw;
}

/**
 * Converts dBW to dBm.
 * @param dbw - Power in dBW
 * @returns Power in dBm
 */
export function dbwToDbm(dbw: Dbw): Dbm {
  return (dbw + 30) as Dbm;
}

/**
 * Calculates Free Space Path Loss (Friis).
 * FSPL = 20*log10(4*pi*d*f/c)
 * With d in metres and c in m/s: FSPL(dB) = 20*log10(d_m) + 20*log10(f_Hz) - 147.55.
 * With d in kilometres (this function): FSPL(dB) = 20*log10(d_km) + 20*log10(f_Hz) - 87.55,
 * since 20*log10(1000) = 60. Example: 1000 km at 1 GHz is 152.45 dB.
 *
 * @param distanceKm - Distance in kilometers
 * @param frequencyHz - Frequency in Hertz
 * @returns Free space path loss in dB (positive value)
 */
export function calculateFspl(distanceKm: number, frequencyHz: Hertz): Decibels {
  // FSPL = 20*log10(d_m) + 20*log10(f) - 147.55 (for meters)
  // For kilometers: FSPL = 20*log10(d_km) + 20*log10(f) - 87.55
  // Derivation: 20*log10(d_km*1000) = 20*log10(d_km) + 60
  const fspl = 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyHz) - 87.55;

  return fspl as Decibels;
}

/**
 * Speed of light in km/s for delay calculations.
 */
export const SPEED_OF_LIGHT_KM_S = 299792.458;

/**
 * Calculates propagation delay for a given distance.
 * @param distanceKm - Distance in kilometers
 * @returns Delay in seconds
 */
export function calculatePropagationDelay(distanceKm: number): number {
  return distanceKm / SPEED_OF_LIGHT_KM_S;
}
