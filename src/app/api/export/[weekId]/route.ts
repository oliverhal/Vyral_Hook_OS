import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCSV } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { weekId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const week = await prisma.week.findUnique({
    where: { id: params.weekId },
    include: {
      campaign: true,
      hooks: {
        where: { isSelected: true },
        orderBy: { selectedOrder: "asc" },
      },
    },
  });

  if (!week) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const csv = generateCSV(week.hooks, week.campaign.hashtags);
  const weekDate = new Date(week.weekStart).toISOString().split("T")[0];
  const filename = `${week.campaign.name.replace(/\s+/g, "_")}_hooks_${weekDate}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
