// Artie pay cycles run 29th → 28th. The 28th is the *counting cutoff*: a post
// at 28th 23:59 (London) belongs to the closing cycle, one at 29th 00:00 to
// the next. We model a cycle as [start, end) where `end` is London midnight on
// the 29th — Date.UTC overflow makes that Mar 1 in a non-leap February, which
// is exactly the end of Feb 28, so February needs no special case.

export const ARTIE_TZ = "Europe/London";

export interface Cycle {
  /** "YYYY-MM": the month the cycle ENDS in (the 28th that closes it). */
  key: string;
  /** Inclusive start instant. */
  start: Date;
  /** Exclusive end instant. */
  end: Date;
  /** Human labels: first and last counted day, e.g. 29 Oct → 28 Nov. */
  startLabel: string;
  endLabel: string;
}

/** Minutes the zone is ahead of UTC at a given instant. */
function offsetMinutes(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** The instant at which `tz` wall-clock reads y-m-d 00:00. `m` is 0-based; overflow normalises. */
export function zonedMidnight(y: number, m: number, d: number, tz = ARTIE_TZ): Date {
  const naive = Date.UTC(y, m, d); // y-m-d 00:00 as if it were UTC (overflow allowed)
  let guess = naive - offsetMinutes(new Date(naive), tz) * 60000;
  // Re-check once: the offset at the guessed instant can differ across a DST change.
  guess = naive - offsetMinutes(new Date(guess), tz) * 60000;
  return new Date(guess);
}

/** Boundary that closes the cycle ending in (y, m0): midnight on the 29th. */
function boundary(y: number, m0: number, tz: string): Date {
  return zonedMidnight(y, m0, 29, tz);
}

function ymdInZone(instant: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m0: get("month") - 1, d: get("day") };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function cycleFromEnd(y: number, m0: number, tz: string): Cycle {
  const endIdx = y * 12 + m0;
  const prev = new Date(Date.UTC(Math.floor((endIdx - 1) / 12), (endIdx - 1) % 12, 1));
  const start = boundary(prev.getUTCFullYear(), prev.getUTCMonth(), tz);
  const end = boundary(y, m0, tz);
  // First counted day = the 29th of the previous month; in a short February
  // that day doesn't exist, so label from the actual start instant.
  const s = ymdInZone(start, tz);
  return {
    key: `${y}-${String(m0 + 1).padStart(2, "0")}`,
    start, end,
    startLabel: `${s.d} ${MONTHS[s.m0]}`,
    endLabel: `28 ${MONTHS[m0]}`,
  };
}

/** The cycle containing `date`. */
export function cycleFor(date: Date, tz = ARTIE_TZ): Cycle {
  const { y, m0 } = ymdInZone(date, tz);
  // The cycle ending this month closes at boundary(y, m0); if we're past it, it's next month's.
  return date.getTime() < boundary(y, m0, tz).getTime()
    ? cycleFromEnd(y, m0, tz)
    : cycleFromEnd(m0 === 11 ? y + 1 : y, (m0 + 1) % 12, tz);
}

/** The cycle before/after a given one (delta = -1 / +1). */
export function shiftCycle(c: Cycle, delta: number, tz = ARTIE_TZ): Cycle {
  const [y, m] = c.key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return cycleFromEnd(Math.floor(idx / 12), ((idx % 12) + 12) % 12, tz);
}

export function cycleByKey(key: string, tz = ARTIE_TZ): Cycle | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return cycleFromEnd(Number(m[1]), Number(m[2]) - 1, tz);
}

export function inCycle(date: Date, c: Cycle): boolean {
  return date.getTime() >= c.start.getTime() && date.getTime() < c.end.getTime();
}

export const REMOVAL_GRACE_DAYS = 2;

/**
 * When someone removed from the payroll sheet should drop off the dashboard: the end of the
 * pay cycle they were removed in, plus a couple of days so the closing cycle can still be
 * reviewed and paid. A removal in the first days after a cycle closes belongs to that closed
 * cycle, so we look back by the grace period before picking the cycle.
 */
export function removalGraceEnd(removedAt: Date, tz = ARTIE_TZ): Date {
  const grace = REMOVAL_GRACE_DAYS * 24 * 3600 * 1000;
  return new Date(cycleFor(new Date(removedAt.getTime() - grace), tz).end.getTime() + grace);
}
