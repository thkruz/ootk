/**
 * @author Theodore Kruczek.
 * @description Orbital Object ToolKit (OOTK) is a collection of tools for working
 * with satellites and other orbital objects.
 *
 * @file Commonly used constants.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export const { PI } = Math;
export const TAU = PI * 2; // https://tauday.com/tau-manifesto
export const DEG2RAD = PI / 180.0;
export const x2o3 = 2.0 / 3.0;
export const temp4 = 1.5e-12;

export const RAD2DEG = 360 / TAU;
export const MINUTES_PER_DAY = 1440;
export const MILLISECONDS_PER_DAY = 1.15741e-8;
export const cMPerSec = 299792458;
export const cKmPerSec = 299792458 / 1000;
export const cKmPerMs = 299792458 / 1000 / 1000;
export const RADIUS_OF_EARTH = 6371; // Radius of Earth in kilometers
