import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      weeks: {
        orderBy: { weekStart: "desc" },
        include: {
          hooks: {
            orderBy: [{ isSelected: "desc" }, { selectedOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
      members: {
        include: { user: { select: { id: true, name: true, color: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const campaign = await prisma.campaign.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(campaign);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.campaign.update({
    where: { id: params.id },
    data: { archivedManually: true },
  });
  return NextResponse.json({ ok: true });
}
