import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { startDate, endDate, monthlyValue, notes } = body;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  const extension = await prisma.calendarClientExtension.create({
    data: {
      clientId: params.id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      monthlyValue: monthlyValue ? parseFloat(monthlyValue) : null,
      notes: notes || null,
    },
  });

  return NextResponse.json(extension, { status: 201 });
}
