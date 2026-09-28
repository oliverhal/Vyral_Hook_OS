import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    where: { archivedManually: true },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, color: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { weeks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(campaigns);
}
