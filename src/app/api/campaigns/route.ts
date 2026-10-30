import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    where: { archivedManually: false },
    include: {
      weeks: {
        orderBy: { weekStart: "desc" },
        take: 1,
        include: {
          hooks: { select: { id: true, isSelected: true, submittedBy: true } },
        },
      },
      members: {
        include: { user: { select: { id: true, name: true, color: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();

  const futureCampaignIds = campaigns
    .filter((c) => c.weeks.length > 0 && new Date(c.weeks[0].weekStart) > now)
    .map((c) => c.id);

  const firstWeeks = futureCampaignIds.length > 0
    ? await prisma.week.findMany({
        where: { campaignId: { in: futureCampaignIds } },
        orderBy: { weekStart: "asc" },
        distinct: ["campaignId"],
        select: { campaignId: true, weekStart: true },
      })
    : [];

  const firstWeekByCampaign = Object.fromEntries(firstWeeks.map((w) => [w.campaignId, w.weekStart]));

  const withStartDates = campaigns.map((c) => ({
    ...c,
    campaignStartDate: firstWeekByCampaign[c.id] ?? null,
  }));

  return NextResponse.json(withStartDates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, clientName, description, color, emoji, hooksTarget, validatedTarget, hashtags, firstWeekStart } = body;

  if (!name || !clientName) {
    return NextResponse.json({ error: "Name and client name are required" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      name,
      clientName,
      description: description || null,
      color: color || "violet",
      emoji: emoji || "🎯",
      hooksTarget: hooksTarget ?? 7,
      validatedTarget: validatedTarget ?? 7,
      hashtags: hashtags || null,
    },
  });

  if (firstWeekStart) {
    const weekStart = new Date(firstWeekStart);
    weekStart.setUTCHours(0, 0, 0, 0);
    await prisma.week.create({
      data: {
        campaignId: campaign.id,
        weekStart,
        deadline: weekStart,
        status: "open",
      },
    });
  }

  return NextResponse.json(campaign, { status: 201 });
}
