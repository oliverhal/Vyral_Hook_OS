import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, setHours, startOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  const weeks = await prisma.week.findMany({
    where: campaignId ? { campaignId } : undefined,
    include: {
      campaign: true,
      hooks: {
        orderBy: [{ isSelected: "desc" }, { selectedOrder: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { weekStart: "desc" },
  });

  return NextResponse.json(weeks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { campaignId, weekStart } = body;

  if (!campaignId || !weekStart) {
    return NextResponse.json({ error: "campaignId and weekStart are required" }, { status: 400 });
  }

  const start = startOfDay(new Date(weekStart));
  const deadline = setHours(addDays(start, 7), 18);

  const week = await prisma.week.create({
    data: {
      campaignId,
      weekStart: start,
      deadline,
      status: "open",
    },
    include: { campaign: true, hooks: true },
  });

  return NextResponse.json(week, { status: 201 });
}
