import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SAFE_FIELDS = {
  id: true, platform: true, externalId: true, name: true, handles: true, autoReply: true, dryRun: true,
  maxPerVideoDay: true, maxPerDay: true, connectedBy: true, lastError: true, createdAt: true,
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [accounts, log] = await Promise.all([
    prisma.connectedAccount.findMany({ select: SAFE_FIELDS, orderBy: [{ platform: "asc" }, { name: "asc" }] }),
    prisma.videoComment.findMany({
      where: { botReplyText: { not: null } },
      include: { video: { select: { platform: true, creatorHandle: true, url: true, project: { select: { name: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);
  const postedToday = await prisma.videoComment.count({ where: { botRepliedAt: { gte: since } } });
  return NextResponse.json({ accounts, log, postedToday, configured: {
    facebook: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
    youtube: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  } });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, autoReply, dryRun, maxPerVideoDay, maxPerDay } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const account = await prisma.connectedAccount.update({
    where: { id },
    data: {
      ...(typeof autoReply === "boolean" && { autoReply }),
      ...(typeof dryRun === "boolean" && { dryRun }),
      ...(Number.isInteger(maxPerVideoDay) && maxPerVideoDay >= 0 && { maxPerVideoDay }),
      ...(Number.isInteger(maxPerDay) && maxPerDay >= 0 && { maxPerDay }),
    },
    select: SAFE_FIELDS,
  });
  return NextResponse.json(account);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await prisma.connectedAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
