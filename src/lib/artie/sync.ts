import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import * as viralApp from "@/lib/viralApp";
import { normalizeHandle } from "@/lib/connectedAccounts";
import { cycleFor, shiftCycle, inCycle, type Cycle } from "./cycle";
import { fetchRoster } from "./payrollSheet";
import { matchCrossPosts } from "./match";
import { detectCandidates, type CountPost } from "./bonus";

export function newAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function getSettings() {
  return prisma.artieSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
}

// ── Roster ───────────────────────────────────────────────────────────────────

export async function syncRoster(): Promise<{ created: number; updated: number; deactivated: number; unmapped: number; error?: string }> {
  const settings = await getSettings();
  const fail = async (error: string) => {
    await prisma.artieSettings.update({ where: { id: "singleton" }, data: { lastSyncError: error } });
    return { created: 0, updated: 0, deactivated: 0, unmapped: 0, error };
  };
  if (!settings.payrollSheetUrl) return fail("No payroll sheet link set yet.");

  const roster = await fetchRoster(settings.payrollSheetUrl);
  if (roster.error) return fail(roster.error);
  // Safety: an empty result almost certainly means a bad/blank sheet — never deactivate everyone over that.
  if (roster.creators.length === 0) return fail("The payroll sheet had no creators in it, so nothing was changed.");

  const existing = await prisma.artieCreator.findMany();
  const byKey = new Map(existing.map((c) => [c.sheetKey, c]));
  let created = 0, updated = 0;

  for (const r of roster.creators) {
    const cur = byKey.get(r.sheetKey);
    const data = { name: r.name, ratePerVideo: r.ratePerVideo, instagram: r.instagram, tiktok: r.tiktok, facebook: r.facebook, active: true };
    if (cur) {
      const changed = cur.name !== r.name || cur.ratePerVideo !== r.ratePerVideo || cur.instagram !== r.instagram ||
        cur.tiktok !== r.tiktok || cur.facebook !== r.facebook || !cur.active;
      if (changed) { await prisma.artieCreator.update({ where: { id: cur.id }, data }); updated++; }
    } else {
      await prisma.artieCreator.create({ data: { sheetKey: r.sheetKey, ...data, accessToken: newAccessToken() } });
      created++;
    }
  }

  const keep = new Set(roster.creators.map((r) => r.sheetKey));
  const gone = existing.filter((c) => c.active && !keep.has(c.sheetKey)).map((c) => c.id);
  if (gone.length) await prisma.artieCreator.updateMany({ where: { id: { in: gone } }, data: { active: false } });

  await prisma.artieSettings.update({
    where: { id: "singleton" },
    data: { lastRosterSyncAt: new Date(), lastSyncError: null, unmappedRows: JSON.stringify(roster.unmapped) },
  });
  return { created, updated, deactivated: gone.length, unmapped: roster.unmapped.length };
}

// ── Videos ───────────────────────────────────────────────────────────────────

type Creator = Awaited<ReturnType<typeof prisma.artieCreator.findMany>>[number];

function buildLookup(creators: Creator[]) {
  const map = new Map<string, string>(); // `${platform}:${handle}` -> creatorId
  for (const c of creators) {
    if (c.instagram) map.set(`instagram:${normalizeHandle(c.instagram)}`, c.id);
    if (c.tiktok) map.set(`tiktok:${normalizeHandle(c.tiktok)}`, c.id);
    if (c.facebook) map.set(`facebook:${normalizeHandle(c.facebook)}`, c.id);
  }
  return (v: viralApp.ViralAppTrackedVideo): string | null => {
    if (v.platform === "facebook") {
      // viral.app reports a numeric page id as the username; the sheet may hold an id or a page name.
      for (const k of [v.accountUsername, v.platformAccountId, v.accountDisplayName]) {
        const hit = k ? map.get(`facebook:${normalizeHandle(k)}`) : undefined;
        if (hit) return hit;
      }
      return null;
    }
    return map.get(`${v.platform}:${normalizeHandle(v.accountUsername)}`) ?? null;
  };
}

export async function syncVideos(): Promise<{ matched: number; created: number; updated: number; unmatchedVideos: number; truncated: boolean }> {
  const creators = await prisma.artieCreator.findMany({ where: { active: true } });
  if (creators.length === 0) return { matched: 0, created: 0, updated: 0, unmatchedVideos: 0, truncated: false }; // nothing to match against yet
  const now = new Date();
  const current = cycleFor(now);
  const previous = shiftCycle(current, -1);
  const { videos, truncated } = await viralApp.fetchVideosBetween(previous.start, current.end);

  const creatorFor = buildLookup(creators);
  const existing = await prisma.artiePost.findMany({ where: { publishedAt: { gte: previous.start, lt: current.end } } });
  const byKey = new Map(existing.map((p) => [`${p.platform}:${p.platformVideoId}`, p]));

  const toCreate: Prisma.ArtiePostCreateManyInput[] = [];
  const updates: ReturnType<typeof prisma.artiePost.update>[] = [];
  const unmatched = new Map<string, { platform: string; username: string; videos: number }>();
  let matched = 0, unmatchedVideos = 0;

  for (const v of videos) {
    const creatorId = creatorFor(v);
    if (!creatorId) {
      unmatchedVideos++;
      const k = `${v.platform}:${v.accountUsername ?? v.platformAccountId ?? "?"}`;
      const u = unmatched.get(k) ?? { platform: v.platform, username: v.accountUsername ?? v.platformAccountId ?? "?", videos: 0 };
      u.videos++; unmatched.set(k, u);
      continue;
    }
    matched++;
    const row = {
      creatorId, platform: v.platform, platformVideoId: v.platformVideoId, username: v.accountUsername,
      url: viralApp.videoUrl(v.platform, v.platformVideoId, v.accountUsername), caption: v.caption,
      publishedAt: new Date(v.publishedAt as string), views: v.viewCount, durationSeconds: v.durationSeconds,
    };
    const cur = byKey.get(`${v.platform}:${v.platformVideoId}`);
    if (!cur) toCreate.push(row);
    else if (cur.creatorId !== creatorId || cur.views !== row.views || cur.caption !== row.caption || cur.durationSeconds !== row.durationSeconds) {
      updates.push(prisma.artiePost.update({ where: { id: cur.id }, data: { ...row, lastSeenAt: now } }));
    }
  }

  if (toCreate.length) await prisma.artiePost.createMany({ data: toCreate, skipDuplicates: true });
  for (let i = 0; i < updates.length; i += 100) await prisma.$transaction(updates.slice(i, i + 100));

  const top = Array.from(unmatched.values()).sort((a, b) => b.videos - a.videos).slice(0, 50);
  await prisma.artieSettings.update({
    where: { id: "singleton" },
    data: {
      lastVideoSyncAt: now, unmatchedAccounts: JSON.stringify(top),
      // Only ever *set* an error here — clearing is the roster sync's job, so a roster
      // problem isn't hidden by a successful video pull.
      ...(truncated ? { lastSyncError: "viral.app returned more videos than the page cap — counts may be incomplete." } : {}),
    },
  });
  return { matched, created: toCreate.length, updated: updates.length, unmatchedVideos, truncated };
}

// ── Cross-post matching + bonus candidates ───────────────────────────────────

export async function recomputeMatches(from: Date, to: Date): Promise<number> {
  const posts = await prisma.artiePost.findMany({ where: { publishedAt: { gte: from, lt: to } } });
  const byCreator = new Map<string, typeof posts>();
  for (const p of posts) (byCreator.get(p.creatorId) ?? byCreator.set(p.creatorId, []).get(p.creatorId)!).push(p);

  const ops: ReturnType<typeof prisma.artiePost.update>[] = [];
  byCreator.forEach((list) => {
    // Reviewer-set matches are left exactly as they are; only auto ones are recomputed.
    const autoPool = list.filter((p) => p.matchSource !== "manual");
    const results = matchCrossPosts(
      autoPool.map((p) => ({ id: p.id, platform: p.platform, publishedAt: p.publishedAt.getTime(), durationSeconds: p.durationSeconds, caption: p.caption }))
    );
    const matchOf = new Map(results.map((r) => [r.postId, r.igId]));
    for (const p of autoPool) {
      if (p.platform === "instagram") continue;
      const want = matchOf.get(p.id) ?? null;
      if (p.igMatchId !== want) {
        ops.push(prisma.artiePost.update({ where: { id: p.id }, data: { igMatchId: want, matchSource: want ? "auto" : null } }));
      }
    }
  });
  for (let i = 0; i < ops.length; i += 100) await prisma.$transaction(ops.slice(i, i + 100));
  return ops.length;
}

const toCountPost = (p: { id: string; platform: string; views: number; igMatchId: string | null; countDecision: string | null }): CountPost => ({
  id: p.id, platform: p.platform, views: p.views, igMatchId: p.igMatchId, countDecision: p.countDecision,
});

export async function recomputeCandidates(cycle: Cycle): Promise<{ created: number; refreshed: number; removed: number }> {
  const settings = await getSettings();
  const creators = await prisma.artieCreator.findMany({ where: { active: true } });
  const posts = await prisma.artiePost.findMany({ where: { publishedAt: { gte: cycle.start, lt: cycle.end } } });
  const existing = await prisma.artieBonusCandidate.findMany({ where: { cycleKey: cycle.key } });
  const existingByPrimary = new Map(existing.map((c) => [c.primaryPostId, c]));
  let created = 0, refreshed = 0;
  const detectedPrimaries = new Set<string>();

  for (const creator of creators) {
    const mine = posts.filter((p) => p.creatorId === creator.id);
    if (!mine.length) continue;
    const cands = detectCandidates(mine.map(toCountPost), {
      threshold: settings.bonusThreshold,
      hasFacebookAccount: Boolean(creator.facebook),
      facebookLinked: creator.facebookLinked,
    });
    for (const c of cands) {
      detectedPrimaries.add(c.primaryPostId);
      const cur = existingByPrimary.get(c.primaryPostId);
      const fields = {
        relatedPostIds: JSON.stringify(c.relatedPostIds), qualifiesOn: JSON.stringify(c.qualifiesOn),
        flags: JSON.stringify(c.flags), maxViews: c.maxViews,
      };
      if (!cur) {
        const row = await prisma.artieBonusCandidate.create({
          data: { creatorId: creator.id, cycleKey: cycle.key, primaryPostId: c.primaryPostId, initialAmount: settings.bonusAmount, ...fields },
        });
        await prisma.artieBonusEvent.create({ data: { candidateId: row.id, action: "detected", after: JSON.stringify({ ...fields, amount: settings.bonusAmount }), actor: "system" } });
        created++;
      } else if (cur.status === "pending") {
        await prisma.artieBonusCandidate.update({ where: { id: cur.id }, data: fields }); // reviewed ones are never touched
        refreshed++;
      }
    }
  }

  // A pending candidate that no longer qualifies (e.g. regrouped under another post) would
  // otherwise linger as a phantom duplicate. Reviewed ones stay as the audit record.
  const stale = existing.filter((c) => c.status === "pending" && !detectedPrimaries.has(c.primaryPostId)).map((c) => c.id);
  if (stale.length) await prisma.artieBonusCandidate.deleteMany({ where: { id: { in: stale } } });
  return { created, refreshed, removed: stale.length };
}

/** Full refresh: roster → videos → cross-post matches → candidates for both open cycles. */
export async function runArtieSync() {
  const roster = await syncRoster();
  // A roster error shouldn't stop videos refreshing for creators we already know.
  const videos = await syncVideos();
  const current = cycleFor(new Date());
  const previous = shiftCycle(current, -1);
  const matches = await recomputeMatches(previous.start, current.end);
  const candidates = {
    [previous.key]: await recomputeCandidates(previous),
    [current.key]: await recomputeCandidates(current),
  };
  return { roster, videos, matches, candidates };
}

export { inCycle };
