import type { Cycle } from "./cycle";

// Programme goal: how many videos (and how much creator spend) the programme should have by this point in
// the cycle. It is built on the headcount the CLIENT asked for (e.g. Artie: 50 creators), not on the roster —
// the roster is deliberately bigger to cover people we'll drop or who haven't started posting yet.
//
// Per creator, per month: perDay × 30 videos (2 a day = 60) and the client's monthly creator budget
// (Artie €600 incl. bonuses, shown in dollars). 50 × 60 = 3,000 videos and 50 creators × the budget per creator.
// "Expected by now" is that target spread evenly over the cycle (pro rata); the projection carries
// today's run-rate to the end of the cycle.

const DAY = 24 * 3600 * 1000;

export type GoalStatus = "ahead" | "on_track" | "behind";

export interface Measure {
  fullTarget: number; expected: number; actual: number;
  gap: number; remaining: number; projected: number; pct: number; status: GoalStatus;
}

export interface Goal {
  creators: number; // the target headcount
  perDay: number; perDayTotal: number; // team videos a day at full strength
  daysElapsed: number; daysTotal: number; neededPerDay: number;
  videos: Measure; spend: Measure | null;
}

function measure(fullTarget: number, frac: number, actual: number, elapsed: number, total: number): Measure {
  const expected = Math.round(fullTarget * frac);
  return {
    fullTarget: Math.round(fullTarget), expected, actual: Math.round(actual), gap: Math.round(actual) - expected,
    remaining: Math.max(0, Math.round(fullTarget - actual)),
    projected: elapsed >= 1 ? Math.round((actual / elapsed) * total) : Math.round(actual),
    pct: expected > 0 ? Math.round((actual / expected) * 100) : 100,
    status: actual >= expected ? "ahead" : actual >= expected * 0.9 ? "on_track" : "behind",
  };
}

export function goalFor(o: {
  cycle: Cycle; now: Date; actualVideos: number; actualSpend: number;
  targetCreators: number; perDay?: number; costPerCreator?: number | null;
}): Goal {
  const perDay = o.perDay ?? 2;
  const total = (o.cycle.end.getTime() - o.cycle.start.getTime()) / DAY;
  const elapsed = Math.min(total, Math.max(0, (o.now.getTime() - o.cycle.start.getTime()) / DAY));
  const frac = total > 0 ? elapsed / total : 0;
  const creators = Math.max(0, o.targetCreators);

  const videos = measure(creators * perDay * 30, frac, o.actualVideos, elapsed, total);
  const spend = o.costPerCreator && o.costPerCreator > 0 ? measure(creators * o.costPerCreator, frac, o.actualSpend, elapsed, total) : null;
  const daysLeft = Math.max(0, total - elapsed);
  return {
    creators, perDay, perDayTotal: creators * perDay,
    daysElapsed: Math.round(elapsed * 10) / 10, daysTotal: Math.round(total * 10) / 10,
    neededPerDay: daysLeft > 0 ? Math.ceil((videos.remaining / daysLeft) * 10) / 10 : videos.remaining,
    videos, spend,
  };
}
