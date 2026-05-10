import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Remove a validated hook from this week's selection
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; validatedId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.weekValidatedHook.deleteMany({
    where: { weekId: params.id, validatedHookId: params.validatedId },
  });

  return NextResponse.json({ ok: true });
}
