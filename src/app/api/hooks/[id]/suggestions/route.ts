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

  const suggestion = await prisma.hookSuggestion.create({
    data: { hookId: params.id, suggestedBy, hookText: hookText.trim() },
  });

  return NextResponse.json(suggestion);
}
