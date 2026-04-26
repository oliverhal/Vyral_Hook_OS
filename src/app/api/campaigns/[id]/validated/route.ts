import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hooks = await prisma.validatedHook.findMany({
    where: { campaignId: params.id },
    include: { addedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(hooks);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json();
  const { hookText, format, caption, referenceVideo, recordingNotes, notes } = body;

  if (!hookText?.trim()) {
    return NextResponse.json({ error: "hookText required" }, { status: 400 });
  }

  const hook = await prisma.validatedHook.create({
    data: {
      campaignId: params.id,
      hookText: hookText.trim(),
      format: format || "Faceless",
      caption: caption ?? "",
      referenceVideo: referenceVideo || null,
      recordingNotes: recordingNotes || null,
      notes: notes || null,
      addedById: userId,
    },
    include: { addedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(hook);
}
