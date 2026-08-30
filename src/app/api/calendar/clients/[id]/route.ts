import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { name, contractStart, contractEnd, firstPostDate, monthlyValue, notes, contractLink, color, archived } = body;

  const client = await prisma.calendarClient.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(contractStart !== undefined && { contractStart: new Date(contractStart) }),
      ...(contractEnd !== undefined && { contractEnd: contractEnd ? new Date(contractEnd) : null }),
      ...(firstPostDate !== undefined && { firstPostDate: firstPostDate ? new Date(firstPostDate) : null }),
      ...(monthlyValue !== undefined && { monthlyValue: monthlyValue ? parseFloat(monthlyValue) : null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(contractLink !== undefined && { contractLink: contractLink || null }),
      ...(color !== undefined && { color }),
      ...(archived !== undefined && { archived }),
    },
  });

  return NextResponse.json(client);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.calendarClient.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
