import type { Cycle } from "./cycle";

// Creators are meant to post VIDEOS_PER_DAY videos a day. Expected-so-far is counted from the later of the
// cycle start and the creator's own start date on the payroll sheet, so someone who joined mid-cycle is
// measured only from the day they joined.

export type PaceStatus = "ahead" | "on_track" | "behind" | "just_started" | "not_started";

export interface Pace {
  expected: number; // videos they should have posted by now (or by cycle end, for a closed cycle)
  actual: number;
  delta: number; // actual - expected (negative = behind)
  days: number; // days counted
  status: PaceStatus;
  /** They joined partway through this cycle, so the expectation starts from their start date. */
  startedThisCycle: boolean;
}

const DAY = 24 * 3600 * 1000;
const ON_TRACK_FLOOR = 0.9; // within 10% of expected still counts as on track

export function paceFor(opts: { counted: number; cycle: Cycle; startDate: Date | null; now: Date; perDay: number }): Pace {
  const { counted, cycle, startDate, now, perDay } = opts;
  const startedThisCycle = !!startDate && startDate.getTime() > cycle.start.getTime() && startDate.getTime() < cycle.end.getTime();
  const effStart = startDate && startDate.getTime() > cycle.start.getTime() ? startDate : cycle.start;
  const effEnd = new Date(Math.min(now.getTime(), cycle.end.getTime()));

  if (effEnd.getTime() <= effStart.getTime()) {
    return { expected: 0, actual: counted, delta: counted, days: 0, status: "not_started", startedThisCycle };
  }
  const days = (effEnd.getTime() - effStart.getTime()) / DAY;
  const expected = Math.round(days * perDay);
  const delta = counted - expected;
  // Under a day in, there's nothing meaningful to judge yet.
  const status: PaceStatus = days < 1 ? "just_started"
    : counted >= expected ? "ahead"
    : counted >= expected * ON_TRACK_FLOOR ? "on_track" : "behind";
  return { expected, actual: counted, delta, days: Math.round(days * 10) / 10, status, startedThisCycle };
}
