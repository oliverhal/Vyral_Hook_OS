import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const now = new Date();

  // 1. Campaigns with an explicit contractEndDate set
  const expiredDirect = await prisma.campaign.findMany({
    where: { active: true, contractEndDate: { lte: now } },
    select: { id: true, name: true, clientName: true },
  });

  // 2. Active campaigns whose client name matches a CalendarClient with contractEnd in the past
  const endedCalendarClients = await prisma.calendarClient.findMany({
    where: { contractEnd: { lte: now } },
    select: { name: true },
  });

  const endedNames = endedCalendarClients.map(c => c.name.toLowerCase().trim());

  const expiredViaCalendar = endedNames.length > 0
    ? await prisma.campaign.findMany({
        where: {
          active: true,
          contractEndDate: null, // don't double-count direct ones
        },
        select: { id: true, name: true, clientName: true },
      }).then(campaigns =>
        campaigns.filter(c => endedNames.includes(c.clientName.toLowerCase().trim()))
      )
    : [];

  const allExpired = [...expiredDirect, ...expiredViaCalendar];
  const allIds = Array.from(new Set(allExpired.map(c => c.id)));

  if (allIds.length > 0) {
    await prisma.campaign.updateMany({
      where: { id: { in: allIds } },
      data: { active: false },
    });
  }

  return NextResponse.json({ archived: allExpired });
}
