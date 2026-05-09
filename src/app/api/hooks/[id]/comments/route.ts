import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const comments = await prisma.hookComment.findMany({
    where: { hookId: params.id },
    include: { user: { select: { id: true, name: true, color: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as { id: string; name?: string };
  const userId = sessionUser.id;
  const fromName = sessionUser.name ?? "Someone";
  const { content } = await req.json();

  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const comment = await prisma.hookComment.create({
    data: { hookId: params.id, userId, content: content.trim() },
    include: { user: { select: { id: true, name: true, color: true } } },
  });

  // Parse @mentions and create notifications
  const mentionMatches = [...content.matchAll(/@([\w]+(?:\s[\w]+)*)/g)];
  if (mentionMatches.length > 0) {
    const hook = await prisma.hook.findUnique({ where: { id: params.id }, select: { hookText: true } });
    const hookText = hook?.hookText ?? "";
    const activeUsers = await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true } });

    const notificationsToCreate: { userId: string; fromName: string; commentId: string; hookText: string }[] = [];
    const notifiedIds = new Set<string>();

    for (const match of mentionMatches) {
      const mentionedName = match[1].trim().toLowerCase();
      const mentioned = activeUsers.find(
        (u) => u.name.toLowerCase() === mentionedName || u.name.toLowerCase().startsWith(mentionedName)
      );
      if (mentioned && mentioned.id !== userId && !notifiedIds.has(mentioned.id)) {
        notificationsToCreate.push({ userId: mentioned.id, fromName, commentId: comment.id, hookText });
        notifiedIds.add(mentioned.id);
      }
    }

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({ data: notificationsToCreate });
    }
  }

  return NextResponse.json(comment);
}
