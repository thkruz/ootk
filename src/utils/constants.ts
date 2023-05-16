/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file Commonly used constants.
 *
 * @license AGPL-3.0-or-later
 * @Copyright (c) 2020-2023 Theodore Kruczek
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

export const { PI } = Math;
export const TAU = PI * 2; // https://tauday.com/tau-manifesto
export const DEG2RAD = PI / 180.0;
export const x2o3 = 2.0 / 3.0;
export const temp4 = 1.5e-12;

export const RAD2DEG = 360 / TAU;
export const MINUTES_PER_DAY = 1440;
export const MS_PER_DAY = 86400000;
export const DAY_TO_MS = 1.15741e-8;
export const cMPerSec = 299792458;
export const cKmPerSec = 299792458 / 1000;
export const cKmPerMs = 299792458 / 1000 / 1000;
export const RADIUS_OF_EARTH = 6371; // Radius of Earth in kilometers
