import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtieReviewer } from "@/lib/artieServer";
import { cycleFor } from "@/lib/artie/cycle";
import { recomputeCandidates } from "@/lib/artie/sync";
import { programmeOf } from "@/lib/artie/programme";

// A reviewer's call on a single post: count/ignore a TikTok/Facebook post that
// has no Instagram counterpart, or fix a cross-post match the system got wrong.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireArtieReviewer();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));

  const post = await prisma.artiePost.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data: Record<string, unknown> = {};

  if ("countDecision" in body) {
    if (![null, "count", "ignore"].includes(body.countDecision)) return NextResponse.json({ error: "countDecision must be count, ignore or null" }, { status: 400 });
    if (post.platform === "instagram") return NextResponse.json({ error: "Instagram posts are counted automatically" }, { status: 400 });
    data.countDecision = body.countDecision;
    data.decisionReason = body.countDecision ? String(body.reason ?? "").slice(0, 500) || null : null;
    data.decidedBy = body.countDecision ? auth.name : null;
    data.decidedAt = body.countDecision ? new Date() : null;
  }

  if ("igMatchId" in body) {
    if (post.platform === "instagram") return NextResponse.json({ error: "Only TikTok/Facebook posts can be matched to an Instagram post" }, { status: 400 });
    if (body.igMatchId === null) {
      data.igMatchId = null;
      data.matchSource = "manual"; // an explicit "this is NOT a cross-post" must survive the next sync
    } else {
      const ig = await prisma.artiePost.findUnique({ where: { id: String(body.igMatchId) } });
      if (!ig || ig.platform !== "instagram" || ig.creatorId !== post.creatorId) {
        return NextResponse.json({ error: "Match must be one of this creator's Instagram posts" }, { status: 400 });
      }
      data.igMatchId = ig.id;
      data.matchSource = "manual";
    }
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const updated = await prisma.artiePost.update({ where: { id: post.id }, data });
  // Matching and counting changed → bonus candidates for that cycle may too.
  const owner = await prisma.artieCreator.findUnique({ where: { id: post.creatorId }, select: { programme: true } });
  await recomputeCandidates(programmeOf(owner?.programme), cycleFor(post.publishedAt));
  return NextResponse.json({ ok: true, post: { id: updated.id, igMatchId: updated.igMatchId, matchSource: updated.matchSource, countDecision: updated.countDecision } });
}
