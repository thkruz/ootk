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

import type { Milliseconds } from '../types/types';
import { AccessCalculator } from '../objects/AccessCalculator';
import type { AccessConstraints, AccessWindow } from '../objects/AccessWindow';
import type { GroundStation } from '../objects/GroundStation';
import type { Satellite } from '../objects/Satellite';
import { ScheduledContact, TimeWindow } from './ScheduledContact';

/**
 * Strategy for selecting contacts when conflicts occur.
 */
export enum ContactSelectionStrategy {
  /** Prefer contacts with higher max elevation (better link quality) */
  MAX_ELEVATION = 'maxElevation',
  /** Prefer longer duration contacts */
  LONGEST_DURATION = 'longestDuration',
  /** Prefer higher priority contacts (user-defined priority) */
  PRIORITY = 'priority',
  /** Prefer earlier contacts (first come, first served) */
  EARLIEST = 'earliest',
  /** Optimize for maximum total contact time */
  MAX_TOTAL_TIME = 'maxTotalTime',
}

/**
 * Configuration options for contact scheduling.
 */
export interface ScheduleOptions {
  /** Access constraints to apply (from AccessCalculator) */
  accessConstraints?: AccessConstraints;

  /** Strategy for resolving conflicts (default: MAX_ELEVATION) */
  selectionStrategy?: ContactSelectionStrategy;

  /** Minimum contact duration in milliseconds (default: 60000 = 1 minute) */
  minContactDuration?: Milliseconds;

  /** Maximum contacts per satellite (default: unlimited) */
  maxContactsPerSatellite?: number;

  /** Maximum contacts per station (default: unlimited) */
  maxContactsPerStation?: number;

  /** Required gap between contacts at same station in ms (default: 0) */
  stationHandoverTime?: Milliseconds;

  /** User-defined priority function for satellites (higher = more important) */
  satellitePriority?: (satellite: Satellite) => number;

  /** User-defined priority function for stations (tie-breaker only) */
  stationPriority?: (station: GroundStation) => number;

  /** Maximum concurrent contacts per station - global default (default: 1) */
  maxConcurrentPerStation?: number;

  /** Per-station override for concurrency limit based on sensor capabilities */
  stationConcurrencyLimit?: (station: GroundStation) => number;

  /** Allow satellite handover between stations (default: false) */
  allowHandover?: boolean;

  /** Minimum duration at each station during handover in ms (default: 60000) */
  minHandoverDuration?: Milliseconds;

  /** Time step for access calculation in milliseconds (default: 10000) */
  accessStepMs?: number;
}

/**
 * Per-satellite coverage statistics.
 */
export interface SatelliteCoverageStats {
  /** The satellite */
  satellite: Satellite;
  /** Number of contacts scheduled */
  contactCount: number;
  /** Total contact time in milliseconds */
  totalContactTime: number;
  /** Coverage percentage (contact time / total window) */
  coveragePercent: number;
  /** Coverage gaps for this satellite */
  gaps: TimeWindow[];
}

/**
 * Per-station utilization statistics.
 */
export interface StationCoverageStats {
  /** The ground station */
  station: GroundStation;
  /** Number of contacts scheduled */
  contactCount: number;
  /** Total contact time in milliseconds */
  totalContactTime: number;
  /** Utilization percentage (contact time / total window) */
  utilizationPercent: number;
}

/**
 * Coverage statistics for a schedule.
 */
export interface CoverageStatistics {
  /** Total scheduled contact time in milliseconds */
  totalContactTime: number;
  /** Number of contacts scheduled */
  contactCount: number;
  /** Per-satellite statistics */
  bySatellite: Map<number, SatelliteCoverageStats>;
  /** Per-station statistics */
  byStation: Map<number, StationCoverageStats>;
  /** Overall coverage percentage (time with contact / total time) */
  overallCoveragePercent: number;
  /** Average gap duration in milliseconds */
  averageGapDuration: number;
  /** Maximum gap duration in milliseconds */
  maxGapDuration: number;
}

/**
 * Static utility class for scheduling satellite contacts with ground stations.
 *
 * ContactScheduler builds on AccessCalculator to create optimal, non-overlapping
 * contact schedules that maximize coverage while respecting station constraints.
 *
 * @example
 * ```typescript
 * const schedule = ContactScheduler.schedule(
 *   [station1, station2],
 *   [sat1, sat2, sat3],
 *   new Date(),
 *   new Date(Date.now() + 86400000),
 *   {
 *     selectionStrategy: ContactSelectionStrategy.MAX_ELEVATION,
 *     accessConstraints: { minElevation: 10 as Degrees },
 *     stationHandoverTime: 60000 as Milliseconds,
 *     satellitePriority: (sat) => sat.id === 'critical-sat' ? 10 : 1,
 *     stationConcurrencyLimit: (sta) =>
 *       sta.sensors.some(s => s.sensorType === SensorType.PHASED_ARRAY_RADAR) ? 4 : 1,
 *   }
 * );
 *
 * for (const contact of schedule) {
 *   console.log(contact.toString());
 * }
 *
 * // Find gaps for a specific satellite
 * const gaps = ContactScheduler.findCoverageGaps(schedule, sat1);
 *
 * // Get overall statistics
 * const stats = ContactScheduler.getCoverageStatistics(
 *   schedule, [sat1, sat2, sat3], start, end
 * );
 * console.log(`Overall coverage: ${stats.overallCoveragePercent.toFixed(1)}%`);
 * ```
 */
export class ContactScheduler {
  /** Default minimum contact duration (1 minute) */
  private static readonly DEFAULT_MIN_DURATION_MS_ = 60000;

  /** Default access calculation step (10 seconds) */
  private static readonly DEFAULT_STEP_MS_ = 10000;

  /** Default priority for satellites without user-defined priority */
  private static readonly DEFAULT_PRIORITY_ = 1;

  /** Multiplier for priority in composite score calculation */
  private static readonly PRIORITY_MULTIPLIER_ = 1000;

  /** Prevent instantiation */
  private constructor() {
    // Static utility class
  }

  /**
   * Creates an optimized contact schedule for multiple stations and satellites.
   *
   * The scheduling algorithm uses a greedy approach with priority-based scoring:
   * 1. Generate all access windows
   * 2. Apply handover splitting if enabled
   * 3. Score each candidate (priority * 1000 + quality)
   * 4. Sort by score descending
   * 5. Greedily select non-conflicting contacts
   *
   * @param stations - Ground stations available for contacts
   * @param satellites - Satellites to schedule contacts with
   * @param start - Start of the scheduling window
   * @param end - End of the scheduling window
   * @param options - Scheduling configuration options
   * @returns Array of scheduled contacts, sorted by start time
   */
  static schedule(
    stations: GroundStation[],
    satellites: Satellite[],
    start: Date,
    end: Date,
    options: ScheduleOptions = {},
  ): ScheduledContact[] {
    // Handle empty inputs
    if (stations.length === 0 || satellites.length === 0) {
      return [];
    }

    const stepMs = options.accessStepMs ?? ContactScheduler.DEFAULT_STEP_MS_;
    const constraints = options.accessConstraints ?? {};

    // Step 1: Generate all access windows
    const allWindows = ContactScheduler.generateAllAccessWindows_(
      stations,
      satellites,
      start,
      end,
      constraints,
      stepMs,
    );

    if (allWindows.length === 0) {
      return [];
    }

    // Step 2: Apply handover splitting if enabled
    let candidates: AccessWindow[];

    if (options.allowHandover) {
      candidates = ContactScheduler.applyHandoverSplitting_(allWindows, options);
    } else {
      candidates = allWindows;
    }

    // Step 3: Filter by minimum duration
    const minDuration = options.minContactDuration ?? ContactScheduler.DEFAULT_MIN_DURATION_MS_;

    candidates = candidates.filter((w) => w.duration >= minDuration);

    if (candidates.length === 0) {
      return [];
    }

    // Step 4: Convert to ScheduledContacts with priorities
    const contacts = ContactScheduler.createCandidateContacts_(candidates, options);

    // Step 5: Run greedy scheduling algorithm
    const scheduled = ContactScheduler.greedySchedule_(contacts, options);

    // Sort by start time
    scheduled.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());

    return scheduled;
  }

  /**
   * Finds gaps in coverage for a specific satellite within a schedule.
   *
   * @param schedule - The current contact schedule
   * @param satellite - The satellite to analyze
   * @param start - Optional start of analysis window (defaults to first contact or now)
   * @param end - Optional end of analysis window (defaults to last contact)
   * @returns Array of time windows where the satellite has no scheduled contact
   */
  static findCoverageGaps(
    schedule: ScheduledContact[],
    satellite: Satellite,
    start?: Date,
    end?: Date,
  ): TimeWindow[] {
    // Filter for this satellite
    const satContacts = schedule.filter((c) => c.satellite.id === satellite.id);

    if (satContacts.length === 0) {
      // No contacts for this satellite
      if (start && end) {
        return [
          {
            start,
            end,
            duration: end.getTime() - start.getTime(),
          },
        ];
      }

      return [];
    }

    // Sort by scheduled start time
    satContacts.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());

    // Determine analysis window
    const windowStart = start ?? satContacts[0].scheduledStart;
    const windowEnd = end ?? satContacts[satContacts.length - 1].scheduledEnd;

    const gaps: TimeWindow[] = [];
    let currentTime = windowStart.getTime();

    // Walk through contacts finding gaps
    for (const contact of satContacts) {
      const contactStart = contact.scheduledStart.getTime();
      const contactEnd = contact.scheduledEnd.getTime();

      // Skip contacts before our window
      if (contactEnd <= currentTime) {
        continue;
      }

      // Check for gap before this contact
      if (contactStart > currentTime) {
        const gapStart = new Date(currentTime);
        const gapEnd = new Date(Math.min(contactStart, windowEnd.getTime()));

        if (gapEnd.getTime() > gapStart.getTime()) {
          gaps.push({
            start: gapStart,
            end: gapEnd,
            duration: gapEnd.getTime() - gapStart.getTime(),
          });
        }
      }

      // Move current time to end of this contact
      currentTime = Math.max(currentTime, contactEnd);

      // Stop if we've passed the window end
      if (currentTime >= windowEnd.getTime()) {
        break;
      }
    }

    // Check for gap at the end
    if (currentTime < windowEnd.getTime()) {
      gaps.push({
        start: new Date(currentTime),
        end: windowEnd,
        duration: windowEnd.getTime() - currentTime,
      });
    }

    return gaps;
  }

  /**
   * Calculates coverage statistics for a schedule.
   *
   * @param schedule - The contact schedule to analyze
   * @param satellites - Satellites to include in analysis
   * @param start - Start of analysis window
   * @param end - End of analysis window
   * @returns Coverage statistics
   */
  static getCoverageStatistics(
    schedule: ScheduledContact[],
    satellites: Satellite[],
    start: Date,
    end: Date,
  ): CoverageStatistics {
    const totalWindow = end.getTime() - start.getTime();
    const bySatellite = new Map<number, SatelliteCoverageStats>();
    const byStation = new Map<number, StationCoverageStats>();
    let totalContactTime = 0;
    let allGaps: TimeWindow[] = [];

    // Calculate per-satellite statistics
    for (const sat of satellites) {
      const satContacts = schedule.filter((c) => c.satellite.id === sat.id);
      const gaps = ContactScheduler.findCoverageGaps(schedule, sat, start, end);
      const contactTime = satContacts.reduce((sum, c) => sum + c.scheduledDuration, 0);

      bySatellite.set(sat.id, {
        satellite: sat,
        contactCount: satContacts.length,
        totalContactTime: contactTime,
        coveragePercent: totalWindow > 0 ? (contactTime / totalWindow) * 100 : 0,
        gaps,
      });

      totalContactTime += contactTime;
      allGaps = allGaps.concat(gaps);
    }

    // Calculate per-station statistics
    const stationIds = new Set(schedule.map((c) => c.station.id));

    for (const stationId of stationIds) {
      const stationContacts = schedule.filter((c) => c.station.id === stationId);

      if (stationContacts.length > 0) {
        const station = stationContacts[0].station;
        const contactTime = stationContacts.reduce((sum, c) => sum + c.scheduledDuration, 0);

        byStation.set(stationId, {
          station,
          contactCount: stationContacts.length,
          totalContactTime: contactTime,
          utilizationPercent: totalWindow > 0 ? (contactTime / totalWindow) * 100 : 0,
        });
      }
    }

    // Calculate gap statistics
    const gapDurations = allGaps.map((g) => g.duration);
    const avgGapDuration =
      gapDurations.length > 0 ? gapDurations.reduce((a, b) => a + b, 0) / gapDurations.length : 0;
    const maxGapDuration = gapDurations.length > 0 ? Math.max(...gapDurations) : 0;

    // Calculate overall coverage (avoid double-counting overlapping contacts)
    // For simplicity, use average per-satellite coverage
    const satCount = satellites.length;
    const overallCoverage =
      satCount > 0 && totalWindow > 0
        ? (totalContactTime / satCount / totalWindow) * 100
        : 0;

    return {
      totalContactTime,
      contactCount: schedule.length,
      bySatellite,
      byStation,
      overallCoveragePercent: Math.min(100, overallCoverage),
      averageGapDuration: avgGapDuration,
      maxGapDuration,
    };
  }

  /**
   * Generates all access windows for all station-satellite pairs.
   * @internal
   */
  private static generateAllAccessWindows_(
    stations: GroundStation[],
    satellites: Satellite[],
    start: Date,
    end: Date,
    constraints: AccessConstraints,
    stepMs: number,
  ): AccessWindow[] {
    const allWindows: AccessWindow[] = [];

    for (const station of stations) {
      for (const satellite of satellites) {
        const windows = AccessCalculator.calculateAccess(
          station,
          satellite,
          start,
          end,
          constraints,
          stepMs,
        );

        allWindows.push(...windows);
      }
    }

    return allWindows;
  }

  /**
   * Applies handover splitting to overlapping access windows.
   * When the same satellite is visible from multiple stations,
   * splits the windows at the handover point.
   * @internal
   */
  private static applyHandoverSplitting_(
    windows: AccessWindow[],
    options: ScheduleOptions,
  ): AccessWindow[] {
    const minHandoverDuration = options.minHandoverDuration ?? ContactScheduler.DEFAULT_MIN_DURATION_MS_;
    const result: AccessWindow[] = [];

    // Group by satellite
    const bySatellite = new Map<number, AccessWindow[]>();

    for (const w of windows) {
      const satId = w.target.id;

      if (!bySatellite.has(satId)) {
        bySatellite.set(satId, []);
      }
      bySatellite.get(satId)!.push(w);
    }

    // Process each satellite's windows
    for (const [, satWindows] of bySatellite) {
      // Sort by start time
      satWindows.sort((a, b) => a.start.getTime() - b.start.getTime());

      // Find overlapping pairs from different stations and split
      const processed = new Set<number>();

      for (let i = 0; i < satWindows.length; i++) {
        if (processed.has(i)) {
          continue;
        }

        const w1 = satWindows[i];
        let foundOverlap = false;

        for (let j = i + 1; j < satWindows.length; j++) {
          if (processed.has(j)) {
            continue;
          }

          const w2 = satWindows[j];

          // Different stations and overlapping?
          if (w1.observer.id !== w2.observer.id && ContactScheduler.windowsOverlap_(w1, w2)) {
            // Calculate handover point (midpoint of overlap for simplicity)
            const overlapStart = Math.max(w1.start.getTime(), w2.start.getTime());
            const overlapEnd = Math.min(w1.end.getTime(), w2.end.getTime());
            const handoverPoint = new Date((overlapStart + overlapEnd) / 2);

            // Split w1: keep [w1.start, handoverPoint] if long enough
            const w1Duration = handoverPoint.getTime() - w1.start.getTime();

            if (w1Duration >= minHandoverDuration) {
              result.push(ContactScheduler.createTrimmedWindow_(w1, w1.start, handoverPoint));
            }

            // Split w2: keep [handoverPoint, w2.end] if long enough
            const w2Duration = w2.end.getTime() - handoverPoint.getTime();

            if (w2Duration >= minHandoverDuration) {
              result.push(ContactScheduler.createTrimmedWindow_(w2, handoverPoint, w2.end));
            }

            processed.add(i);
            processed.add(j);
            foundOverlap = true;
            break;
          }
        }

        if (!foundOverlap) {
          result.push(w1);
          processed.add(i);
        }
      }

      // Add any remaining windows not processed
      for (let i = 0; i < satWindows.length; i++) {
        if (!processed.has(i)) {
          result.push(satWindows[i]);
        }
      }
    }

    return result;
  }

  /**
   * Checks if two access windows overlap in time.
   * @internal
   */
  private static windowsOverlap_(w1: AccessWindow, w2: AccessWindow): boolean {
    return !(w1.end.getTime() <= w2.start.getTime() || w1.start.getTime() >= w2.end.getTime());
  }

  /**
   * Creates a trimmed copy of an access window with new start/end times.
   * @internal
   */
  private static createTrimmedWindow_(
    original: AccessWindow,
    newStart: Date,
    newEnd: Date,
  ): AccessWindow {
    // We need to create a new AccessWindow - import it properly
    // Since AccessWindow is a class, we need to construct it
    // For now, we'll work around this by returning the original
    // and letting ScheduledContact handle the trimming
    return {
      start: newStart,
      end: newEnd,
      duration: newEnd.getTime() - newStart.getTime(),
      maxElevation: original.maxElevation,
      maxElevationTime: original.maxElevationTime,
      rangeAtMaxEl: original.rangeAtMaxEl,
      observer: original.observer,
      target: original.target,
    } as AccessWindow;
  }

  /**
   * Converts access windows to candidate ScheduledContacts with priorities.
   * @internal
   */
  private static createCandidateContacts_(
    windows: AccessWindow[],
    options: ScheduleOptions,
  ): ScheduledContact[] {
    const getPriority = options.satellitePriority ?? (() => ContactScheduler.DEFAULT_PRIORITY_);

    return windows.map((w) => {
      const satellite = w.target as Satellite;
      const priority = getPriority(satellite);

      return new ScheduledContact({
        accessWindow: w,
        priority,
        scheduledStart: w.start,
        scheduledEnd: w.end,
      });
    });
  }

  /**
   * Greedy scheduling algorithm: sorts by composite score and selects non-conflicting contacts.
   * @internal
   */
  private static greedySchedule_(
    candidates: ScheduledContact[],
    options: ScheduleOptions,
  ): ScheduledContact[] {
    const strategy = options.selectionStrategy ?? ContactSelectionStrategy.MAX_ELEVATION;
    const handoverTime = (options.stationHandoverTime ?? 0) as number;
    const defaultConcurrency = options.maxConcurrentPerStation ?? 1;
    const getConcurrencyLimit = options.stationConcurrencyLimit ?? (() => defaultConcurrency);
    const getStationPriority = options.stationPriority ?? (() => 0);
    const maxPerSatellite = options.maxContactsPerSatellite;
    const maxPerStation = options.maxContactsPerStation;

    // Calculate composite scores
    const scored = candidates.map((contact) => ({
      contact,
      score: ContactScheduler.calculateScore_(contact, strategy, getStationPriority),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const scheduled: ScheduledContact[] = [];
    const satContactCounts = new Map<number, number>();
    const stationContactCounts = new Map<number, number>();

    for (const { contact } of scored) {
      const satId = contact.satellite.id;
      const stationId = contact.station.id;

      // Check per-satellite limit
      if (maxPerSatellite !== undefined) {
        const satCount = satContactCounts.get(satId) ?? 0;

        if (satCount >= maxPerSatellite) {
          continue;
        }
      }

      // Check per-station limit
      if (maxPerStation !== undefined) {
        const stationCount = stationContactCounts.get(stationId) ?? 0;

        if (stationCount >= maxPerStation) {
          continue;
        }
      }

      // Check concurrency limit at this station
      const concurrencyLimit = getConcurrencyLimit(contact.station);

      if (!ContactScheduler.canAddToStation_(contact, scheduled, concurrencyLimit, handoverTime)) {
        continue;
      }

      // Add to schedule
      scheduled.push(contact);
      satContactCounts.set(satId, (satContactCounts.get(satId) ?? 0) + 1);
      stationContactCounts.set(stationId, (stationContactCounts.get(stationId) ?? 0) + 1);
    }

    return scheduled;
  }

  /**
   * Calculates composite score for a contact based on priority and quality.
   * @internal
   */
  private static calculateScore_(
    contact: ScheduledContact,
    strategy: ContactSelectionStrategy,
    getStationPriority: (station: GroundStation) => number,
  ): number {
    // Priority component (satellite priority * 1000 + station priority)
    const satPriority = contact.priority;
    const stationPriority = getStationPriority(contact.station);
    const priorityScore = satPriority * ContactScheduler.PRIORITY_MULTIPLIER_ + stationPriority;

    // Quality component based on strategy
    let qualityScore: number;

    switch (strategy) {
      case ContactSelectionStrategy.MAX_ELEVATION:
        qualityScore = contact.maxElevation; // 0-90
        break;
      case ContactSelectionStrategy.LONGEST_DURATION:
        qualityScore = contact.scheduledDuration / 1000; // Normalize to seconds
        break;
      case ContactSelectionStrategy.PRIORITY:
        qualityScore = 0; // Priority-only, no quality component
        break;
      case ContactSelectionStrategy.EARLIEST:
        // Negative so earlier times sort higher
        qualityScore = -contact.scheduledStart.getTime() / 1e12; // Normalize
        break;
      case ContactSelectionStrategy.MAX_TOTAL_TIME:
        qualityScore = contact.scheduledDuration / 1000;
        break;
      default:
        qualityScore = contact.maxElevation;
    }

    return priorityScore + qualityScore;
  }

  /**
   * Checks if a contact can be added to a station without exceeding concurrency limits.
   * @internal
   */
  private static canAddToStation_(
    contact: ScheduledContact,
    schedule: ScheduledContact[],
    concurrencyLimit: number,
    handoverMs: number,
  ): boolean {
    // Count overlapping contacts at this station
    const overlapping = schedule.filter(
      (existing) =>
        existing.station.id === contact.station.id &&
        ContactScheduler.timeOverlaps_(contact, existing, handoverMs),
    );

    return overlapping.length < concurrencyLimit;
  }

  /**
   * Checks if two contacts overlap in time (considering handover buffer).
   * @internal
   */
  private static timeOverlaps_(
    a: ScheduledContact,
    b: ScheduledContact,
    handoverMs: number,
  ): boolean {
    const aEnd = a.scheduledEnd.getTime() + handoverMs;
    const bEnd = b.scheduledEnd.getTime() + handoverMs;

    return !(aEnd <= b.scheduledStart.getTime() || a.scheduledStart.getTime() >= bEnd);
  }
}
