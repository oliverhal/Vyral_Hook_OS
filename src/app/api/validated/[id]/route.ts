import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const validated = await prisma.validatedHook.findUnique({ where: { id: params.id } });
  if (!validated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Unmark the source hook if it exists
  if (validated.sourceHookId) {
    await prisma.hook.updateMany({
      where: { id: validated.sourceHookId },
      data: { wentViral: false },
    });
  }

  await prisma.validatedHook.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
