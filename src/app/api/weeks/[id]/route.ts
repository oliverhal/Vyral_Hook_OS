import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

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
    include: { campaign: true, hooks: true },
  });
  return NextResponse.json(week);
}
