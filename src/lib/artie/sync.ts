import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import * as viraldeck from "@/lib/viraldeck";
import { normalizeHandle } from "@/lib/connectedAccounts";
import { cycleFor, shiftCycle, inCycle, removalGraceEnd, type Cycle } from "./cycle";
import { fetchRoster } from "./payrollSheet";
import { matchCrossPosts } from "./match";
import { detectCandidates, type CountPost } from "./bonus";
import { PROGRAMMES, type Programme } from "./programme";

export function newAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

/** This programme's settings row, created with its defaults on first use. */
export async function getSettings(programme: Programme = "artie") {
  const cfg = PROGRAMMES[programme];
  return prisma.artieSettings.upsert({
    where: { id: cfg.settingsId },
    create: { id: cfg.settingsId, payrollClient: cfg.payrollClientDefault, ...cfg.defaults },
    update: {},
  });
}

// ── Roster ───────────────────────────────────────────────────────────────────

export async function syncRoster(programme: Programme = "artie"): Promise<{ created: number; updated: number; deactivated: number; unmapped: number; error?: string }> {
  const settings = await getSettings(programme);
  const settingsId = PROGRAMMES[programme].settingsId;
  const fail = async (error: string) => {
    await prisma.artieSettings.update({ where: { id: settingsId }, data: { lastSyncError: error } });
    return { created: 0, updated: 0, deactivated: 0, unmapped: 0, error };
  };
  if (!settings.payrollSheetUrl) return fail("No payroll sheet link set yet.");

  const roster = await fetchRoster(settings.payrollSheetUrl, { client: settings.payrollClient });
  if (roster.error) return fail(roster.error);
  // Safety: an empty result almost certainly means a bad/blank sheet — never deactivate everyone over that.
  if (roster.creators.length === 0) return fail("The payroll sheet had no creators in it, so nothing was changed.");

  const existing = await prisma.artieCreator.findMany({ where: { programme } });
  const byKey = new Map(existing.map((c) => [c.sheetKey, c]));
  let created = 0, updated = 0;

  for (const r of roster.creators) {
    const cur = byKey.get(r.sheetKey);
    const data = { name: r.name, ratePerVideo: r.ratePerVideo, rateSource: r.rateSource, startDate: r.startDate, instagram: r.instagram, tiktok: r.tiktok, facebook: r.facebook, active: true, removedAt: null };
    if (cur) {
      const changed = cur.name !== r.name || cur.ratePerVideo !== r.ratePerVideo || cur.rateSource !== r.rateSource || (cur.startDate?.getTime() ?? null) !== (r.startDate?.getTime() ?? null) || cur.instagram !== r.instagram ||
        cur.tiktok !== r.tiktok || cur.facebook !== r.facebook || !cur.active || cur.removedAt !== null;
      if (changed) { await prisma.artieCreator.update({ where: { id: cur.id }, data }); updated++; }
    } else {
      await prisma.artieCreator.create({ data: { programme, sheetKey: r.sheetKey, ...data, accessToken: newAccessToken() } });
      created++;
    }
  }

  // Fired or deleted on the sheet: don't drop them mid-cycle. Mark when we first noticed, keep them
  // (and their private link) until the pay cycle closes plus a couple of days, then deactivate.
  const keep = new Set(roster.creators.map((r) => r.sheetKey));
  const now = new Date();
  let deactivated = 0;
  for (const c of existing) {
    if (!c.active || keep.has(c.sheetKey)) continue;
    if (!c.removedAt) {
      await prisma.artieCreator.update({ where: { id: c.id }, data: { removedAt: now } });
    } else if (now.getTime() >= removalGraceEnd(c.removedAt).getTime()) {
      await prisma.artieCreator.update({ where: { id: c.id }, data: { active: false } });
      deactivated++;
    }
  }

  await prisma.artieSettings.update({
    where: { id: settingsId },
    data: { lastRosterSyncAt: new Date(), lastSyncError: null, unmappedRows: JSON.stringify(roster.unmapped) },
  });
  return { created, updated, deactivated, unmapped: roster.unmapped.length };
}

// ── Videos ───────────────────────────────────────────────────────────────────

type Creator = Awaited<ReturnType<typeof prisma.artieCreator.findMany>>[number];

/** Facebook page names differ in spacing/hyphens between the sheet and ViralDeck ("Dustin-Keys" vs "Dustin Keys"). */
const looseKey = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function buildAccountLookup(creators: Creator[]) {
  const map = new Map<string, string>(); // `${platform}:${handle}` -> creatorId
  for (const c of creators) {
    if (c.instagram) map.set(`instagram:${normalizeHandle(c.instagram)}`, c.id);
    if (c.tiktok) map.set(`tiktok:${normalizeHandle(c.tiktok)}`, c.id);
    if (c.facebook) map.set(`facebook:${looseKey(c.facebook)}`, c.id);
  }
  return (a: viraldeck.ViraldeckAccount): string | null => {
    if (a.platform === "facebook") {
      // ViralDeck's Facebook handle is a numeric page id; the sheet may hold the id or the page name.
      for (const k of [a.handle, a.displayName]) {
        const hit = k ? map.get(`facebook:${looseKey(k)}`) : undefined;
        if (hit) return hit;
      }
      return null;
    }
    return map.get(`${a.platform}:${normalizeHandle(a.handle)}`) ?? null;
  };
}

function parseJsonSafe(s: string | null): Record<string, number> {
  try { return s ? (JSON.parse(s) as Record<string, number>) : {}; } catch { return {}; }
}

// The whole run (fetch + DB writes + matching + bonus detection) must fit in the 300s function limit.
// The first full run overran it and died before bonus detection, so the fetch gets half the time;
// anything not reached is refreshed first on the next run (stalest-first).
const TIME_BUDGET_MS = 150_000;
// ViralDeck rate-limits bursts per key, so keep this low.
const FETCH_CONCURRENCY = 2;

export async function syncVideos(programme: Programme = "artie"): Promise<{ matched: number; created: number; updated: number; unmatchedAccounts: number; skippedAccounts: number }> {
  const creators = await prisma.artieCreator.findMany({ where: { programme, active: true } });
  const none = { matched: 0, created: 0, updated: 0, unmatchedAccounts: 0, skippedAccounts: 0 };
  if (creators.length === 0) return none; // nothing to match against yet

  const key = viraldeck.programmeApiKey(programme);
  const projectId = await viraldeck.programmeProjectId(programme, key);
  const now = new Date();
  const current = cycleFor(now);
  const previous = shiftCycle(current, -1);

  const accounts = (await viraldeck.listAccounts(projectId, key)).filter((a) => ["instagram", "tiktok", "facebook"].includes(a.platform));
  const creatorFor = buildAccountLookup(creators);
  const mine = accounts.map((a) => ({ a, creatorId: creatorFor(a) }));
  // NB: ViralDeck's /creators reports videoCount 0 for every account, so it can't be used to
  // skip empty ones — fetch every roster-matched account.
  const tracked = mine.filter((m) => m.creatorId);
  const unmatchedAccounts = mine.filter((m) => !m.creatorId);

  // Profile pictures: IG first, then TikTok, then Facebook. Done before the slow video fetch so
  // they land even if the run is cut short.
  const pref = ["instagram", "tiktok", "facebook"];
  const avatarFor = new Map<string, { rank: number; url: string }>();
  for (const m of mine) {
    if (!m.creatorId || !m.a.profileImageUrl) continue;
    const rank = pref.indexOf(m.a.platform);
    const cur = avatarFor.get(m.creatorId);
    if (!cur || rank < cur.rank) avatarFor.set(m.creatorId, { rank, url: m.a.profileImageUrl });
  }
  const avatarUpdates = creators.filter((c) => avatarFor.has(c.id) && c.avatarUrl !== avatarFor.get(c.id)!.url)
    .map((c) => prisma.artieCreator.update({ where: { id: c.id }, data: { avatarUrl: avatarFor.get(c.id)!.url } }));
  for (let i = 0; i < avatarUpdates.length; i += 50) await prisma.$transaction(avatarUpdates.slice(i, i + 50));

  // Stalest first: if the time budget cuts a run short, the accounts it skipped lead the next one.
  const settings = await getSettings(programme);
  const refreshed: Record<string, number> = parseJsonSafe(settings.accountRefreshedAt);
  tracked.sort((x, y) => (refreshed[x.a.id] ?? 0) - (refreshed[y.a.id] ?? 0));

  const deadline = Date.now() + TIME_BUDGET_MS;
  const fetched = await viraldeck.mapPool(tracked, FETCH_CONCURRENCY, async (m) => {
    if (Date.now() > deadline) return null;
    const videos = await viraldeck.fetchAccountVideos(projectId, m.a.id, previous.start, current.end, key);
    refreshed[m.a.id] = Date.now();
    return { ...m, videos };
  });
  const skippedAccounts = fetched.filter((f) => f === null).length;

  const existing = await prisma.artiePost.findMany({ where: { creatorId: { in: creators.map((c) => c.id) }, publishedAt: { gte: previous.start, lt: current.end } } });
  const byKey = new Map(existing.map((p) => [`${p.platform}:${p.platformVideoId}`, p]));
  const toCreate: Prisma.ArtiePostCreateManyInput[] = [];
  const updates: ReturnType<typeof prisma.artiePost.update>[] = [];
  let matched = 0;

  for (const f of fetched) {
    if (!f) continue;
    for (const v of f.videos) {
      matched++;
      const row = {
        creatorId: f.creatorId as string, platform: f.a.platform, platformVideoId: v.id, username: f.a.handle, url: v.url,
        caption: v.title, publishedAt: new Date(v.publishedAt as string), views: v.views,
      };
      const cur = byKey.get(`${row.platform}:${row.platformVideoId}`);
      if (!cur) toCreate.push(row);
      else if (cur.creatorId !== row.creatorId || cur.views !== row.views || cur.caption !== row.caption) {
        updates.push(prisma.artiePost.update({ where: { id: cur.id }, data: { ...row, lastSeenAt: now } }));
      }
    }
  }

  if (toCreate.length) await prisma.artiePost.createMany({ data: toCreate, skipDuplicates: true });
  for (let i = 0; i < updates.length; i += 100) await prisma.$transaction(updates.slice(i, i + 100));

  const staleOver48h = tracked.filter((m) => now.getTime() - (refreshed[m.a.id] ?? 0) > 48 * 3600 * 1000).length;
  const top = unmatchedAccounts.sort((x, y) => x.a.handle.localeCompare(y.a.handle)).slice(0, 80)
    .map((m) => ({ platform: m.a.platform, username: m.a.handle }));
  await prisma.artieSettings.update({
    where: { id: PROGRAMMES[programme].settingsId },
    data: {
      lastVideoSyncAt: now, unmatchedAccounts: JSON.stringify(top), accountRefreshedAt: JSON.stringify(refreshed),
      // Only ever *set* an error here — clearing is the roster sync's job, so a roster
      // problem isn't hidden by a successful video pull. A full pass takes ~4-5 minutes, so a
      // run that stops early is normal (the next one starts with the stalest accounts); only
      // alarm if some account has gone a whole day without refreshing.
      ...(staleOver48h ? { lastSyncError: `${staleOver48h} account(s) haven't refreshed in over 48 hours — view counts for those creators may be out of date.` } : {}),
    },
  });
  return { matched, created: toCreate.length, updated: updates.length, unmatchedAccounts: unmatchedAccounts.length, skippedAccounts };
}

// ── Cross-post matching + bonus candidates ───────────────────────────────────

export async function recomputeMatches(programme: Programme, from: Date, to: Date): Promise<number> {
  const ids = (await prisma.artieCreator.findMany({ where: { programme }, select: { id: true } })).map((c) => c.id);
  const posts = await prisma.artiePost.findMany({ where: { creatorId: { in: ids }, publishedAt: { gte: from, lt: to } } });
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

export async function recomputeCandidates(programme: Programme, cycle: Cycle): Promise<{ created: number; refreshed: number; removed: number }> {
  const settings = await getSettings(programme);
  // Programmes without bonuses (Ecosia) never get candidates — and any stray pending ones are cleared.
  if (!settings.bonusEnabled) {
    const gone = await prisma.artieBonusCandidate.deleteMany({ where: { programme, cycleKey: cycle.key, status: "pending" } });
    return { created: 0, refreshed: 0, removed: gone.count };
  }
  const creators = await prisma.artieCreator.findMany({ where: { programme, active: true } });
  const posts = await prisma.artiePost.findMany({ where: { creatorId: { in: creators.map((c) => c.id) }, publishedAt: { gte: cycle.start, lt: cycle.end } } });
  const existing = await prisma.artieBonusCandidate.findMany({ where: { programme, cycleKey: cycle.key } });
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
          data: { creatorId: creator.id, programme, cycleKey: cycle.key, primaryPostId: c.primaryPostId, initialAmount: settings.bonusAmount, ...fields },
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
export async function runArtieSync(programme: Programme = "artie") {
  const roster = await syncRoster(programme);
  // A roster error shouldn't stop videos refreshing for creators we already know.
  const videos = await syncVideos(programme);
  const derived = await deriveAll(programme);
  return { roster, videos, ...derived };
}

/** Cross-post matching + bonus candidates for the two open cycles. Cheap, so it can run on its own. */
export async function deriveAll(programme: Programme = "artie") {
  const current = cycleFor(new Date());
  const previous = shiftCycle(current, -1);
  const matches = await recomputeMatches(programme, previous.start, current.end);
  const candidates = {
    [previous.key]: await recomputeCandidates(programme, previous),
    [current.key]: await recomputeCandidates(programme, current),
  };
  return { matches, candidates };
}

export { inCycle };
