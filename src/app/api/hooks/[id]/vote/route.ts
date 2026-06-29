import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { value } = await req.json(); // 1, 0 (neutral), -1, or null (remove)

  if (value === null || value === undefined) {
    await prisma.hookVote.deleteMany({ where: { hookId: params.id, userId } });
    return NextResponse.json({ ok: true });
  }

  await prisma.hookVote.upsert({
    where: { hookId_userId: { hookId: params.id, userId } },
    create: { hookId: params.id, userId, value },
    update: { value },
  });

  return NextResponse.json({ ok: true });
}
