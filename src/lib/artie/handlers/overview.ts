import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtieReviewer } from "@/lib/artieServer";
import { cycleByKey, cycleFor, shiftCycle, removalGraceEnd } from "@/lib/artie/cycle";
import { countVideos, needsLinkCheck } from "@/lib/artie/bonus";
import { paceFor } from "@/lib/artie/pace";
import { getSettings } from "@/lib/artie/sync";
import { parseJson, firstPostDates } from "@/lib/artie/views";
import { PROGRAMMES, type Programme } from "@/lib/artie/programme";


/** Everything the dashboard shows for one programme + cycle, as a plain object (Dates not yet serialised). */
export async function computeOverview(programme: Programme, cycleKey: string, now = new Date()) {
  const cycle = cycleByKey(cycleKey) ?? cycleFor(now);
  const settings = await getSettings(programme);

  const creators = await prisma.artieCreator.findMany({ where: { programme, active: true }, orderBy: { name: "asc" } });
  const ids = creators.map((c) => c.id);
  const [posts, candidates, everByPlatform, firsts] = await Promise.all([
    prisma.artiePost.findMany({ where: { creatorId: { in: ids }, publishedAt: { gte: cycle.start, lt: cycle.end } } }),
    settings.bonusEnabled ? prisma.artieBonusCandidate.findMany({ where: { programme, cycleKey: cycle.key } }) : Promise.resolve([]),
    prisma.artiePost.groupBy({ by: ["creatorId", "platform"], where: { creatorId: { in: ids } }, _count: { _all: true } }),
    firstPostDates(prisma, ids),
  ]);

  const ever = new Set(everByPlatform.map((r) => `${r.creatorId}:${r.platform}`));

  const rows = creators.map((c) => {
    const mine = posts.filter((p) => p.creatorId === c.id);
    const counts = countVideos(mine.map((p) => ({ id: p.id, platform: p.platform, views: p.views, igMatchId: p.igMatchId, countDecision: p.countDecision })), settings.countMode === "instagram" ? "instagram" : "unique");
    const cs = candidates.filter((x) => x.creatorId === c.id);
    const live = cs.filter((x) => x.status !== "rejected");
    const indicative = live.reduce((s, x) => s + (x.status === "pending" ? x.initialAmount : x.approvedAmount ?? x.initialAmount), 0);
    // Potential earnings = unique videos × their per-video rate (from the payroll sheet) + bonuses.
    // No rate on the sheet → we don't guess a figure.
    const estBase = c.ratePerVideo != null ? Math.round(counts.counted * c.ratePerVideo * 100) / 100 : null;
    return {
      id: c.id, name: c.name, avatarUrl: c.avatarUrl, ratePerVideo: c.ratePerVideo, rateSource: c.rateSource,
      estBase, estTotal: estBase != null ? estBase + indicative : indicative > 0 ? indicative : null,
      // Removed from the sheet (fired/deleted) but kept until the pay cycle closes + a couple of days.
      startDate: firsts.get(c.id)?.toISOString() ?? null, // first post (not the sheet's onboarding date)
      pace: paceFor({ counted: counts.counted, cycle, firstPostAt: firsts.get(c.id) ?? null, now, perDay: settings.videosPerDay }),
      leavingAfter: c.removedAt ? removalGraceEnd(c.removedAt).toISOString() : null,
      handles: { instagram: c.instagram, tiktok: c.tiktok, facebook: c.facebook },
      counted: counts.counted, perPlatform: counts.perPlatform, discrepancy: counts.discrepancy,
      needsReview: counts.needsReview.length,
      bonus: {
        pending: cs.filter((x) => x.status === "pending").length,
        pendingChecks: cs.filter((x) => x.status === "pending" && needsLinkCheck(parseJson<string[]>(x.flags, []))).length,
        approved: cs.filter((x) => x.status === "approved" || x.status === "corrected").length,
        rejected: cs.filter((x) => x.status === "rejected").length,
        indicativeAmount: indicative,
      },
      // A handle on the sheet with no video ever seen usually means the account isn't tracked in ViralDeck yet.
      trackingGaps: (["instagram", "tiktok", "facebook"] as const).filter((pl) => c[pl] && !ever.has(`${c.id}:${pl}`)),
    };
  });

  // Bonuses given away this cycle (approved or corrected) vs. still waiting.
  const pending = candidates.filter((c) => c.status === "pending");
  const given = candidates.filter((c) => c.status === "approved" || c.status === "corrected");
  const bonusSummary = {
    givenCount: given.length,
    givenAmount: given.reduce((s, c) => s + (c.approvedAmount ?? c.initialAmount), 0),
    pendingCount: pending.length,
    pendingAmount: pending.reduce((s, c) => s + c.initialAmount, 0),
    pendingLinkChecks: pending.filter((c) => needsLinkCheck(parseJson<string[]>(c.flags, []))).length,
    pendingPlainAmount: pending.filter((c) => !needsLinkCheck(parseJson<string[]>(c.flags, []))).reduce((s, c) => s + c.initialAmount, 0),
    rejectedCount: candidates.filter((c) => c.status === "rejected").length,
  };

  // The goal is built on the headcount the client asked for, not on the roster (which is deliberately bigger).
  const targetCreators = settings.targetCreators ?? PROGRAMMES[programme].defaults.targetCreators;

  return {
    programme: { id: programme, label: PROGRAMMES[programme].label },
    bonusEnabled: settings.bonusEnabled,
    targetCreators,
    monthlyCostPerCreator: settings.monthlyCostPerCreator ?? PROGRAMMES[programme].defaults.monthlyCostPerCreator,
    bonusSummary,
    cycle: { key: cycle.key, start: cycle.start, end: cycle.end, startLabel: cycle.startLabel, endLabel: cycle.endLabel,
      prevKey: shiftCycle(cycle, -1).key, nextKey: shiftCycle(cycle, 1).key, isCurrent: cycle.key === cycleFor(now).key },
    creators: rows,
    settings: {
      payrollSheetUrl: settings.payrollSheetUrl, payrollClient: settings.payrollClient, countMode: settings.countMode, videosPerDay: settings.videosPerDay, showPaceToCreators: settings.showPaceToCreators, showRankToCreators: settings.showRankToCreators, bonusEnabled: settings.bonusEnabled, bonusThreshold: settings.bonusThreshold, bonusAmount: settings.bonusAmount,
      currency: settings.currency, lastRosterSyncAt: settings.lastRosterSyncAt, lastVideoSyncAt: settings.lastVideoSyncAt,
      lastSyncError: settings.lastSyncError,
      unmappedRows: parseJson(settings.unmappedRows, []), unmatchedAccounts: parseJson(settings.unmatchedAccounts, []),
    },
  };
}

export async function handleOverview(programme: Programme, req: NextRequest) {
  const auth = await requireArtieReviewer();
  if (auth.error) return auth.error;
  return NextResponse.json(await computeOverview(programme, req.nextUrl.searchParams.get("cycle") ?? ""));
}
