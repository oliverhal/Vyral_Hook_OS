import { NextRequest, NextResponse } from "next/server";
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

  // When a week is finalized, mark each selected validated hook as used
  if (body.status === "finalized") {
    const validatedIds = week.selectedValidated.map((v) => v.validatedHookId);
    if (validatedIds.length > 0) {
      await prisma.validatedHook.updateMany({
        where: { id: { in: validatedIds } },
        data: { lastUsedAt: new Date(), timesUsed: { increment: 1 } },
      });
    }
  }

  return NextResponse.json(week);
}
