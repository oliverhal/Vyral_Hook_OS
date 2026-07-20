import { NextRequest, NextResponse } from "next/server";
import { addDays, startOfDay } from "date-fns";
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
          submittedBy: { select: { avatarUrl: true } },
          suggestions: {
            where: { status: "pending" },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      selectedValidated: {
        include: { validatedHook: true },
        orderBy: { selectedOrder: "asc" },
      },
    },
  });

  if (!week) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hooks = week.hooks.map(({ _count, submittedBy, ...hook }) => ({
    ...hook,
    commentCount: _count.comments,
    submitterAvatarUrl: submittedBy?.avatarUrl ?? null,
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

    // Auto-create next Tuesday
    const nextWeekStart = (() => {
      const d = addDays(new Date(week.weekStart), 7);
      const day = d.getUTCDay();
      const diff = day === 2 ? 0 : (2 - day + 7) % 7;
      d.setUTCDate(d.getUTCDate() + diff);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    })();
    const alreadyExists = await prisma.week.findFirst({
      where: { campaignId: week.campaignId, weekStart: nextWeekStart },
    });
    if (!alreadyExists) {
      await prisma.week.create({
        data: {
          campaignId: week.campaignId,
          weekStart: nextWeekStart,
          deadline: nextWeekStart, // midnight at start of week = end of the day before
          status: "open",
        },
      });
    }
  }

  return NextResponse.json(week);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.week.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
