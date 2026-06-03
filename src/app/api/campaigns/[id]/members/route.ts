import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/campaigns/[id]/members
// Body: { ownerId: string | null, supporterIds: string[] }
// Replaces the entire member list for this campaign
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session?.user || user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { ownerId, supporterIds = [] } = await req.json();

  // Delete all existing members for this campaign
  await prisma.campaignMember.deleteMany({ where: { campaignId: params.id } });

  // Re-create
  const toCreate: { campaignId: string; userId: string; role: string }[] = [];

  if (ownerId) {
    toCreate.push({ campaignId: params.id, userId: ownerId, role: "owner" });
  }

  for (const sid of supporterIds) {
    if (sid !== ownerId) {
      toCreate.push({ campaignId: params.id, userId: sid, role: "supporter" });
    }
  }

  if (toCreate.length > 0) {
    await prisma.campaignMember.createMany({ data: toCreate });
  }

  const members = await prisma.campaignMember.findMany({
    where: { campaignId: params.id },
    include: { user: { select: { id: true, name: true, color: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}
