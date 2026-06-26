import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function autoArchiveExpired() {
  const now = new Date();

  // 1. Campaigns with explicit contractEndDate
  const directExpired = await prisma.campaign.findMany({
    where: { active: true, contractEndDate: { lte: now } },
    select: { id: true, clientName: true },
  });

  // 2. Match via CalendarClient.contractEnd by name
  const endedClients = await prisma.calendarClient.findMany({
    where: { contractEnd: { lte: now } },
    select: { name: true },
  });
  const endedNames = endedClients.map(c => c.name.toLowerCase().trim());

  const calendarExpired = endedNames.length > 0
    ? (await prisma.campaign.findMany({
        where: { active: true, contractEndDate: null },
        select: { id: true, clientName: true },
      })).filter(c => {
        const n = c.clientName.toLowerCase().trim();
        return endedNames.some(en => en === n || en.startsWith(n) || n.startsWith(en));
      })
    : [];

  const ids = Array.from(new Set([...directExpired, ...calendarExpired].map(c => c.id)));
  if (ids.length > 0) {
    await prisma.campaign.updateMany({ where: { id: { in: ids } }, data: { active: false } });
  }
}

export async function GET() {
  await autoArchiveExpired();

  const campaigns = await prisma.campaign.findMany({
    where: { active: true },
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
  return NextResponse.json(campaigns);
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

  // Auto-create the first week if a start date was provided
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
