import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cycleFor, shiftCycle, type Cycle } from "./cycle";
import { countVideos, type CountPost, type CountMode } from "./bonus";
import { paceFor, type PaceStatus } from "./pace";

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
  pace: { expected: number; actual: number; delta: number; status: PaceStatus; perDay: number; startedThisCycle: boolean; startLabel: string | null };
  bonusItems: ProgressBonusItem[];
  previousCycles: { key: string; startLabel: string; endLabel: string; countedVideos: number; bonusCount: number; bonusAmount: number; awaitingReview: number }[];
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
export async function getCreatorProgress(token: string, db: Db = prisma, now = new Date()): Promise<CreatorProgress | null> {
  if (!token || token.length < 20) return null;
  const creator = await db.artieCreator.findUnique({ where: { accessToken: token } });
  if (!creator || !creator.active) return null;
  const settings = await db.artieSettings.findUnique({ where: { id: "singleton" } });
  const threshold = settings?.bonusThreshold ?? 100000;
  const mode: CountMode = settings?.countMode === "instagram" ? "instagram" : "unique";

  const current = cycleFor(now);
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

  const previousCycles: CreatorProgress["previousCycles"] = [];
  let prev = current;
  for (let i = 0; i < 3; i++) {
    prev = shiftCycle(prev, -1);
    const d = await loadCreatorCycle(db, creator.id, prev, mode);
    if (d.posts.length === 0 && d.candidates.length === 0) continue;
    const reviewed = d.candidates.filter((c) => c.status === "approved" || c.status === "corrected");
    previousCycles.push({
      key: prev.key, startLabel: prev.startLabel, endLabel: prev.endLabel, countedVideos: d.counts.counted,
      bonusCount: reviewed.length,
      bonusAmount: reviewed.reduce((s, c) => s + (c.approvedAmount ?? c.initialAmount), 0),
      awaitingReview: d.candidates.filter((c) => c.status === "pending").length,
    });
  }

  const indicativeBonus = live.reduce((s, b) => s + b.amount, 0);
  const potential = creator.ratePerVideo != null
    ? (() => { const base = Math.round(counts.counted * creator.ratePerVideo! * 100) / 100; return { videos: counts.counted, rate: creator.ratePerVideo!, base, bonus: indicativeBonus, total: base + indicativeBonus }; })()
    : null;

  return {
    name: creator.name, avatarUrl: creator.avatarUrl ?? null, currency: settings?.currency ?? "USD",
    cycle: { key: current.key, startLabel: current.startLabel, endLabel: current.endLabel },
    countedVideos: counts.counted, bonusThreshold: threshold,
    bonusCount: live.length, indicativeBonus,
    pace: (() => {
      const perDay = settings?.videosPerDay ?? 2;
      const p = paceFor({ counted: counts.counted, cycle: current, startDate: creator.startDate ?? null, now, perDay });
      return { expected: p.expected, actual: p.actual, delta: p.delta, status: p.status, perDay, startedThisCycle: p.startedThisCycle,
        startLabel: p.startedThisCycle && creator.startDate ? creator.startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : null };
    })(),
    potential, bonusItems, previousCycles,
  };
}
