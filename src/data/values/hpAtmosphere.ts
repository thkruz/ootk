/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
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

import { HpAtmosphereEntry } from './HpAtmosphereData.js';

// / Harris-Priester atmosphere data, assuming mean solar flux.

export const hpAtmosphere: HpAtmosphereEntry[] = [
  [100, 4.974e-7, 4.974e-7],
  [120, 2.49e-8, 2.49e-8],
  [130, 8.377e-9, 8.71e-9],
  [140, 3.899e-9, 4.059e-9],
  [150, 2.122e-9, 2.215e-9],
  [160, 1.263e-9, 1.344e-9],
  [170, 8.008e-10, 8.758e-10],
  [180, 5.283e-10, 6.01e-10],
  [190, 3.617e-10, 4.297e-10],
  [200, 2.557e-10, 3.162e-10],
  [210, 1.839e-10, 2.396e-10],
  [220, 1.341e-10, 1.853e-10],
  [230, 9.949e-11, 1.455e-10],
  [240, 7.488e-11, 1.157e-10],
  [250, 5.709e-11, 9.308e-11],
  [260, 4.403e-11, 7.555e-11],
  [270, 3.43e-11, 6.182e-11],
  [280, 2.697e-11, 5.095e-11],
  [290, 2.139e-11, 4.226e-11],
  [300, 1.708e-11, 3.526e-11],
  [320, 1.099e-11, 2.511e-11],
  [340, 7.214e-12, 1.819e-11],
  [360, 4.824e-12, 1.337e-11],
  [380, 3.274e-12, 9.955e-12],
  [400, 2.249e-12, 7.492e-12],
  [420, 1.558e-12, 5.684e-12],
  [440, 1.091e-12, 4.355e-12],
  [460, 7.701e-13, 3.362e-12],
  [480, 5.474e-13, 2.612e-12],
  [500, 3.916e-13, 2.042e-12],
  [520, 2.819e-13, 1.605e-12],
  [540, 2.042e-13, 1.267e-12],
  [560, 1.488e-13, 1.005e-12],
  [580, 1.092e-13, 7.997e-13],
  [600, 8.07e-14, 6.39e-13],
  [620, 6.012e-14, 5.123e-13],
  [640, 4.519e-14, 4.121e-13],
  [660, 3.43e-14, 3.325e-13],
  [680, 2.632e-14, 2.691e-13],
  [700, 2.043e-14, 2.185e-13],
  [720, 1.607e-14, 1.779e-13],
  [740, 1.281e-14, 1.452e-13],
  [760, 1.036e-14, 1.19e-13],
  [780, 8.496e-15, 9.776e-14],
  [800, 7.069e-15, 8.059e-14],
  [840, 4.68e-15, 5.741e-14],
  [880, 3.2e-15, 4.21e-14],
  [920, 2.21e-15, 3.13e-14],
  [960, 1.56e-15, 2.36e-14],
  [1000, 1.15e-15, 1.81e-14],
];
