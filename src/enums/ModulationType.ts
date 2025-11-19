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

/**
 * Common modulation types used in satellite communications.
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
  /** 256-Quadrature Amplitude Modulation */
  QAM256 = '256QAM',
  /** Offset QPSK */
  OQPSK = 'OQPSK',
  /** Gaussian Minimum Shift Keying */
  GMSK = 'GMSK',
  /** Frequency Shift Keying */
  FSK = 'FSK',
}
