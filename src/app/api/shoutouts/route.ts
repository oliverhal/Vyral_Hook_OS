import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function startOfWeek() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shoutouts = await prisma.shoutout.findMany({
    where: { createdAt: { gte: startOfWeek() } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(shoutouts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toName, message, emoji } = await req.json();
  if (!toName?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "toName and message required" }, { status: 400 });
  }

  const shoutout = await prisma.shoutout.create({
    data: {
      toName: toName.trim(),
      message: message.trim(),
      emoji: emoji || "🌟",
    },
  });

  return NextResponse.json(shoutout);
}
