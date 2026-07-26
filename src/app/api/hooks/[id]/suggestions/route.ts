import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hookText } = await req.json();
  if (!hookText?.trim()) return NextResponse.json({ error: "hookText required" }, { status: 400 });

  const suggestedBy = (session.user as { name?: string }).name ?? "Someone";
  const currentUserId = (session.user as { id?: string }).id;

  const hook = await prisma.hook.findUnique({
    where: { id: params.id },
    select: { hookText: true, weekId: true, submittedById: true },
  });
  if (!hook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const suggestion = await prisma.hookSuggestion.create({
    data: { hookId: params.id, suggestedBy, hookText: hookText.trim() },
  });

  // Notify the hook submitter (skip if they suggested it themselves)
  if (hook.submittedById && hook.submittedById !== currentUserId) {
    await prisma.notification.create({
      data: {
        userId: hook.submittedById,
        fromName: suggestedBy,
        hookText: hook.hookText,
        weekId: hook.weekId,
        type: "suggestion",
      },
    });
  }

  return NextResponse.json(suggestion);
}
