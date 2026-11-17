import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtieReviewer } from "@/lib/artieServer";
import { cycleByKey, cycleFor, shiftCycle } from "@/lib/artie/cycle";
import { loadCreatorCycle, parseJson } from "@/lib/artie/views";
import { paceFor } from "@/lib/artie/pace";
import { firstPostDates } from "@/lib/artie/views";
import { newAccessToken } from "@/lib/artie/sync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireArtieReviewer();
  if (auth.error) return auth.error;

  const creator = await prisma.artieCreator.findUnique({ where: { id: params.id } });
  if (!creator) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const cycle = cycleByKey(req.nextUrl.searchParams.get("cycle") ?? "") ?? cycleFor(now);
  const settingsRow = await prisma.artieSettings.findUnique({ where: { id: "singleton" } });
  const { posts, counts } = await loadCreatorCycle(prisma, creator.id, cycle, settingsRow?.countMode === "instagram" ? "instagram" : "unique");
  const firstPostAt = (await firstPostDates(prisma, [creator.id])).get(creator.id) ?? null;
  const candidates = await prisma.artieBonusCandidate.findMany({
    where: { creatorId: creator.id, cycleKey: cycle.key },
    include: { events: { orderBy: { createdAt: "asc" } } },
    orderBy: { maxViews: "desc" },
  });
  const settings = await prisma.artieSettings.findUnique({ where: { id: "singleton" } });
  const byId = new Map(posts.map((p) => [p.id, p]));
  const needsReviewIds = new Set(counts.needsReview.map((p) => p.id));

  return NextResponse.json({
    creator: {
      id: creator.id, name: creator.name, avatarUrl: creator.avatarUrl, startDate: firstPostAt ? firstPostAt.toISOString() : null, ratePerVideo: creator.ratePerVideo, active: creator.active,
      instagram: creator.instagram, tiktok: creator.tiktok, facebook: creator.facebook,
      facebookLinked: creator.facebookLinked, accessToken: creator.accessToken,
    },
    cycle: { key: cycle.key, startLabel: cycle.startLabel, endLabel: cycle.endLabel,
      prevKey: shiftCycle(cycle, -1).key, nextKey: shiftCycle(cycle, 1).key, isCurrent: cycle.key === cycleFor(now).key },
    counts: { counted: counts.counted, perPlatform: counts.perPlatform, discrepancy: counts.discrepancy },
    currency: settings?.currency ?? "USD",
    pace: paceFor({ counted: counts.counted, cycle, firstPostAt, now, perDay: settingsRow?.videosPerDay ?? 2 }),
    perDay: settingsRow?.videosPerDay ?? 2,
    posts: posts.map((p) => ({
      id: p.id, platform: p.platform, url: p.url, username: p.username, caption: p.caption, publishedAt: p.publishedAt,
      views: p.views, igMatchId: p.igMatchId, matchSource: p.matchSource,
      matchedToUrl: p.igMatchId ? byId.get(p.igMatchId)?.url ?? null : null,
      countDecision: p.countDecision, decisionReason: p.decisionReason, decidedBy: p.decidedBy,
      needsReview: needsReviewIds.has(p.id),
    })),
    candidates: candidates.map((c) => ({
      id: c.id, status: c.status, maxViews: c.maxViews, initialAmount: c.initialAmount, approvedAmount: c.approvedAmount,
      reason: c.reason, reviewedBy: c.reviewedBy, reviewedAt: c.reviewedAt,
      flags: parseJson<string[]>(c.flags, []), qualifiesOn: parseJson<string[]>(c.qualifiesOn, []),
      primary: byId.get(c.primaryPostId) ? { id: c.primaryPostId, url: byId.get(c.primaryPostId)!.url, platform: byId.get(c.primaryPostId)!.platform, views: byId.get(c.primaryPostId)!.views } : null,
      related: parseJson<string[]>(c.relatedPostIds, []).map((id) => byId.get(id)).filter(Boolean).map((p) => ({ id: p!.id, url: p!.url, platform: p!.platform, views: p!.views })),
      events: c.events.map((e) => ({ id: e.id, action: e.action, actor: e.actor, createdAt: e.createdAt, before: parseJson(e.before, null), after: parseJson(e.after, null) })),
    })),
  });
}

// Update the facts a reviewer knows about a creator, or revoke/reissue their link.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireArtieReviewer();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const data: { facebookLinked?: boolean | null; accessToken?: string } = {};

  if ("facebookLinked" in body) {
    if (body.facebookLinked !== null && typeof body.facebookLinked !== "boolean") {
      return NextResponse.json({ error: "facebookLinked must be true, false or null" }, { status: 400 });
    }
    data.facebookLinked = body.facebookLinked;
  }
  if (body.regenerateToken === true) data.accessToken = newAccessToken();
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await prisma.artieCreator.update({ where: { id: params.id }, data }).catch(() => null);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, facebookLinked: updated.facebookLinked, accessToken: updated.accessToken });
}
