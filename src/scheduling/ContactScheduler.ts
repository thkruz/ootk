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
  /**
   * Maximize total scheduled contact time: the LONGEST_DURATION greedy pass followed by a
   * remove-one, greedy-refill exchange search that keeps any change that strictly increases total
   * time without using lower-priority contacts. A heuristic, not a proven optimum.
   */
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

  /**
   * User-defined priority function for satellites (higher = more important). Priority always
   * dominates: a higher-priority contact is chosen before any lower-priority one, whatever the
   * strategy's quality measure.
   */
  satellitePriority?: (satellite: Satellite) => number;

  /**
   * User-defined priority function for stations (higher = preferred). Tie-breaker only: used when
   * satellite priority and the strategy's quality measure are equal.
   */
  stationPriority?: (station: GroundStation) => number;

  /** Maximum concurrent contacts per station - global default (default: 1) */
  maxConcurrentPerStation?: number;

  /** Per-station override for concurrency limit based on sensor capabilities */
  stationConcurrencyLimit?: (station: GroundStation) => number;

  /**
   * Allow satellite handover between stations (default: false). When true, overlapping access
   * windows of one satellite at different stations are split at the midpoint of each overlap so
   * the pass can continue at the next station.
   */
  allowHandover?: boolean;

  /**
   * A satellite may be in at most one contact at any instant (default: true). Prevents one
   * satellite being scheduled at two stations over the same interval, which would double-count
   * coverage. Set false to allow simultaneous multi-station contacts (for example multistatic
   * tracking). Independent of `allowHandover`.
   */
  oneContactPerSatellite?: boolean;

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

  /** Prevent instantiation */
  private constructor() {
    // Static utility class
  }

  /**
   * Creates an optimized contact schedule for multiple stations and satellites.
   *
   * The scheduling algorithm uses a greedy approach with priority-based ordering:
   * 1. Generate all access windows
   * 2. Apply handover splitting if enabled
   * 3. Order candidates lexicographically by satellite priority, then the strategy's quality
   *    measure, then station priority (all descending)
   * 4. Greedily select contacts that respect the station concurrency limit (peak simultaneous
   *    contacts), the per-satellite exclusivity (`oneContactPerSatellite`) and the count limits
   * 5. For MAX_TOTAL_TIME, improve the result with an exchange local search
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
   * When the same satellite is visible from multiple stations, walks that satellite's windows in
   * start order and splits each overlap between consecutive stations at its midpoint, so a chain
   * A -> B -> C hands over twice. A window entirely inside the current one is left whole as a
   * competing candidate (the scheduler's satellite exclusivity then picks one).
   * Trimmed pieces shorter than `minHandoverDuration` are dropped.
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

    const emit = (w: AccessWindow, startMs: number, endMs: number): void => {
      if (startMs === w.start.getTime() && endMs === w.end.getTime()) {
        result.push(w);
      } else if (endMs - startMs >= minHandoverDuration) {
        result.push(ContactScheduler.createTrimmedWindow_(w, new Date(startMs), new Date(endMs)));
      }
    };

    for (const [, satWindows] of bySatellite) {
      satWindows.sort((a, b) => a.start.getTime() - b.start.getTime());

      let cur = satWindows[0];
      let curStart = cur.start.getTime();
      const curEnd = (): number => cur.end.getTime();

      for (let i = 1; i < satWindows.length; i++) {
        const next = satWindows[i];
        const nextStart = next.start.getTime();
        const nextEnd = next.end.getTime();

        if (next.observer.id === cur.observer.id || nextStart >= curEnd()) {
          // No handover: close the current window and move on
          emit(cur, curStart, curEnd());
          cur = next;
          curStart = nextStart;
          continue;
        }

        if (nextEnd <= curEnd()) {
          // Contained in the current window: keep it whole as a competing candidate
          result.push(next);
          continue;
        }

        // Hand over at the midpoint of the overlap [nextStart, curEnd]
        const handoverMs = (nextStart + curEnd()) / 2;

        emit(cur, curStart, handoverMs);
        cur = next;
        curStart = handoverMs;
      }
      emit(cur, curStart, curEnd());
    }

    return result;
  }

  /**
   * Creates a trimmed copy of an access window with new start/end times.
   *
   * If the original peak (`maxElevationTime`) lies inside the trimmed interval the peak is kept.
   * Otherwise elevation within a pass rises to the peak and then falls, so the highest point of
   * the trimmed piece is its end nearest the original peak; that edge is evaluated with
   * `observer.rae(target, date)`. When the observer cannot evaluate it (no `rae` method or a null
   * result), the original peak values are kept as an upper bound.
   * @internal
   */
  private static createTrimmedWindow_(
    original: AccessWindow,
    newStart: Date,
    newEnd: Date,
  ): AccessWindow {
    let maxElevation = original.maxElevation;
    let maxElevationTime = original.maxElevationTime;
    let rangeAtMaxEl = original.rangeAtMaxEl;
    const peakMs = original.maxElevationTime.getTime();

    if (peakMs < newStart.getTime() || peakMs > newEnd.getTime()) {
      const edge = peakMs < newStart.getTime() ? newStart : newEnd;
      const observer = original.observer as unknown as {
        rae?: (sat: Satellite, date: Date) => { rng: number; el: number } | null;
      };

      if (typeof observer.rae === 'function') {
        const rae = observer.rae(original.target as Satellite, edge);

        if (rae) {
          maxElevation = rae.el as typeof maxElevation;
          maxElevationTime = edge;
          rangeAtMaxEl = rae.rng as typeof rangeAtMaxEl;
        }
      }
    }

    return {
      start: newStart,
      end: newEnd,
      duration: newEnd.getTime() - newStart.getTime(),
      maxElevation,
      maxElevationTime,
      rangeAtMaxEl,
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
   * Greedy scheduling algorithm: orders candidates by priority, quality and station priority and
   * selects every contact that passes {@link ContactScheduler.canSchedule_}. MAX_TOTAL_TIME then
   * runs {@link ContactScheduler.improveTotalTime_}.
   * @internal
   */
  private static greedySchedule_(
    candidates: ScheduledContact[],
    options: ScheduleOptions,
  ): ScheduledContact[] {
    const strategy = options.selectionStrategy ?? ContactSelectionStrategy.MAX_ELEVATION;
    const getStationPriority = options.stationPriority ?? (() => 0);

    // Lexicographic order: satellite priority, then quality, then station priority (descending)
    const ranked = candidates.map((contact) => ({
      contact,
      priority: contact.priority,
      quality: ContactScheduler.qualityScore_(contact, strategy),
      stationPriority: getStationPriority(contact.station),
    }));

    ranked.sort((a, b) => (b.priority - a.priority) || (b.quality - a.quality) || (b.stationPriority - a.stationPriority));

    const scheduled: ScheduledContact[] = [];

    for (const { contact } of ranked) {
      if (ContactScheduler.canSchedule_(contact, scheduled, options)) {
        scheduled.push(contact);
      }
    }

    if (strategy === ContactSelectionStrategy.MAX_TOTAL_TIME) {
      return ContactScheduler.improveTotalTime_(ranked.map((r) => r.contact), scheduled, options);
    }

    return scheduled;
  }

  /**
   * Exchange local search for MAX_TOTAL_TIME (remove one, greedily refill): for each scheduled
   * contact, remove it and greedily add the longest unscheduled candidates that now fit; keep the
   * change when the added time exceeds the removed time. Candidates with lower satellite priority
   * than the removed contact are never used, so priority still dominates. Each accepted move
   * strictly increases total scheduled time, so the search terminates (also capped at 50 moves).
   * @internal
   */
  private static improveTotalTime_(
    candidates: ScheduledContact[],
    initial: ScheduledContact[],
    options: ScheduleOptions,
  ): ScheduledContact[] {
    let scheduled = [...initial];
    const byDuration = [...candidates].sort((a, b) => b.scheduledDuration - a.scheduledDuration);

    for (let moves = 0; moves < 50; moves++) {
      let improved = false;

      for (const removed of scheduled) {
        const base = scheduled.filter((e) => e !== removed);
        const added: ScheduledContact[] = [];

        for (const c of byDuration) {
          if (c === removed || c.priority < removed.priority || scheduled.includes(c)) {
            continue;
          }
          if (ContactScheduler.canSchedule_(c, [...base, ...added], options)) {
            added.push(c);
          }
        }

        const gain = added.reduce((sum, c) => sum + c.scheduledDuration, 0) - removed.scheduledDuration;

        if (gain > 0) {
          scheduled = [...base, ...added];
          improved = true;
          break;
        }
      }

      if (!improved) {
        break;
      }
    }

    return scheduled;
  }

  /**
   * Whether `contact` can be added to `scheduled`: per-satellite and per-station count limits,
   * satellite exclusivity (`oneContactPerSatellite`) and the station concurrency limit.
   * @internal
   */
  private static canSchedule_(contact: ScheduledContact, scheduled: ScheduledContact[], options: ScheduleOptions): boolean {
    const handoverMs = (options.stationHandoverTime ?? 0) as number;
    const defaultConcurrency = options.maxConcurrentPerStation ?? 1;
    const concurrencyLimit = (options.stationConcurrencyLimit ?? (() => defaultConcurrency))(contact.station);
    const satId = contact.satellite.id;
    const stationId = contact.station.id;

    if (options.maxContactsPerSatellite !== undefined &&
      scheduled.filter((e) => e.satellite.id === satId).length >= options.maxContactsPerSatellite) {
      return false;
    }

    if (options.maxContactsPerStation !== undefined &&
      scheduled.filter((e) => e.station.id === stationId).length >= options.maxContactsPerStation) {
      return false;
    }

    // One satellite, one contact at a time (no handover buffer: back-to-back handovers are fine)
    if ((options.oneContactPerSatellite ?? true) &&
      scheduled.some((e) => e.satellite.id === satId && ContactScheduler.timeOverlaps_(contact, e, 0))) {
      return false;
    }

    return ContactScheduler.canAddToStation_(contact, scheduled, concurrencyLimit, handoverMs);
  }

  /**
   * Quality measure of a contact for a strategy (higher is better). Compared only between
   * contacts of equal satellite priority.
   * @internal
   */
  private static qualityScore_(contact: ScheduledContact, strategy: ContactSelectionStrategy): number {
    switch (strategy) {
      case ContactSelectionStrategy.MAX_ELEVATION:
        return contact.maxElevation;
      case ContactSelectionStrategy.LONGEST_DURATION:
      case ContactSelectionStrategy.MAX_TOTAL_TIME:
        return contact.scheduledDuration;
      case ContactSelectionStrategy.PRIORITY:
        return 0;
      case ContactSelectionStrategy.EARLIEST:
        // Negative so earlier times rank higher
        return -contact.scheduledStart.getTime();
      default:
        return contact.maxElevation;
    }
  }

  /**
   * Checks if a contact can be added to a station without exceeding its concurrency limit: the
   * peak number of simultaneous contacts at the station during the new contact (each interval
   * extended by the handover buffer), plus the new one, must not exceed the limit.
   * @internal
   */
  private static canAddToStation_(
    contact: ScheduledContact,
    schedule: ScheduledContact[],
    concurrencyLimit: number,
    handoverMs: number,
  ): boolean {
    const overlapping = schedule.filter(
      (existing) =>
        existing.station.id === contact.station.id &&
        ContactScheduler.timeOverlaps_(contact, existing, handoverMs),
    );

    if (overlapping.length < concurrencyLimit) {
      return true;
    }

    // Sweep the overlapping intervals for the peak simultaneous count (ends sort before starts)
    const events: [number, number][] = [];

    for (const e of overlapping) {
      events.push([e.scheduledStart.getTime(), 1], [e.scheduledEnd.getTime() + handoverMs, -1]);
    }
    events.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));

    let active = 0;
    let peak = 0;

    for (const [, delta] of events) {
      active += delta;
      peak = Math.max(peak, active);
    }

    return peak + 1 <= concurrencyLimit;
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
