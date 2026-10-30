import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TRACKED_PLATFORMS } from "@/lib/commentsSync";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["open", "sent_to_creator", "replied", "dismissed"]);
const NUDGE_WINDOW_DAYS = 3;
const NUDGE_MIN_OPEN = 3;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "open";
  const projectId = sp.get("projectId") || undefined;
  const platform = sp.get("platform") || undefined;

  const comments = await prisma.videoComment.findMany({
    where: {
      needsReply: true,
      ...(status !== "all" && { status }),
      video: {
        project: { enabled: true, ...(projectId && { id: projectId }) },
        platform: platform && TRACKED_PLATFORMS.includes(platform) ? platform : { in: TRACKED_PLATFORMS },
      },
    },
    include: { video: { include: { project: { select: { id: true, name: true } } } } },
    // Comments nobody has answered yet first; replies may be from other users,
    // not the creator, so answered ones stay in the inbox for the VA to check.
    orderBy: [{ video: { views: "desc" } }, { replyCount: "asc" }, { likeCount: "desc" }],
    take: 300,
  });

  // Creator nudges: creators with several unanswered high-value comments on
  // their recent videos. YouTube/Facebook are left to the bot.
  const since = new Date(Date.now() - NUDGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = await prisma.videoComment.findMany({
    where: {
      needsReply: true,
      video: {
        platform: { in: ["tiktok", "instagram"].filter((p) => TRACKED_PLATFORMS.includes(p)) },
        publishedAt: { gte: since },
        project: { enabled: true, ...(projectId && { id: projectId }) },
      },
    },
    select: {
      replyCount: true,
      repliesChecked: true,
      creatorReplied: true,
      status: true,
      video: { select: { creatorHandle: true, platform: true, id: true, project: { select: { name: true } } } },
    },
  });

  const byCreator = new Map<
    string,
    { creatorHandle: string; platform: string; project: string; total: number; open: number; videos: Set<string> }
  >();
  for (const c of recent) {
    const key = `${c.video.platform}:${c.video.creatorHandle}`;
    const row = byCreator.get(key) ?? {
      creatorHandle: c.video.creatorHandle ?? "unknown",
      platform: c.video.platform,
      project: c.video.project.name,
      total: 0,
      open: 0,
      videos: new Set<string>(),
    };
    row.total++;
    row.videos.add(c.video.id);
    // Definitely unanswered by the creator: no replies at all, or we read the
    // replies (Apify) and none were theirs.
    const unanswered = !c.creatorReplied && (c.replyCount === 0 || c.repliesChecked);
    if (unanswered && c.status === "open") row.open++;
    byCreator.set(key, row);
  }
  const nudges = Array.from(byCreator.values())
    .filter((r) => r.open >= NUDGE_MIN_OPEN)
    .map((r) => ({ ...r, videos: r.videos.size, unansweredPct: Math.round((r.open / r.total) * 100) }))
    .sort((a, b) => b.open - a.open);

  return NextResponse.json({ comments, nudges, nudgeWindowDays: NUDGE_WINDOW_DAYS });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !STATUSES.has(status)) return NextResponse.json({ error: "id and a valid status are required" }, { status: 400 });

  const comment = await prisma.videoComment.update({
    where: { id },
    data: { status, statusUpdatedBy: session.user.name ?? session.user.email ?? null },
  });
  return NextResponse.json(comment);
}
