import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const creator = await prisma.creatorApplication.findUnique({ where: { id: params.id } });
  if (!creator) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(creator);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const creator = await prisma.creatorApplication.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(creator);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.creatorApplication.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
