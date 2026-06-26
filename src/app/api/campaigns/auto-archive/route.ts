import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const now = new Date();

  const expired = await prisma.campaign.findMany({
    where: {
      active: true,
      contractEndDate: { lt: now },
    },
    select: { id: true, name: true },
  });

  if (expired.length > 0) {
    await prisma.campaign.updateMany({
      where: { id: { in: expired.map(c => c.id) } },
      data: { active: false },
    });
  }

  return NextResponse.json({ archived: expired });
}
