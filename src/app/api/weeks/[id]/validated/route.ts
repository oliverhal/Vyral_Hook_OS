import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Add a validated hook to this week's selection
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { validatedHookId } = await req.json();
  if (!validatedHookId) return NextResponse.json({ error: "validatedHookId required" }, { status: 400 });

  // Determine next selectedOrder for this week
  const existing = await prisma.weekValidatedHook.findMany({
    where: { weekId: params.id },
    orderBy: { selectedOrder: "desc" },
    take: 1,
  });
  const nextOrder = (existing[0]?.selectedOrder ?? 0) + 1;

  const result = await prisma.weekValidatedHook.upsert({
    where: { weekId_validatedHookId: { weekId: params.id, validatedHookId } },
    create: { weekId: params.id, validatedHookId, selectedOrder: nextOrder },
    update: {},
    include: { validatedHook: true },
  });

  return NextResponse.json(result);
}
