import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clients = await prisma.calendarClient.findMany({
    orderBy: { contractStart: "asc" },
    include: { extensions: { orderBy: { startDate: "asc" } } },
  });
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, contractStart, contractEnd, firstPostDate, monthlyValue, notes, contractLink, color } = body;

  if (!name || !contractStart) {
    return NextResponse.json({ error: "Name and contract start date are required" }, { status: 400 });
  }

  const client = await prisma.calendarClient.create({
    data: {
      name,
      contractStart: new Date(contractStart),
      contractEnd: contractEnd ? new Date(contractEnd) : null,
      firstPostDate: firstPostDate ? new Date(firstPostDate) : null,
      monthlyValue: monthlyValue ? parseFloat(monthlyValue) : null,
      notes: notes || null,
      contractLink: contractLink || null,
      color: color || "violet",
      source: "manual",
    },
  });

  return NextResponse.json(client, { status: 201 });
}
