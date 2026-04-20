import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();

  const hook = await prisma.hook.update({
    where: { id: params.id },
    data: {
      ...body,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json(hook);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.hook.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
