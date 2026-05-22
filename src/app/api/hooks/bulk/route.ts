import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as { id?: string; name?: string };
  const submittedById = sessionUser.id ?? null;
  const submitterName = sessionUser.name ?? "Unknown";

  const { weekId, hooks } = await req.json();
  if (!weekId || !Array.isArray(hooks) || hooks.length === 0) {
    return NextResponse.json({ error: "weekId and hooks array required" }, { status: 400 });
  }

  const created = await prisma.$transaction(
    hooks.map((h: {
      hookText: string;
      format: string;
      caption: string;
      referenceVideo?: string | null;
      recordingNotes?: string | null;
      requiresAppFootage?: boolean;
      appFootageSource?: string | null;
    }) =>
      prisma.hook.create({
        data: {
          weekId,
          submittedById,
          submitterName,
          hookText: h.hookText,
          format: h.format ?? "Faceless",
          caption: h.caption ?? "Creator to come up with their own caption",
          referenceVideo: h.referenceVideo ?? null,
          recordingNotes: h.recordingNotes ?? null,
          requiresAppFootage: h.requiresAppFootage ?? false,
          appFootageSource: h.appFootageSource ?? null,
          status: "submitted",
        },
      })
    )
  );

  return NextResponse.json({ count: created.length, hooks: created });
}
