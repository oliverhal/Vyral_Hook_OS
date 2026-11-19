import type { Cycle } from "./cycle";

// Creators are meant to post VIDEOS_PER_DAY videos a day. Expected-so-far is counted from the later of the
// cycle start and the creator's FIRST POST (not their onboarding date on the sheet — onboarding can be weeks
// before they actually start posting). No post yet → nothing is expected of them yet.

export type PaceStatus = "ahead" | "on_track" | "behind" | "just_started" | "not_started";

export interface Pace {
  expected: number; // videos they should have posted by now (or by cycle end, for a closed cycle)
  actual: number;
  delta: number; // actual - expected (negative = behind)
  days: number; // days counted
  status: PaceStatus;
  /** They joined partway through this cycle, so the expectation starts from their start date. */
  startedThisCycle: boolean;
  /** Videos expected over the WHOLE cycle (from their start date). */
  fullTarget: number;
  /** Videos still needed to hit that full target (0 if already there). */
  remaining: number;
  /** Days left in the cycle. */
  daysLeft: number;
  /** Videos per day from here to finish the cycle on target (rounded up to 0.1). */
  neededPerDay: number;
  /** The agreed daily target this was computed against. */
  perDay: number;
}

const DAY = 24 * 3600 * 1000;
const ON_TRACK_FLOOR = 0.9; // within 10% of expected still counts as on track

export function paceFor(opts: { counted: number; cycle: Cycle; firstPostAt: Date | null; now: Date; perDay: number }): Pace {
  const { counted, cycle, firstPostAt: startDate, now, perDay } = opts;
  if (!startDate) {
    // Never posted: no clock has started, so they can't be behind (or ahead).
    return { expected: 0, actual: counted, delta: counted, days: 0, status: "not_started", startedThisCycle: false, fullTarget: 0, remaining: 0, daysLeft: 0, neededPerDay: 0, perDay };
  }
  const startedThisCycle = !!startDate && startDate.getTime() > cycle.start.getTime() && startDate.getTime() < cycle.end.getTime();
  const effStart = startDate && startDate.getTime() > cycle.start.getTime() ? startDate : cycle.start;
  const effEnd = new Date(Math.min(now.getTime(), cycle.end.getTime()));

  const fullTarget = Math.max(0, Math.round(((cycle.end.getTime() - effStart.getTime()) / DAY) * perDay));
  const remaining = Math.max(0, fullTarget - counted);
  const daysLeft = Math.max(0, (cycle.end.getTime() - Math.max(now.getTime(), effStart.getTime())) / DAY);
  const neededPerDay = daysLeft > 0 ? Math.ceil((remaining / daysLeft) * 10) / 10 : remaining;
  const catchUp = { fullTarget, remaining, daysLeft: Math.round(daysLeft * 10) / 10, neededPerDay, perDay };

  if (effEnd.getTime() <= effStart.getTime()) {
    return { expected: 0, actual: counted, delta: counted, days: 0, status: "not_started", startedThisCycle, ...catchUp };
  }
  const days = (effEnd.getTime() - effStart.getTime()) / DAY;
  const expected = Math.round(days * perDay);
  const delta = counted - expected;
  // Under a day in, there's nothing meaningful to judge yet.
  const status: PaceStatus = days < 1 ? "just_started"
    : counted >= expected ? "ahead"
    : counted >= expected * ON_TRACK_FLOOR ? "on_track" : "behind";
  return { expected, actual: counted, delta, days: Math.round(days * 10) / 10, status, startedThisCycle, ...catchUp };
}
