import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json().catch(() => ({}));
  const weekId: string | null = body.weekId ?? null;

  const hook = await prisma.hook.findUnique({
    where: { id: params.id },
    include: { week: { include: { campaign: true } } },
  });
  if (!hook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (hook.wentViral) {
    // Toggle off — remove week selection first, then the validated library entry
    await prisma.hook.update({ where: { id: params.id }, data: { wentViral: false } });
    const validatedEntry = await prisma.validatedHook.findFirst({ where: { sourceHookId: params.id } });
    if (validatedEntry) {
      await prisma.weekValidatedHook.deleteMany({ where: { validatedHookId: validatedEntry.id } });
      await prisma.validatedHook.delete({ where: { id: validatedEntry.id } });
    }
    return NextResponse.json({ wentViral: false });
  }

  await prisma.hook.update({ where: { id: params.id }, data: { wentViral: true } });

  // Upsert into validated library (copy caption/notes so the library entry is complete)
  let validatedHook = await prisma.validatedHook.findFirst({ where: { sourceHookId: params.id } });
  if (!validatedHook) {
    validatedHook = await prisma.validatedHook.create({
      data: {
        campaignId: hook.week.campaignId,
        hookText: hook.hookText,
        format: hook.format,
        caption: hook.caption ?? "",
        referenceVideo: hook.referenceVideo ?? null,
        recordingNotes: hook.recordingNotes ?? null,
        sourceHookId: params.id,
        addedById: userId,
      },
    });
  }

  // Auto-select into this week's validated picks
  if (weekId) {
    const last = await prisma.weekValidatedHook.findMany({
      where: { weekId },
      orderBy: { selectedOrder: "desc" },
      take: 1,
    });
    const nextOrder = (last[0]?.selectedOrder ?? 0) + 1;
    await prisma.weekValidatedHook.upsert({
      where: { weekId_validatedHookId: { weekId, validatedHookId: validatedHook.id } },
      create: { weekId, validatedHookId: validatedHook.id, selectedOrder: nextOrder },
      update: {},
    });
  }

  return NextResponse.json({ wentViral: true });
}
