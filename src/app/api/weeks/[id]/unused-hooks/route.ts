import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns unselected hooks from previous weeks in the same campaign
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentWeek = await prisma.week.findUnique({
    where: { id: params.id },
    select: { campaignId: true, weekStart: true },
  });

  if (!currentWeek) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hooks = await prisma.hook.findMany({
    where: {
      isSelected: false,
      week: {
        campaignId: currentWeek.campaignId,
        weekStart: { lt: currentWeek.weekStart },
      },
    },
    include: {
      week: { select: { id: true, weekStart: true } },
      votes: { select: { value: true } },
    },
    orderBy: [{ week: { weekStart: "desc" } }, { createdAt: "asc" }],
  });

  const withScores = hooks.map(({ votes, ...h }) => ({
    ...h,
    upvotes: votes.filter((v) => v.value > 0).length,
    downvotes: votes.filter((v) => v.value < 0).length,
    netScore: votes.reduce((sum, v) => sum + v.value, 0),
  }));

  return NextResponse.json(withScores);
}

// Copy selected previous hooks into this week
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as { id?: string; name?: string };
  const { hookIds } = await req.json();

  if (!Array.isArray(hookIds) || hookIds.length === 0) {
    return NextResponse.json({ error: "hookIds required" }, { status: 400 });
  }

  const sourcHooks = await prisma.hook.findMany({
    where: { id: { in: hookIds } },
  });

  const created = await prisma.$transaction(
    sourcHooks.map((h) =>
      prisma.hook.create({
        data: {
          weekId: params.id,
          submittedById: h.submittedById,
          submitterName: h.submitterName,
          hookText: h.hookText,
          format: h.format,
          caption: h.caption,
          referenceVideo: h.referenceVideo,
          recordingNotes: h.recordingNotes,
          requiresAppFootage: h.requiresAppFootage,
          appFootageSource: h.appFootageSource,
          status: "submitted",
        },
      })
    )
  );

  return NextResponse.json({ count: created.length });
}
