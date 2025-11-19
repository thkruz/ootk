/**
 * @author @thkruz/ootk
 * @license AGPL-3.0-or-later
 * @copyright (c) 2024 Theodore Kruczek
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

import { Decibels, Gigahertz, Kelvin, Kilometers, Watts } from '../types/types.js';

/**
 * Convert linear power value to decibel-watts (dBW).
 * @param watts Power in watts
 * @returns Power in dBW
 */
export const wattsToDbw = (watts: Watts): Decibels => (10 * Math.log10(watts)) as Decibels;

/**
 * Convert decibel-watts (dBW) to linear power value.
 * @param dbw Power in dBW
 * @returns Power in watts
 */
export const dbwToWatts = (dbw: Decibels): Watts => Math.pow(10, dbw / 10) as Watts;

/**
 * Convert linear value to decibels.
 * @param linear Linear value
 * @returns Value in dB
 */
export const linearToDb = (linear: number): Decibels => (10 * Math.log10(linear)) as Decibels;

/**
 * Convert decibels to linear value.
 * @param db Value in dB
 * @returns Linear value
 */
export const dbToLinear = (db: Decibels): number => Math.pow(10, db / 10);

/**
 * Calculate free space path loss (FSPL) using the Friis transmission equation.
 * FSPL (dB) = 20*log10(distance) + 20*log10(frequency) + 92.45
 * where distance is in kilometers and frequency is in GHz.
 *
 * @param range Distance between transmitter and receiver in kilometers
 * @param frequency Frequency in GHz
 * @returns Path loss in dB
 */
export const calculateFreeSpacePathLoss = (range: Kilometers, frequency: Gigahertz): Decibels => {
  // FSPL (dB) = 20*log10(d_km) + 20*log10(f_GHz) + 92.45
  const pathLoss = 20 * Math.log10(range) + 20 * Math.log10(frequency) + 92.45;

  return pathLoss as Decibels;
};

/**
 * Calculate antenna gain from diameter and frequency.
 * Assumes a parabolic antenna with efficiency.
 *
 * G = η * (π * D * f / c)²
 * where:
 * - η is the antenna efficiency (typically 0.55-0.75)
 * - D is the antenna diameter in meters
 * - f is the frequency in Hz
 * - c is the speed of light in m/s
 *
 * @param diameterMeters Antenna diameter in meters
 * @param frequencyGhz Frequency in GHz
 * @param efficiency Antenna efficiency (0-1), defaults to 0.65
 * @returns Antenna gain in dBi
 */
export const calculateAntennaGain = (
  diameterMeters: number,
  frequencyGhz: Gigahertz,
  efficiency: number = 0.65,
): Decibels => {
  const frequencyHz = frequencyGhz * 1e9;
  const c = 299792458; // speed of light in m/s
  const wavelength = c / frequencyHz;
  const gainLinear = efficiency * Math.pow((Math.PI * diameterMeters) / wavelength, 2);

  return linearToDb(gainLinear);
};

/**
 * Calculate beamwidth from antenna gain.
 * Approximation: Beamwidth ≈ 70 * λ / D (degrees)
 * where λ is wavelength and D is antenna diameter
 *
 * @param gain Antenna gain in dBi
 * @returns Approximate 3dB beamwidth in degrees
 */
export const calculateBeamwidth = (gain: Decibels): number => {
  // Approximation: Beamwidth (degrees) ≈ 70 / sqrt(10^(G/10))
  const gainLinear = dbToLinear(gain);

  return 70 / Math.sqrt(gainLinear);
};

/**
 * Calculate the equivalent isotropic radiated power (EIRP).
 * EIRP = Transmit Power + Antenna Gain - Losses
 *
 * @param txPowerDbw Transmit power in dBW
 * @param antennaGainDbi Antenna gain in dBi
 * @param lossesDb Total losses in dB (cable, pointing, etc.)
 * @returns EIRP in dBW
 */
export const calculateEirp = (
  txPowerDbw: Decibels,
  antennaGainDbi: Decibels,
  lossesDb: Decibels = 0 as Decibels,
): Decibels => (txPowerDbw + antennaGainDbi - lossesDb) as Decibels;

/**
 * Calculate the figure of merit (G/T) for a receiving system.
 * G/T = Antenna Gain - 10*log10(System Temperature)
 *
 * @param antennaGainDbi Antenna gain in dBi
 * @param systemTempKelvin System noise temperature in Kelvin
 * @returns G/T in dB/K
 */
export const calculateGOverT = (antennaGainDbi: Decibels, systemTempKelvin: Kelvin): Decibels => {
  const tempDb = linearToDb(systemTempKelvin);

  return (antennaGainDbi - tempDb) as Decibels;
};

/**
 * Calculate carrier-to-noise density ratio (C/N0).
 * C/N0 = EIRP - Path Loss + G/T - Boltzmann's constant (dB-Hz)
 * where Boltzmann's constant k = -228.6 dB(W/K/Hz)
 *
 * @param eirpDbw EIRP in dBW
 * @param pathLossDb Path loss in dB
 * @param gOverTDbPerK G/T in dB/K
 * @param additionalLossesDb Additional losses in dB (atmospheric, rain, etc.)
 * @returns C/N0 in dB-Hz
 */
export const calculateCN0 = (
  eirpDbw: Decibels,
  pathLossDb: Decibels,
  gOverTDbPerK: Decibels,
  additionalLossesDb: Decibels = 0 as Decibels,
): Decibels => {
  const boltzmannDb = 228.6; // Boltzmann's constant in dB(W/K/Hz)
  const cn0 = eirpDbw - pathLossDb + gOverTDbPerK + boltzmannDb - additionalLossesDb;

  return cn0 as Decibels;
};

/**
 * Calculate carrier-to-noise ratio (C/N).
 * C/N = C/N0 - 10*log10(Bandwidth)
 *
 * @param cn0DbHz C/N0 in dB-Hz
 * @param bandwidthHz Bandwidth in Hz
 * @returns C/N in dB
 */
export const calculateCN = (cn0DbHz: Decibels, bandwidthHz: number): Decibels => {
  const bandwidthDb = linearToDb(bandwidthHz);

  return (cn0DbHz - bandwidthDb) as Decibels;
};

/**
 * Calculate energy per bit to noise density ratio (Eb/N0).
 * Eb/N0 = C/N0 - 10*log10(data rate)
 *
 * @param cn0DbHz C/N0 in dB-Hz
 * @param dataRateBps Data rate in bits per second
 * @returns Eb/N0 in dB
 */
export const calculateEbN0 = (cn0DbHz: Decibels, dataRateBps: number): Decibels => {
  const dataRateDb = linearToDb(dataRateBps);

  return (cn0DbHz - dataRateDb) as Decibels;
};

/**
 * Calculate link margin.
 * Link Margin = Received Eb/N0 - Required Eb/N0
 *
 * @param receivedEbN0Db Received Eb/N0 in dB
 * @param requiredEbN0Db Required Eb/N0 in dB
 * @returns Link margin in dB
 */
export const calculateLinkMargin = (receivedEbN0Db: Decibels, requiredEbN0Db: Decibels): Decibels =>
  (receivedEbN0Db - requiredEbN0Db) as Decibels;

/**
 * Calculate system noise temperature from noise figure.
 * T_sys = T_0 * (F - 1) + T_ant
 * where T_0 = 290K (reference temperature)
 *
 * @param noiseFigureDb Noise figure in dB
 * @param antennaTemperatureK Antenna temperature in Kelvin (default 290K)
 * @returns System noise temperature in Kelvin
 */
export const noiseFigureToNoiseTemperature = (
  noiseFigureDb: Decibels,
  antennaTemperatureK: Kelvin = 290 as Kelvin,
): Kelvin => {
  const noiseFigureLinear = dbToLinear(noiseFigureDb);
  const t0 = 290; // Reference temperature in Kelvin
  const systemTemp = t0 * (noiseFigureLinear - 1) + antennaTemperatureK;

  return systemTemp as Kelvin;
};

/**
 * Calculate atmospheric loss using a simple model.
 * This is a simplified model; for accurate results, use ITU-R models.
 *
 * @param elevationDegrees Elevation angle in degrees
 * @param frequencyGhz Frequency in GHz
 * @returns Atmospheric loss in dB
 */
export const calculateAtmosphericLoss = (elevationDegrees: number, frequencyGhz: Gigahertz): Decibels => {
  // Simple model: loss increases with frequency and decreases with elevation
  // At zenith (90°), minimal loss; at horizon (0°), maximum loss
  const elevationFactor = Math.sin((elevationDegrees * Math.PI) / 180);
  // Approximate loss: 0.1 dB at L-band to 2 dB at Ka-band (at zenith)
  const frequencyLoss = 0.05 * frequencyGhz;
  const atmosphericLoss = frequencyLoss / Math.max(elevationFactor, 0.1);

  return atmosphericLoss as Decibels;
};

/**
 * Calculate rain attenuation using ITU-R P.618 simplified model.
 * This is a very simplified approximation.
 *
 * @param rainRateMmPerHour Rain rate in mm/hour
 * @param frequencyGhz Frequency in GHz
 * @param elevationDegrees Elevation angle in degrees
 * @returns Rain attenuation in dB
 */
export const calculateRainLoss = (
  rainRateMmPerHour: number,
  frequencyGhz: Gigahertz,
  elevationDegrees: number,
): Decibels => {
  // Simplified ITU-R model
  // k and α coefficients (approximated for simplicity)
  let k: number;
  let alpha: number;

  if (frequencyGhz < 2.9) {
    k = 0.0001;
    alpha = 0.9;
  } else if (frequencyGhz < 54) {
    k = 0.0001 * Math.pow(frequencyGhz / 2.9, 2);
    alpha = 0.9 + 0.4 * Math.log10(frequencyGhz / 2.9);
  } else {
    k = 0.0001 * Math.pow(54 / 2.9, 2);
    alpha = 0.9 + 0.4 * Math.log10(54 / 2.9);
  }

  const specificAttenuation = k * Math.pow(rainRateMmPerHour, alpha);
  const elevationFactor = 1 / Math.sin((elevationDegrees * Math.PI) / 180);
  const pathLength = 5 * elevationFactor; // Approximate rain cell height of 5 km

  return (specificAttenuation * pathLength) as Decibels;
};
