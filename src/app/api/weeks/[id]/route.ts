import { NextRequest, NextResponse } from "next/server";
import { addDays, setHours, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      campaign: true,
      hooks: {
        orderBy: [{ isSelected: "desc" }, { selectedOrder: "asc" }, { createdAt: "asc" }],
        include: {
          votes: true,
          _count: { select: { comments: true } },
        },
      },
      selectedValidated: {
        include: { validatedHook: true },
        orderBy: { selectedOrder: "asc" },
      },
    },
  });

  if (!week) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hooks = week.hooks.map(({ _count, ...hook }) => ({
    ...hook,
    commentCount: _count.comments,
  }));

  return NextResponse.json({ ...week, hooks });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const week = await prisma.week.update({
    where: { id: params.id },
    data: body,
    include: { campaign: true, hooks: true, selectedValidated: true },
  });

  if (body.status === "finalized") {
    // Mark each selected validated hook as used
    const validatedIds = week.selectedValidated.map((v) => v.validatedHookId);
    if (validatedIds.length > 0) {
      await prisma.validatedHook.updateMany({
        where: { id: { in: validatedIds } },
        data: { lastUsedAt: new Date(), timesUsed: { increment: 1 } },
      });
    }

    // Auto-create next week if it doesn't exist yet
    const nextWeekStart = startOfDay(addDays(new Date(week.weekStart), 7));
    const alreadyExists = await prisma.week.findFirst({
      where: { campaignId: week.campaignId, weekStart: nextWeekStart },
    });
    if (!alreadyExists) {
      await prisma.week.create({
        data: {
          campaignId: week.campaignId,
          weekStart: nextWeekStart,
          deadline: setHours(addDays(nextWeekStart, 7), 18),
          status: "open",
        },
      });
    }
  }

  return NextResponse.json(week);
}
