import type { Cycle } from "./cycle";

// Programme goal, taken from the Art Master pricing calculator ("what you pay vs what you get", 50-creator row):
//   50 creators × 60 posts a month (2 a day)  → 3,000 videos
//   50 creators × 600 creator cost (incl. bonuses) → 30,000 spend
//   50 creators × 250,000 views each           → 12,500,000 views
// Each is spread evenly over the cycle (pro rata), so "expected by now" is the full target × share of the cycle gone.

export const GOAL_CREATORS = 50;
export const COST_PER_CREATOR = 600; // monthly, includes bonuses (calculator: "Creator Cost (incl. bonuses)")
export const VIEWS_PER_CREATOR = 250_000; // monthly (calculator: "Avg. Views per Creator")
const DAY = 24 * 3600 * 1000;

export type GoalStatus = "ahead" | "on_track" | "behind";

export interface Measure {
  fullTarget: number; expected: number; actual: number;
  gap: number; remaining: number; projected: number; pct: number; status: GoalStatus;
}

export interface Goal {
  creators: number; perDay: number; perDayTotal: number;
  daysElapsed: number; daysTotal: number; neededPerDay: number; // videos/day from here to hit the target
  videos: Measure; spend: Measure; views: Measure;
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
  cycle: Cycle; now: Date; actualVideos: number; actualSpend: number; actualViews: number;
  creators?: number; perDay?: number;
}): Goal {
  const creators = o.creators ?? GOAL_CREATORS;
  const perDay = o.perDay ?? 2;
  const total = (o.cycle.end.getTime() - o.cycle.start.getTime()) / DAY;
  const elapsed = Math.min(total, Math.max(0, (o.now.getTime() - o.cycle.start.getTime()) / DAY));
  const frac = total > 0 ? elapsed / total : 0;
  const videos = measure(creators * perDay * 30, frac, o.actualVideos, elapsed, total);
  const daysLeft = Math.max(0, total - elapsed);
  return {
    creators, perDay, perDayTotal: creators * perDay, daysElapsed: Math.round(elapsed * 10) / 10, daysTotal: Math.round(total * 10) / 10,
    neededPerDay: daysLeft > 0 ? Math.ceil((videos.remaining / daysLeft) * 10) / 10 : videos.remaining,
    videos, spend: measure(creators * COST_PER_CREATOR, frac, o.actualSpend, elapsed, total), views: measure(creators * VIEWS_PER_CREATOR, frac, o.actualViews, elapsed, total),
  };
}
