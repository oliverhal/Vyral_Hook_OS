import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const userId = (session.user as { id: string }).id;

  const hook = await prisma.hook.findUnique({
    where: { id: params.id },
    include: { week: { include: { campaign: true } } },
  });
  if (!hook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (hook.wentViral) {
    // Toggle off — remove from validated if there's a matching source
    await prisma.hook.update({ where: { id: params.id }, data: { wentViral: false } });
    await prisma.validatedHook.deleteMany({ where: { sourceHookId: params.id } });
    return NextResponse.json({ wentViral: false });
  }

  await prisma.hook.update({ where: { id: params.id }, data: { wentViral: true } });

  // Upsert into validated library
  const existing = await prisma.validatedHook.findFirst({ where: { sourceHookId: params.id } });
  if (!existing) {
    await prisma.validatedHook.create({
      data: {
        campaignId: hook.week.campaignId,
        hookText: hook.hookText,
        format: hook.format,
        sourceHookId: params.id,
        addedById: userId,
      },
    });
  }

  return NextResponse.json({ wentViral: true });
}
