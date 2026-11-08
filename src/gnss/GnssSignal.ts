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

import type { Dbw } from '../comm/CommTypes';

/** Provenance of a preset value. */
export type GnssSourceQuality = 'primary' | 'secondary';

/**
 * How a signal's interference susceptibility is modelled.
 *
 * - `bpsk-r`: rectangular-chip BPSK, power spectral density S(f) = Tc sinc^2(f Tc). Jamming
 *   resistance factors Q are computed from the spectrum (Kaplan and Hegarty 2006, Eqs. 6.13, 6.15,
 *   6.17).
 * - `boc`: binary offset carrier or its multiplexed variants. No spectrum model is included; Q is
 *   taken from the fixed values in `q`.
 */
export type GnssModulation =
  | { kind: 'bpsk-r' }
  | {
      kind: 'boc';
      /**
       * Q by jammer type. The values used by the presets are the LOWER ends (most damaging) of the
       * ranges Kaplan and Hegarty (2006, pp. 259 to 261) give for BOC(m,n) signals in general:
       * narrowband at a spectral peak 1.9 to 2.5, matched spectrum 3 to 4.5, bandlimited white
       * noise null-to-null 4.6 to 5.5. They are not computed for the specific multiplex.
       */
      q: { narrowband: number; matched: number; bandlimitedNoise: number };
    };

/**
 * A GNSS signal definition: carrier, spreading, and the minimum received power the signal's
 * interface document guarantees.
 *
 * The minimum received power is specified at the output of a stated reference antenna. This model
 * keeps that antenna as {@link referenceAntennaGainDbic}, the gain of the reference antenna toward
 * a right-hand circularly polarized (RHCP) wave. The GPS ICDs specify a 3 dBi LINEARLY polarized
 * antenna at worst orientation; against an RHCP wave a linear antenna has a 3 dB polarization
 * mismatch, so its gain is 3 - 3 = 0 dBic. This is the reading Kaplan and Hegarty (2006, p. 262)
 * use: they add the receiving antenna's dBic gain directly to the -158.5 dBW L1 C/A minimum.
 * The received signal power for an antenna of gain G dBic is then
 * `minimumReceivedPowerDbw - referenceAntennaGainDbic + G`.
 */
export interface GnssSignal {
  /** Short identifier, e.g. `'gps-l1ca'`. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Nominal carrier (center) frequency in Hz. */
  readonly carrierFrequencyHz: number;
  /** Spreading code chipping rate Rc in chips per second. */
  readonly chipRateHz: number;
  /** Spectral model used to derive jamming resistance factors Q. */
  readonly modulation: GnssModulation;
  /** Minimum guaranteed received signal power at the reference antenna output, dBW. */
  readonly minimumReceivedPowerDbw: Dbw;
  /** Gain of the reference antenna toward an RHCP wave, dBic (see interface note). */
  readonly referenceAntennaGainDbic: number;
  /** Elevation above which the minimum power is guaranteed, degrees. */
  readonly minimumElevationDeg: number;
  /**
   * Default receiver front-end bandwidth in Hz, used to decide how much of an interferer's power
   * is in band. Override per receiver.
   */
  readonly defaultReceiverBandwidthHz: number;
  /** Where the numbers come from, with document, table and page. */
  readonly source: string;
  /**
   * `'primary'` when {@link minimumReceivedPowerDbw} and its reference antenna were read from the
   * interface document; `'secondary'` when taken from another publication or a summary.
   */
  readonly sourceQuality: GnssSourceQuality;
}

const MHZ = 1e6;

/**
 * GPS L1 C/A. Minimum received power -158.5 dBW for Block IIR, IIR-M, IIF, GPS III and IIIF.
 * Source: IS-GPS-200N (01-AUG-2022) Table 3-Va, p. 16, and Para. 3.3.1.6, p. 15: measured at the
 * output of a 3 dBi linearly polarized antenna at worst orientation, SV above 5 degrees. Chip rate
 * 1.023 Mcps and 20.46 MHz in-band allocation: Para. 3.3.1.1. Primary.
 */
export const GPS_L1_CA: GnssSignal = Object.freeze<GnssSignal>({
  id: 'gps-l1ca',
  name: 'GPS L1 C/A',
  carrierFrequencyHz: 1575.42 * MHZ,
  chipRateHz: 1.023 * MHZ,
  modulation: { kind: 'bpsk-r' },
  minimumReceivedPowerDbw: -158.5 as Dbw,
  referenceAntennaGainDbic: 0,
  minimumElevationDeg: 5,
  defaultReceiverBandwidthHz: 20.46 * MHZ,
  source: 'IS-GPS-200N Table 3-Va p.16, Para 3.3.1.6 p.15 (3 dBi linear antenna = 0 dBic); chip rate and 20.46 MHz band Para 3.3.1.1',
  sourceQuality: 'primary',
});

/**
 * GPS L2C (CM/CL). Minimum received power -160.0 dBW for Block IIR-M and IIF (the GPS III and IIIF
 * value is -158.5 dBW). Source: IS-GPS-200N Table 3-Va, p. 16 ("C/A or L2C" column, L2 row). Same
 * reference antenna as L1. Composite chip rate 1.023 Mcps as used for L2C by Kaplan and Hegarty
 * (2006, p. 261). Primary for the power; the 2.046 MHz receiver bandwidth is an assumption
 * (2 x Rc, null to null).
 */
export const GPS_L2C: GnssSignal = Object.freeze<GnssSignal>({
  id: 'gps-l2c',
  name: 'GPS L2C',
  carrierFrequencyHz: 1227.6 * MHZ,
  chipRateHz: 1.023 * MHZ,
  modulation: { kind: 'bpsk-r' },
  minimumReceivedPowerDbw: -160 as Dbw,
  referenceAntennaGainDbic: 0,
  minimumElevationDeg: 5,
  defaultReceiverBandwidthHz: 2.046 * MHZ,
  source: 'IS-GPS-200N Table 3-Va p.16 (IIR-M/IIF L2, C/A or L2C column); Rc per Kaplan 2006 p.261; receiver bandwidth assumed',
  sourceQuality: 'primary',
});

/**
 * GPS L1C (composite of L1CD data and L1CP pilot). Minimum received power -157.0 dBW terrestrial
 * for the composite signal (pilot -158.25 dBW, data -163 dBW, read in IS-GPS-800H Table 3.2-1). A
 * receiver that tracks only the L1CP pilot sees about -158.25 dBW, 1.25 dB below the composite value
 * used here, so subtract that from a pilot-only C/N0 budget (use `powerOffsetDb`). Source: IS-GPS-800H (13 Apr 2021)
 * Table 3.2-1, p. 7, and Para. 3.2.1.9, p. 6: 3 dBi linearly polarized antenna, SV above 5
 * degrees, 0.5 dB atmospheric loss assumed. Chip rate 1.023 Mcps, 30.69 MHz band (Para. 3.2.1.1).
 * Modulation BOC(1,1) data and TMBOC pilot; Q values are the lower bounds of Kaplan's BOC ranges
 * (approximation, see {@link GnssModulation}). Primary for the power.
 */
export const GPS_L1C: GnssSignal = Object.freeze<GnssSignal>({
  id: 'gps-l1c',
  name: 'GPS L1C',
  carrierFrequencyHz: 1575.42 * MHZ,
  chipRateHz: 1.023 * MHZ,
  modulation: { kind: 'boc', q: { narrowband: 1.9, matched: 3, bandlimitedNoise: 4.6 } },
  minimumReceivedPowerDbw: -157 as Dbw,
  referenceAntennaGainDbic: 0,
  minimumElevationDeg: 5,
  defaultReceiverBandwidthHz: 30.69 * MHZ,
  source: 'IS-GPS-800H Table 3.2-1 p.7, Para 3.2.1.9 p.6 (3 dBi linear antenna = 0 dBic); Q lower bounds of Kaplan 2006 pp.259-261 BOC ranges',
  sourceQuality: 'primary',
});

/**
 * GPS L5 (per I5 or Q5 channel). Minimum received power -157.9 dBW per channel for Block IIF
 * (-157.0 dBW for GPS III and IIIF). Source: IS-GPS-705J (01-AUG-2022) Table 3-III, p. 11, and
 * Para. 3.3.1.6, p. 10: 3 dBi linearly polarized antenna, SV above 5 degrees. Chip rate
 * 10.23 Mcps, 24 MHz band: Para. 3.3.1.1. Primary.
 */
export const GPS_L5: GnssSignal = Object.freeze<GnssSignal>({
  id: 'gps-l5',
  name: 'GPS L5',
  carrierFrequencyHz: 1176.45 * MHZ,
  chipRateHz: 10.23 * MHZ,
  modulation: { kind: 'bpsk-r' },
  minimumReceivedPowerDbw: -157.9 as Dbw,
  referenceAntennaGainDbic: 0,
  minimumElevationDeg: 5,
  defaultReceiverBandwidthHz: 24 * MHZ,
  source: 'IS-GPS-705J Table 3-III p.11, Para 3.3.1.6 p.10 (3 dBi linear antenna = 0 dBic); Para 3.3.1.1 (24 MHz band, 10.23 Mcps)',
  sourceQuality: 'primary',
});

/**
 * Galileo E1 Open Service (E1-B and E1-C combined). Minimum received power -157.25 dBW at an ideally
 * matched 0 dBi RHCP antenna, user elevation above 5 degrees. Source: Galileo OS SIS ICD Issue 2.1
 * (Nov 2023), Table 12, p. 13, read directly: "E1-B/C (total B+C)" minimum -157.25 dBW, maximum
 * -152 dBW, for user elevation angles above 5 degrees, measured at the output of an ideally matched
 * RHCP 0 dBi user antenna. Secondary because the bandwidth is assumed. CBOC(6,1,1/11) modulation; Q values are the lower bounds of Kaplan's BOC
 * ranges (approximation). Receiver bandwidth 24.552 MHz is an assumption (the E1 reference band
 * of the ICD is not verified here).
 */
export const GALILEO_E1_OS: GnssSignal = Object.freeze<GnssSignal>({
  id: 'galileo-e1-os',
  name: 'Galileo E1 OS',
  carrierFrequencyHz: 1575.42 * MHZ,
  chipRateHz: 1.023 * MHZ,
  modulation: { kind: 'boc', q: { narrowband: 1.9, matched: 3, bandlimitedNoise: 4.6 } },
  minimumReceivedPowerDbw: -157.25 as Dbw,
  referenceAntennaGainDbic: 0,
  minimumElevationDeg: 5,
  defaultReceiverBandwidthHz: 24.552 * MHZ,
  source: 'Galileo OS SIS ICD v2.1 Table 12 p.13 (E1-B/C total -157.25 dBW, above 5 deg, ideally matched RHCP 0 dBi; read); bandwidth assumed; Q per Kaplan BOC lower bounds',
  sourceQuality: 'secondary',
});

/**
 * GLONASS L1OF (nominal center 1602 MHz, channel k = 0; each channel adds k x 562.5 kHz).
 * Minimum received power -161 dBW from ITU-R M.1317 as cited in earlier project research; the
 * reference antenna is assumed to be 0 dBic and the GLONASS ICD was not read. Chip rate 0.511 Mcps.
 * Secondary.
 */
export const GLONASS_L1OF: GnssSignal = Object.freeze<GnssSignal>({
  id: 'glonass-l1of',
  name: 'GLONASS L1OF',
  carrierFrequencyHz: 1602 * MHZ,
  chipRateHz: 0.511 * MHZ,
  modulation: { kind: 'bpsk-r' },
  minimumReceivedPowerDbw: -161 as Dbw,
  referenceAntennaGainDbic: 0,
  minimumElevationDeg: 5,
  defaultReceiverBandwidthHz: 1.022 * MHZ,
  source: 'ITU-R M.1317 via project research notes (GLONASS ICD not read); reference antenna and bandwidth assumed',
  sourceQuality: 'secondary',
});

/**
 * BeiDou B1I. Minimum received power -163 dBW at a 0 dBi RHCP antenna, satellite above 5 degrees,
 * from BDS-SIS-ICD-B1I v2.0 as cited in earlier project research (not read from the PDF in this
 * package). Chip rate 2.046 Mcps. Receiver bandwidth 4.092 MHz is an assumption (2 x Rc).
 * Secondary.
 */
export const BEIDOU_B1I: GnssSignal = Object.freeze<GnssSignal>({
  id: 'beidou-b1i',
  name: 'BeiDou B1I',
  carrierFrequencyHz: 1561.098 * MHZ,
  chipRateHz: 2.046 * MHZ,
  modulation: { kind: 'bpsk-r' },
  minimumReceivedPowerDbw: -163 as Dbw,
  referenceAntennaGainDbic: 0,
  minimumElevationDeg: 5,
  defaultReceiverBandwidthHz: 4.092 * MHZ,
  source: 'BDS-SIS-ICD-B1I v2.0 via project research notes (PDF not read); bandwidth assumed',
  sourceQuality: 'secondary',
});

/** All signal presets, keyed by id. */
export const GNSS_SIGNALS: Readonly<Record<string, GnssSignal>> = Object.freeze({
  [GPS_L1_CA.id]: GPS_L1_CA,
  [GPS_L2C.id]: GPS_L2C,
  [GPS_L1C.id]: GPS_L1C,
  [GPS_L5.id]: GPS_L5,
  [GALILEO_E1_OS.id]: GALILEO_E1_OS,
  [GLONASS_L1OF.id]: GLONASS_L1OF,
  [BEIDOU_B1I.id]: BEIDOU_B1I,
});
