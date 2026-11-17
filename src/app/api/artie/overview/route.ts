import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtieReviewer } from "@/lib/artieServer";
import { cycleByKey, cycleFor, shiftCycle, removalGraceEnd } from "@/lib/artie/cycle";
import { countVideos, needsLinkCheck } from "@/lib/artie/bonus";
import { paceFor } from "@/lib/artie/pace";
import { getSettings } from "@/lib/artie/sync";
import { parseJson } from "@/lib/artie/views";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireArtieReviewer();
  if (auth.error) return auth.error;

  const now = new Date();
  const cycle = cycleByKey(req.nextUrl.searchParams.get("cycle") ?? "") ?? cycleFor(now);
  const settings = await getSettings();

  const [creators, posts, candidates, everByPlatform] = await Promise.all([
    prisma.artieCreator.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.artiePost.findMany({ where: { publishedAt: { gte: cycle.start, lt: cycle.end } } }),
    prisma.artieBonusCandidate.findMany({ where: { cycleKey: cycle.key } }),
    prisma.artiePost.groupBy({ by: ["creatorId", "platform"], _count: { _all: true } }),
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
      startDate: c.startDate ? c.startDate.toISOString() : null,
      pace: paceFor({ counted: counts.counted, cycle, startDate: c.startDate, now, perDay: settings.videosPerDay }),
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

  return NextResponse.json({
    bonusSummary,
    cycle: { key: cycle.key, start: cycle.start, end: cycle.end, startLabel: cycle.startLabel, endLabel: cycle.endLabel,
      prevKey: shiftCycle(cycle, -1).key, nextKey: shiftCycle(cycle, 1).key, isCurrent: cycle.key === cycleFor(now).key },
    creators: rows,
    settings: {
      payrollSheetUrl: settings.payrollSheetUrl, payrollClient: settings.payrollClient, countMode: settings.countMode, videosPerDay: settings.videosPerDay, showPaceToCreators: settings.showPaceToCreators, showRankToCreators: settings.showRankToCreators, bonusThreshold: settings.bonusThreshold, bonusAmount: settings.bonusAmount,
      currency: settings.currency, lastRosterSyncAt: settings.lastRosterSyncAt, lastVideoSyncAt: settings.lastVideoSyncAt,
      lastSyncError: settings.lastSyncError,
      unmappedRows: parseJson(settings.unmappedRows, []), unmatchedAccounts: parseJson(settings.unmatchedAccounts, []),
    },
  });
}
