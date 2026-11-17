import type { Cycle } from "./cycle";

// Programme goal: how many videos SHOULD have been posted by this point in the cycle if the whole team
// is doing the working assumption (50 creators × 2 videos a day). Spend is a secondary goal: those videos
// at the team's average per-video rate.

export const GOAL_CREATORS = 50;
const DAY = 24 * 3600 * 1000;

export type GoalStatus = "ahead" | "on_track" | "behind";

export interface Goal {
  creators: number;
  perDay: number;
  perDayTotal: number; // team videos per day (creators × perDay)
  daysElapsed: number; // days counted so far this cycle (1 dp)
  daysTotal: number;
  expected: number; // videos that should exist by now
  fullTarget: number; // videos for the whole cycle
  actual: number;
  gap: number; // actual - expected (negative = behind)
  pctOfExpected: number; // 0-100+
  status: GoalStatus;
  /** Where the cycle ends up if the current daily rate simply continues. */
  projected: number;
  /** Spend goal, null when there are no rates to average. */
  spend: {
    avgRate: number;
    expected: number; // spend if the expected videos existed by now
    fullTarget: number; // spend for the whole cycle at target
    actual: number;
    /** Extra spend still needed to reach the full-cycle video target (remaining videos × avg rate). */
    stillNeeded: number;
    /** Pro rata: where spend lands by end of cycle if today's daily spend continues. */
    projected: number;
  } | null;
  /** Videos still needed to hit the cycle target, and the daily rate that takes (team-wide). */
  remaining: number;
  neededPerDay: number;
}

export function goalFor(o: {
  cycle: Cycle; now: Date; actual: number; actualSpend: number; avgRate: number | null;
  creators?: number; perDay?: number;
}): Goal {
  const creators = o.creators ?? GOAL_CREATORS;
  const perDay = o.perDay ?? 2;
  const perDayTotal = creators * perDay;
  const total = (o.cycle.end.getTime() - o.cycle.start.getTime()) / DAY;
  const elapsed = Math.min(total, Math.max(0, (o.now.getTime() - o.cycle.start.getTime()) / DAY));
  const expected = Math.round(elapsed * perDayTotal);
  const fullTarget = Math.round(total * perDayTotal);
  const gap = o.actual - expected;
  const pct = expected > 0 ? Math.round((o.actual / expected) * 100) : 100;
  const status: GoalStatus = o.actual >= expected ? "ahead" : o.actual >= expected * 0.9 ? "on_track" : "behind";
  const projected = elapsed >= 1 ? Math.round((o.actual / elapsed) * total) : o.actual;
  const spend = o.avgRate != null && o.avgRate > 0
    ? { avgRate: o.avgRate, expected: Math.round(expected * o.avgRate), fullTarget: Math.round(fullTarget * o.avgRate), actual: Math.round(o.actualSpend),
      stillNeeded: Math.round(Math.max(0, fullTarget - o.actual) * o.avgRate),
      projected: elapsed >= 1 ? Math.round((o.actualSpend / elapsed) * total) : Math.round(o.actualSpend) }
    : null;
  const remaining = Math.max(0, fullTarget - o.actual);
  const daysLeft = Math.max(0, total - elapsed);
  const neededPerDay = daysLeft > 0 ? Math.ceil((remaining / daysLeft) * 10) / 10 : remaining;
  return { remaining, neededPerDay, creators, perDay, perDayTotal, daysElapsed: Math.round(elapsed * 10) / 10, daysTotal: Math.round(total * 10) / 10, expected, fullTarget, actual: o.actual, gap, pctOfExpected: pct, status, projected, spend };
}
