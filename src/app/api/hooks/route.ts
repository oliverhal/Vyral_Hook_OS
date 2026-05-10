import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { weekId, hookText, format, caption, referenceVideo, recordingNotes, requiresAppFootage, appFootageSource } = body;

  if (!weekId || !hookText || !caption) {
    return NextResponse.json(
      { error: "weekId, hookText, and caption are required" },
      { status: 400 }
    );
  }

  const user = session.user as { id: string; name: string };

  const hook = await prisma.hook.create({
    data: {
      weekId,
      submittedById: user.id,
      submitterName: user.name ?? "Unknown",
      hookText,
      format: format ?? "Faceless",
      caption,
      referenceVideo: referenceVideo || null,
      recordingNotes: recordingNotes || null,
      requiresAppFootage: requiresAppFootage ?? false,
      appFootageSource: requiresAppFootage ? (appFootageSource || null) : null,
      status: "submitted",
    },
  });

  return NextResponse.json(hook, { status: 201 });
}
