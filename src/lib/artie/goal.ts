import type { Cycle } from "./cycle";

// Programme goal: how many videos (and how much creator spend) the team SHOULD have by this point in the
// cycle, built from each creator's own start. Per creator, per month: perDay × 30 videos (2 a day = 60) and the
// client's monthly creator budget (Artie €600 incl. bonuses, Ecosia ~€500 — from their pricing sheets).
//
// Creators who start mid-cycle only owe the share of the cycle they were actually here for, so a late joiner
// doesn't make the team look behind on days before they existed. A member's clock starts at their first post
// (or, if they haven't posted yet, their sheet start date, so someone onboarded but silent shows as a gap).

const DAY = 24 * 3600 * 1000;

export type GoalStatus = "ahead" | "on_track" | "behind";

export interface Measure {
  fullTarget: number; expected: number; actual: number;
  gap: number; remaining: number; projected: number; pct: number; status: GoalStatus;
}

export interface GoalMember { start: Date | null }

export interface Goal {
  creators: number; // members counted so far this cycle (started before the cycle ended)
  perDay: number; perDayTotal: number; // team videos a day once everyone is active
  daysElapsed: number; daysTotal: number; neededPerDay: number;
  videos: Measure; spend: Measure | null;
}

function measure(fullTarget: number, expected: number, actual: number, activeSoFar: number, activeTotal: number): Measure {
  const exp = Math.round(expected);
  return {
    fullTarget: Math.round(fullTarget), expected: exp, actual: Math.round(actual), gap: Math.round(actual) - exp,
    remaining: Math.max(0, Math.round(fullTarget - actual)),
    // Project on activity, not the calendar: today's output per active creator-day carried over every creator-day of the cycle.
    projected: activeSoFar >= 1 ? Math.round((actual / activeSoFar) * activeTotal) : Math.round(actual),
    pct: exp > 0 ? Math.round((actual / exp) * 100) : 100,
    status: actual >= exp ? "ahead" : actual >= exp * 0.9 ? "on_track" : "behind",
  };
}

export function goalFor(o: {
  cycle: Cycle; now: Date; actualVideos: number; actualSpend: number;
  members: GoalMember[]; perDay?: number; costPerCreator?: number | null;
}): Goal {
  const perDay = o.perDay ?? 2;
  const startMs = o.cycle.start.getTime(), endMs = o.cycle.end.getTime();
  const total = (endMs - startMs) / DAY;
  const nowMs = Math.min(Math.max(o.now.getTime(), startMs), endMs);
  const elapsed = (nowMs - startMs) / DAY;

  let share = 0, expectedShare = 0, activeSoFar = 0, activeTotal = 0, counted = 0, active = 0;
  for (const m of o.members) {
    if (!m.start) continue; // no post and no sheet date: nothing to measure from
    const eff = Math.max(startMs, m.start.getTime());
    if (eff >= endMs) continue; // starts after this cycle closes
    const window = (endMs - eff) / DAY;
    const sofar = Math.min(window, Math.max(0, (nowMs - eff) / DAY));
    const portion = window / total; // share of the cycle they're here for
    share += portion;
    expectedShare += portion * (sofar / window);
    activeSoFar += sofar; activeTotal += window;
    counted++;
    if (sofar > 0) active++;
  }

  const monthlyVideos = perDay * 30;
  const videos = measure(share * monthlyVideos, expectedShare * monthlyVideos, o.actualVideos, activeSoFar, activeTotal);
  const spend = o.costPerCreator && o.costPerCreator > 0
    ? measure(share * o.costPerCreator, expectedShare * o.costPerCreator, o.actualSpend, activeSoFar, activeTotal) : null;
  const daysLeft = Math.max(0, total - elapsed);
  return {
    creators: counted, perDay,
    perDayTotal: active * perDay,
    daysElapsed: Math.round(elapsed * 10) / 10, daysTotal: Math.round(total * 10) / 10,
    neededPerDay: daysLeft > 0 ? Math.ceil((videos.remaining / daysLeft) * 10) / 10 : videos.remaining,
    videos, spend,
  };
}
