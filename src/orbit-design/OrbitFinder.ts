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

import { Satellite } from '../objects/Satellite';
import { Sgp4 } from '../sgp4/sgp4';
import { eci2lla, jday } from '../transforms';
import { Degrees, GreenwichMeanSiderealTime, Kilometers, SatelliteRecord, TemeVec3, TleLine1, TleLine2 } from '../types/types';
import { MILLISECONDS_TO_DAYS, MINUTES_PER_DAY } from '../utils/constants';

enum PropagationResults {
  Near = 0,
  Success = 1,
  Error = 2,
  Far = 3,
}

/**
 * Parameters describing an orbit's current state.
 */
export interface OrbitParameters {
  meanAnomaly: number;
  argOfPerigee: number;
  raan: number;
  altitude: number;
  latitude: number;
  longitude: number;
}

/**
 * Options for OrbitFinder.
 */
export interface OrbitFinderOptions {
  /** Optional callback for debug messages */
  debugCallback?: (message: string) => void;
}

/**
 * OrbitFinder is a utility class for manipulating satellite orbital parameters
 * to position a satellite over a specific latitude/longitude at a specific time.
 *
 * It works by taking an existing satellite's orbital parameters as a starting point
 * and searching for adjustments to orbital elements (mean anomaly, RAAN, argument of perigee)
 * until it finds a configuration that passes over the target location with the correct
 * directional motion (North or South).
 *
 * @example
 * ```typescript
 * // Create an OrbitFinder for a circular orbit
 * const finder = new OrbitFinder(
 *   satellite,
 *   45.0 as Degrees,  // target latitude
 *   -122.0 as Degrees, // target longitude
 *   'N',              // moving north at target
 *   new Date()
 * );
 * const result = finder.rotateOrbitToLatLon();
 * if (result[0] !== 'Error') {
 *   const [tle1, tle2] = result;
 *   // Use the new TLE
 * }
 *
 * // For elliptical orbits, specify target altitude
 * const ellipticalFinder = new OrbitFinder(
 *   satellite,
 *   45.0 as Degrees,
 *   -122.0 as Degrees,
 *   'S',
 *   new Date(),
 *   400 as Kilometers  // target altitude for perigee
 * );
 * ```
 */
export class OrbitFinder {
  static readonly MAX_LAT_ERROR = 0.025 as Degrees;
  static readonly MAX_LON_ERROR = 0.025 as Degrees;
  static readonly MAX_ALT_ERROR = 10 as Kilometers;

  static readonly MAX_ITERATIONS = 5000;
  static readonly COARSE_STEP = 1.0; // degrees
  static readonly FINE_STEP = 0.005; // degrees

  private readonly sat_: Satellite;
  private readonly goalParams_: OrbitParameters;
  private readonly now_: Date;
  private readonly goalDirection_: 'N' | 'S';
  private readonly debugCallback_?: (message: string) => void;
  private currentParams_: OrbitParameters;
  private lastLatitude_: number | null = null;
  private currentDirection_: 'N' | 'S' | null = null;

  constructor(
    sat: Satellite,
    goalLat: Degrees,
    goalLon: Degrees,
    goalDirection: 'N' | 'S',
    now: Date,
    goalAlt?: Kilometers,
    raanOffset = 0,
    options?: OrbitFinderOptions,
  ) {
    this.sat_ = sat;
    this.now_ = now;
    this.goalDirection_ = goalDirection;
    this.debugCallback_ = options?.debugCallback;
    this.goalParams_ = {
      meanAnomaly: 0,
      argOfPerigee: sat.argOfPerigee,
      raan: sat.rightAscension + raanOffset,
      altitude: goalAlt || 0,
      latitude: goalLat,
      longitude: goalLon,
    };
    this.currentParams_ = this.getCurrentOrbitParams_();
  }

  /**
   * Rotates the orbit to pass over the target latitude/longitude at the specified time.
   * @returns A tuple of [TleLine1, TleLine2] on success, or ['Error', message] on failure.
   */
  rotateOrbitToLatLon(): [TleLine1, TleLine2] | ['Error', string] {
    try {
      if (this.goalParams_.altitude > 0) {
        // 1. Find original perigee position
        const perigeeParams = this.findPerigeePosition_();

        this.debug_(`Original perigee position: ${perigeeParams.latitude} - ${perigeeParams.longitude} - ${perigeeParams.altitude}`);

        // 2. Move new satellite to perigee without direction check
        this.updateOrbitWithoutDirectionCheck_({
          meanAnomaly: 0,
        });
        this.debug_(`Positioned at initial perigee: ${this.currentParams_.latitude} - ${this.currentParams_.longitude} - ${this.currentParams_.altitude}`);

        // 3. Rotate argument of perigee to match original latitude
        let bestArgPerigee = this.currentParams_.argOfPerigee;
        let bestLatError = Infinity;

        // Search for arg perigee that puts perigee at original latitude
        for (let argPer = 0; argPer < 360; argPer += 0.25) {
          this.updateOrbitWithoutDirectionCheck_({
            meanAnomaly: 0,
            argOfPerigee: argPer,
          });

          const latError = Math.abs(this.currentParams_.latitude - perigeeParams.latitude);

          if (latError < bestLatError) {
            bestLatError = latError;
            bestArgPerigee = argPer;
            this.debug_(`New best arg perigee: ${argPer} with lat error ${latError}`);
          }

          if (latError <= OrbitFinder.MAX_LAT_ERROR) {
            break;
          }
        }

        // Apply best found arg perigee
        this.updateOrbitWithoutDirectionCheck_({
          meanAnomaly: 0,
          argOfPerigee: bestArgPerigee,
        });

        this.debug_(`After arg perigee adjustment: ${this.currentParams_.latitude} - ${this.currentParams_.longitude} - ${this.currentParams_.altitude}`);

        // 4. Now find the correct mean anomaly for target position
        this.lastLatitude_ = null;
        this.currentDirection_ = null;

        const finalMeanAResult = this.meanACalcLoop_(this.goalDirection_);

        if (finalMeanAResult !== PropagationResults.Success) {
          return ['Error', 'Failed to find final target position'];
        }

        // 5. Adjust RAAN for longitude
        const successfulDirection = this.currentDirection_;
        const newRaan = this.linearSearchRaan_();

        // 6. Final combined update
        this.currentDirection_ = successfulDirection;
        const finalSuccess = this.updateOrbit_({
          meanAnomaly: this.currentParams_.meanAnomaly,
          raan: newRaan,
          argOfPerigee: bestArgPerigee,
        });

        if (!finalSuccess) {
          return ['Error', 'Final position adjustment failed'];
        }

        // Verify final position
        this.debug_(`Final position: ${this.currentParams_.latitude}, ${this.currentParams_.longitude}, ${this.currentParams_.altitude}`);
        this.debug_(`Target altitude: ${this.goalParams_.altitude}, Current altitude: ${this.currentParams_.altitude}`);

      } else {
        // Original logic for circular orbits
        const result = this.meanACalcLoop_(this.goalDirection_);

        if (result !== PropagationResults.Success) {
          return ['Error', `Failed to find solution with ${this.goalDirection_} bound direction`];
        }

        const meanAnomalySuccess = this.updateOrbit_({
          meanAnomaly: this.currentParams_.meanAnomaly,
        });

        if (!meanAnomalySuccess) {
          return ['Error', 'Mean anomaly adjustment resulted in incorrect direction'];
        }

        const successfulDirection = this.currentDirection_;
        const newRaan = this.linearSearchRaan_();

        this.currentDirection_ = successfulDirection;
        const combinedSuccess = this.updateOrbit_({
          meanAnomaly: this.currentParams_.meanAnomaly,
          raan: newRaan,
        });

        if (!combinedSuccess) {
          return ['Error', 'Combined mean anomaly and RAAN adjustment failed'];
        }
      }

      return [
        this.generateTle1_(),
        this.generateTle2_(this.currentParams_),
      ];

    } catch (error) {
      this.debug_(`Error in rotateOrbitToLatLon: ${(error as Error).message}`);

      return ['Error', (error as Error).message];
    }
  }

  private debug_(message: string): void {
    if (this.debugCallback_) {
      this.debugCallback_(message);
    }
  }

  private calculateTimeVariables_(date: Date, satrec?: SatelliteRecord): {
    gmst: GreenwichMeanSiderealTime;
    m: number | null;
    j: number;
  } {
    const j =
      jday(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()) +
      date.getUTCMilliseconds() * MILLISECONDS_TO_DAYS;
    const gmst = Sgp4.gstime(j);

    const m = satrec ? (j - satrec.jdsatepoch) * MINUTES_PER_DAY : null;

    return { gmst, m, j };
  }

  private getCurrentOrbitParams_(): OrbitParameters {
    if (!this.sat_?.satrec) {
      throw new Error('Satellite data is not available');
    }

    const { m, gmst } = this.calculateTimeVariables_(this.now_, this.sat_.satrec);

    if (m === null) {
      throw new Error('Invalid time variables');
    }

    const positionEci = Sgp4.propagate(this.sat_.satrec, m).position as TemeVec3;
    const { lat, lon, alt } = eci2lla(positionEci, gmst);

    return {
      meanAnomaly: this.sat_.meanAnomaly,
      argOfPerigee: this.sat_.argOfPerigee,
      raan: this.sat_.rightAscension,
      altitude: alt,
      latitude: lat,
      longitude: lon,
    };
  }

  private determineDirection_(newLat: number): 'N' | 'S' | null {
    if (this.lastLatitude_ === null) {
      this.debug_(`Initial latitude: ${newLat}`);
      this.lastLatitude_ = newLat;

      return null;
    }

    if (this.currentDirection_ && Math.abs(newLat - this.lastLatitude_) < 0.01) {
      return this.currentDirection_; // Maintain current direction if change is negligible
    }

    const direction = newLat > this.lastLatitude_ ? 'N' : 'S';

    this.debug_(`Current latitude: ${this.lastLatitude_} - New latitude: ${newLat} - Direction: ${direction}`);

    this.lastLatitude_ = newLat;

    this.debug_(`New direction: ${direction}`);

    return direction;
  }

  private isCorrectDirection_(): boolean {
    this.debug_(`Current direction: ${this.currentDirection_} - Goal direction: ${this.goalDirection_}`);

    return this.currentDirection_ === this.goalDirection_;
  }

  private updateOrbit_(newParams: Partial<OrbitParameters>): boolean {
    // Create new TLE with updated parameters
    const tle1 = this.generateTle1_();
    const tle2 = this.generateTle2_(newParams);

    const satrec = Sgp4.createSatrec(tle1, tle2);

    if (!satrec) {
      throw new Error('Invalid orbit parameters');
    }

    // Update current parameters and check direction
    const { m, gmst } = this.calculateTimeVariables_(this.now_, satrec);

    if (m === null) {
      throw new Error('Invalid time variables');
    }
    const positionEci = Sgp4.propagate(satrec, m).position as TemeVec3;
    const { lat, lon, alt } = eci2lla(positionEci, gmst);

    // Update direction
    const newDirection = this.determineDirection_(lat);

    if (newDirection !== null) {
      this.currentDirection_ = newDirection;
    }

    // Update current parameters
    this.currentParams_ = {
      ...this.currentParams_,
      ...newParams,
      latitude: lat,
      longitude: lon,
      altitude: alt,
    };

    return this.isCorrectDirection_();
  }

  private meanACalcLoop_(direction: 'N' | 'S'): PropagationResults {
    // Start searching from different points based on desired direction
    const startVal = direction === 'N' ? 0 : 180;
    const endVal = direction === 'N' ? 360 : 540; // For 'S', search beyond 360 to handle wrap-around

    for (let posVal = startVal * 10; posVal < endVal * 10; posVal += 0.25) {
      const normalizedVal = posVal % (360 * 10); // Normalize to 0-360 range
      const result = this.meanACalc_(normalizedVal, this.now_);

      if (result === PropagationResults.Success) {
        if (this.currentDirection_ !== direction) {
          posVal += 20; // Skip ahead if direction is wrong
        } else {
          return PropagationResults.Success;
        }
      }

      if (result === PropagationResults.Far) {
        posVal += 100;
      }

      if (result === PropagationResults.Error) {
        return PropagationResults.Error;
      }
    }

    return PropagationResults.Near;
  }

  private meanACalc_(meana: number, now: Date): PropagationResults {
    meana /= 10;
    meana %= 360; // Normalize to 0-360 range

    const tle1 = this.generateTle1_();
    const tle2 = this.generateTle2_({ meanAnomaly: meana });

    const satrec = Sgp4.createSatrec(tle1, tle2);

    if (!satrec) {
      return PropagationResults.Error;
    }

    const { m, gmst } = this.calculateTimeVariables_(now, satrec);

    if (m === null) {
      return PropagationResults.Error;
    }
    const positionEci = Sgp4.propagate(satrec, m).position as TemeVec3;
    const { lat } = eci2lla(positionEci, gmst);

    // Update direction
    if (this.lastLatitude_ !== null) {
      if (Math.abs(lat - this.lastLatitude_) > 0.001) {
        this.currentDirection_ = lat > this.lastLatitude_ ? 'N' : 'S';
      }
    }
    this.lastLatitude_ = lat;

    // Check if we're at the target latitude with correct direction
    if (Math.abs(lat - this.goalParams_.latitude) <= OrbitFinder.MAX_LAT_ERROR) {
      if (this.currentDirection_ === this.goalDirection_) {
        this.currentParams_.meanAnomaly = meana;

        return PropagationResults.Success;
      }
    }

    // Check if we're far from target
    if (Math.abs(lat - this.goalParams_.latitude) > 11) {
      return PropagationResults.Far;
    }

    return PropagationResults.Near;
  }

  private linearSearchRaan_(): number {
    let bestValue = this.currentParams_.raan;
    let bestError = Infinity;

    // Initial coarse search
    for (let raan = 0; raan < 360; raan += OrbitFinder.COARSE_STEP) {
      // Don't check direction for RAAN adjustments
      this.updateOrbit_({ raan });
      const error = Math.abs(this.calculateError_('raan'));

      if (error < Math.abs(bestError)) {
        bestError = error;
        bestValue = raan;
      }

      if (error < OrbitFinder.MAX_LON_ERROR) {
        // Fine tune around best value
        for (let fineRaan = bestValue - 5; fineRaan <= bestValue + 5; fineRaan += OrbitFinder.FINE_STEP) {
          const normalizedRaan = ((fineRaan % 360) + 360) % 360;

          this.updateOrbit_({ raan: normalizedRaan });
          const fineError = Math.abs(this.calculateError_('raan'));

          if (fineError < error) {
            bestValue = normalizedRaan;
            bestError = fineError;
          }
        }

        return bestValue;
      }
    }

    return bestValue;
  }

  private normalizeAngleDifference_(angle1: number, angle2: number): number {
    const diff = (angle1 - angle2) % 360;


    if (diff > 180) {
      return diff - 360;
    } else if (diff < -180) {
      return diff + 360;
    }

    return diff;

  }

  private calculateError_(param: keyof OrbitParameters): number {
    switch (param) {
      case 'meanAnomaly':
        return this.currentParams_.latitude - this.goalParams_.latitude;
      case 'raan':
        // Handle longitude wrapping at ±180°
        return this.normalizeAngleDifference_(
          this.currentParams_.longitude,
          this.goalParams_.longitude,
        );
      case 'argOfPerigee':
        this.debug_(`Current altitude: ${this.currentParams_.altitude} - Goal altitude: ${this.goalParams_.altitude}`);

        return this.currentParams_.altitude - this.goalParams_.altitude;
      default:
        return 0;
    }
  }


  private updateOrbitWithoutDirectionCheck_(newParams: Partial<OrbitParameters>): void {
    // Create new TLE with updated parameters
    const tle1 = this.generateTle1_();
    const tle2 = this.generateTle2_(newParams);

    const satrec = Sgp4.createSatrec(tle1, tle2);

    if (!satrec) {
      throw new Error('Invalid orbit parameters');
    }

    // Update current parameters without direction check
    const { m, gmst } = this.calculateTimeVariables_(this.now_, satrec);

    if (m === null) {
      throw new Error('Invalid time variables');
    }
    const positionEci = Sgp4.propagate(satrec, m).position as TemeVec3;
    const { lat, lon, alt } = eci2lla(positionEci, gmst);

    // Update current parameters
    this.currentParams_ = {
      ...this.currentParams_,
      ...newParams,
      latitude: lat,
      longitude: lon,
      altitude: alt,
    };
  }

  private findPerigeePosition_(): OrbitParameters {
    let lowestAltitude = Infinity;
    let perigeeParams: OrbitParameters | null = null;

    // More granular search through mean anomaly
    for (let meanA = 0; meanA < 360; meanA += 0.05) {
      const tle1 = this.generateTle1_();
      const tle2 = this.generateTle2_({ meanAnomaly: meanA });
      const satrec = Sgp4.createSatrec(tle1, tle2);

      if (!satrec) {
        continue;
      }

      const { m, gmst } = this.calculateTimeVariables_(this.now_, satrec);

      if (m === null) {
        throw new Error('Invalid time variables');
      }
      const positionEci = Sgp4.propagate(satrec, m).position as TemeVec3;
      const { lat, lon, alt } = eci2lla(positionEci, gmst);

      if (alt < lowestAltitude) {
        lowestAltitude = alt;
        perigeeParams = {
          meanAnomaly: meanA,
          argOfPerigee: this.currentParams_.argOfPerigee,
          raan: this.currentParams_.raan,
          altitude: alt,
          latitude: lat,
          longitude: lon,
        };
      }
    }

    if (!perigeeParams) {
      throw new Error('Failed to find perigee position');
    }

    this.debug_(`Found perigee at altitude ${perigeeParams.altitude} km`);

    return perigeeParams;
  }

  /**
   * Returns the 5-char satnum to embed in the synthesized TLEs.
   *
   * Why not {@link Satellite.sccNum}? For extended (7+ digit) IDs sccNum is
   * the full 9-digit canonical value, which would push the TLE past 69 chars
   * and break Sgp4.createSatrec. The input tle1 always has a valid 5-char
   * satnum at columns 2-6, and SGP4 itself doesn't care what value lives
   * there as long as line 1 and line 2 agree — so use that.
   */
  private tleSatNum_(): string {
    return this.sat_.tle1.substring(2, 7);
  }

  private generateTle1_(): TleLine1 {
    return `1 ${this.tleSatNum_()}U ${this.sat_.tle1.substring(9, 17)} ${this.sat_.tle1.substring(18, 32)}${this.sat_.tle1.substring(32, 71)}` as TleLine1;
  }

  private generateTle2_(newParams: Partial<OrbitParameters>): TleLine2 {
    // Merge provided parameters with current parameters
    const mergedParams = {
      ...this.currentParams_, // Use current parameters as base
      ...newParams, // Override with any provided parameters
    };

    const inc = this.sat_.inclination.toFixed(4).padStart(8, '0');
    const raan = mergedParams.raan.toFixed(4).padStart(8, '0');
    const ecc = this.sat_.eccentricity.toFixed(7).substring(2, 9);
    const argPer = mergedParams.argOfPerigee.toFixed(4).padStart(8, '0');
    const meanA = mergedParams.meanAnomaly.toFixed(4).padStart(8, '0');
    const meanMo = this.sat_.tle2.substring(52, 63);

    return `2 ${this.tleSatNum_()} ${inc} ${raan} ${ecc} ${argPer} ${meanA} ${meanMo}    10` as TleLine2;
  }
}
