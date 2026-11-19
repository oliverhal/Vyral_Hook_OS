import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; extId: string } }) {
  await prisma.calendarClientExtension.delete({
    where: { id: params.extId, clientId: params.id },
  });
  return new NextResponse(null, { status: 204 });
}
