import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtieReviewer } from "@/lib/artieServer";
import { cycleByKey, cycleFor, shiftCycle } from "@/lib/artie/cycle";
import { countVideos } from "@/lib/artie/bonus";
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
    const counts = countVideos(mine.map((p) => ({ id: p.id, platform: p.platform, views: p.views, igMatchId: p.igMatchId, countDecision: p.countDecision })));
    const cs = candidates.filter((x) => x.creatorId === c.id);
    const live = cs.filter((x) => x.status !== "rejected");
    return {
      id: c.id, name: c.name, ratePerVideo: c.ratePerVideo,
      handles: { instagram: c.instagram, tiktok: c.tiktok, facebook: c.facebook },
      counted: counts.counted, perPlatform: counts.perPlatform, discrepancy: counts.discrepancy,
      needsReview: counts.needsReview.length,
      bonus: {
        pending: cs.filter((x) => x.status === "pending").length,
        approved: cs.filter((x) => x.status === "approved" || x.status === "corrected").length,
        rejected: cs.filter((x) => x.status === "rejected").length,
        indicativeAmount: live.reduce((s, x) => s + (x.status === "pending" ? x.initialAmount : x.approvedAmount ?? x.initialAmount), 0),
      },
      // A handle on the sheet with no video ever seen usually means the account isn't tracked in ViralDeck yet.
      trackingGaps: (["instagram", "tiktok", "facebook"] as const).filter((pl) => c[pl] && !ever.has(`${c.id}:${pl}`)),
    };
  });

  return NextResponse.json({
    cycle: { key: cycle.key, start: cycle.start, end: cycle.end, startLabel: cycle.startLabel, endLabel: cycle.endLabel,
      prevKey: shiftCycle(cycle, -1).key, nextKey: shiftCycle(cycle, 1).key, isCurrent: cycle.key === cycleFor(now).key },
    creators: rows,
    settings: {
      payrollSheetUrl: settings.payrollSheetUrl, bonusThreshold: settings.bonusThreshold, bonusAmount: settings.bonusAmount,
      currency: settings.currency, lastRosterSyncAt: settings.lastRosterSyncAt, lastVideoSyncAt: settings.lastVideoSyncAt,
      lastSyncError: settings.lastSyncError,
      unmappedRows: parseJson(settings.unmappedRows, []), unmatchedAccounts: parseJson(settings.unmatchedAccounts, []),
    },
  });
}
