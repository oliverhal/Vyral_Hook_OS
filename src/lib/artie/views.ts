import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cycleFor, shiftCycle, type Cycle } from "./cycle";
import { countVideos, type CountPost, type CountMode } from "./bonus";
import { paceFor, type PaceStatus } from "./pace";
import { rankTier, type RankTier, type RankInput } from "./rank";
import { creatorNudge, type CreatorNudge } from "./nudge";

// Minimal slice of the Prisma client these loaders use — lets tests inject an
// in-memory fake to prove one creator's token can never surface another's data.
export type Db = Pick<PrismaClient, "artieCreator" | "artiePost" | "artieBonusCandidate" | "artieSettings">;

const toCountPost = (p: { id: string; platform: string; views: number; igMatchId: string | null; countDecision: string | null }): CountPost => ({
  id: p.id, platform: p.platform, views: p.views, igMatchId: p.igMatchId, countDecision: p.countDecision,
});

export const parseJson = <T,>(s: string | null | undefined, fallback: T): T => {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
};

/** What one creator counts for in one cycle. Always filtered by creatorId. */
/** Earliest post we've ever seen per creator (any platform, any cycle) — when their posting clock starts. */
export async function firstPostDates(db: Db, creatorIds?: string[]): Promise<Map<string, Date>> {
  const rows = await db.artiePost.groupBy({ by: ["creatorId"], where: creatorIds ? { creatorId: { in: creatorIds } } : {}, _min: { publishedAt: true } });
  const m = new Map<string, Date>();
  for (const r of rows) if (r._min?.publishedAt) m.set(r.creatorId, r._min.publishedAt);
  return m;
}

export async function loadCreatorCycle(db: Db, creatorId: string, cycle: Cycle, mode: CountMode = "unique") {
  const posts = await db.artiePost.findMany({
    where: { creatorId, publishedAt: { gte: cycle.start, lt: cycle.end } },
    orderBy: { publishedAt: "desc" },
  });
  const candidates = await db.artieBonusCandidate.findMany({
    where: { creatorId, cycleKey: cycle.key },
    orderBy: { maxViews: "desc" },
  });
  return { posts, candidates, counts: countVideos(posts.map(toCountPost), mode) };
}

// ── Creator-facing ───────────────────────────────────────────────────────────

export interface ProgressBonusItem {
  url: string;
  platform: string;
  views: number;
  publishedAt: string;
  state: "under_review" | "approved" | "adjusted" | "not_approved";
  /** What counts toward the total right now (0 if not approved). */
  amount: number;
  /** What the creator saw before review changed it; only set when it differs. */
  previouslyShown: number | null;
}

export interface CreatorProgress {
  name: string;
  avatarUrl: string | null;
  currency: string;
  cycle: { key: string; startLabel: string; endLabel: string };
  countedVideos: number;
  bonusThreshold: number;
  bonusCount: number; // excludes ones rejected on review
  indicativeBonus: number;
  /** videos × their per-video rate + indicative bonuses; null if there's no rate on the payroll sheet. */
  potential: { videos: number; rate: number; base: number; bonus: number; total: number } | null;
  /** Where they are against the daily posting target (counted from their own start date). */
  pace: { expected: number; actual: number; delta: number; status: PaceStatus; perDay: number; startedThisCycle: boolean; startLabel: string | null;
    fullTarget: number; remaining: number; daysLeft: number; neededPerDay: number } | null;
  /** Top-10/25/50% tier among active creators this cycle (views per day), or null. Never includes anyone else's data. */
  rank: { tier: RankTier } | null;
  /** When behind: what they're missing (videos + money) and what to do about it. */
  nudge: CreatorNudge | null;
  bonusItems: ProgressBonusItem[];
}

function bonusState(status: string): ProgressBonusItem["state"] {
  return status === "approved" ? "approved" : status === "corrected" ? "adjusted" : status === "rejected" ? "not_approved" : "under_review";
}

/**
 * Resolve a creator by their private token and build their page data.
 * The token is the ONLY input; every query after the lookup is keyed by the
 * resolved creator id. Internal fields (flags, other platforms' counts,
 * discrepancy, rate, review reasons) are deliberately not included.
 */
/** Aggregate (id, views, days) for every active creator → this creator's tier. Only the tier leaves this function. */
async function tierFor(db: Db, creatorId: string, cycle: Cycle, now: Date): Promise<RankTier | null> {
  const [creators, sums, firsts] = await Promise.all([
    db.artieCreator.findMany({ where: { active: true }, select: { id: true } }),
    db.artiePost.groupBy({ by: ["creatorId"], where: { publishedAt: { gte: cycle.start, lt: cycle.end } }, _sum: { views: true } }),
    firstPostDates(db),
  ]);
  const views = new Map(sums.map((r) => [r.creatorId, r._sum.views ?? 0]));
  const DAY = 24 * 3600 * 1000;
  const end = Math.min(now.getTime(), cycle.end.getTime());
  const inputs: RankInput[] = creators.map((c) => {
    const first = firsts.get(c.id);
    const start = first ? Math.max(cycle.start.getTime(), first.getTime()) : end; // never posted → 0 active days
    return { id: c.id, totalViews: views.get(c.id) ?? 0, activeDays: Math.max(0, (end - start) / DAY) };
  });
  return rankTier(inputs, creatorId);
}

export async function getCreatorProgress(token: string, db: Db = prisma, now = new Date()): Promise<CreatorProgress | null> {
  if (!token || token.length < 20) return null;
  const creator = await db.artieCreator.findUnique({ where: { accessToken: token } });
  if (!creator || !creator.active) return null;
  const settings = await db.artieSettings.findUnique({ where: { id: "singleton" } });
  const threshold = settings?.bonusThreshold ?? 100000;
  const mode: CountMode = settings?.countMode === "instagram" ? "instagram" : "unique";

  const current = cycleFor(now);
  const firstPostAt = (await firstPostDates(db, [creator.id])).get(creator.id) ?? null;
  const { posts, candidates, counts } = await loadCreatorCycle(db, creator.id, current, mode);
  const postById = new Map(posts.map((p) => [p.id, p]));

  const bonusItems: ProgressBonusItem[] = [];
  for (const c of candidates) {
    const p = postById.get(c.primaryPostId);
    if (!p) continue;
    const state = bonusState(c.status);
    const amount = state === "under_review" ? c.initialAmount : state === "not_approved" ? 0 : c.approvedAmount ?? c.initialAmount;
    bonusItems.push({
      url: p.url, platform: p.platform, views: c.maxViews, publishedAt: p.publishedAt.toISOString(),
      state, amount, previouslyShown: amount !== c.initialAmount ? c.initialAmount : null,
    });
  }
  const live = bonusItems.filter((b) => b.state !== "not_approved");

  const indicativeBonus = live.reduce((s, b) => s + b.amount, 0);
  const potential = creator.ratePerVideo != null
    ? (() => { const base = Math.round(counts.counted * creator.ratePerVideo! * 100) / 100; return { videos: counts.counted, rate: creator.ratePerVideo!, base, bonus: indicativeBonus, total: base + indicativeBonus }; })()
    : null;

  return {
    name: creator.name, avatarUrl: creator.avatarUrl ?? null, currency: settings?.currency ?? "USD",
    cycle: { key: current.key, startLabel: current.startLabel, endLabel: current.endLabel },
    countedVideos: counts.counted, bonusThreshold: threshold,
    bonusCount: live.length, indicativeBonus,
    pace: (settings?.showPaceToCreators === false) ? null : (() => {
      const perDay = settings?.videosPerDay ?? 2;
      const p = paceFor({ counted: counts.counted, cycle: current, firstPostAt, now, perDay });
      return { expected: p.expected, actual: p.actual, delta: p.delta, status: p.status, perDay, startedThisCycle: p.startedThisCycle,
        fullTarget: p.fullTarget, remaining: p.remaining, daysLeft: p.daysLeft, neededPerDay: p.neededPerDay,
        startLabel: p.startedThisCycle && firstPostAt ? firstPostAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : null };
    })(),
    rank: settings?.showRankToCreators === false ? null : await tierFor(db, creator.id, current, now).then((tier) => (tier ? { tier } : null)),
    nudge: settings?.showPaceToCreators === false ? null : (() => {
      const perDay = settings?.videosPerDay ?? 2;
      const pc = paceFor({ counted: counts.counted, cycle: current, firstPostAt, now, perDay });
      const top = posts.reduce<typeof posts[number] | null>((m, x) => (!m || x.views > m.views ? x : m), null);
      return creatorNudge({ pace: pc, rate: creator.ratePerVideo ?? null, currency: settings?.currency ?? "USD", bonusAmount: settings?.bonusAmount ?? 50, threshold,
        cycleEndLabel: current.endLabel, best: top && top.views >= 1000 ? { views: top.views, platform: top.platform, url: top.url } : null });
    })(),
    potential, bonusItems,
  };
}
