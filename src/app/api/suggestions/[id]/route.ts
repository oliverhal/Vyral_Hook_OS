import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { status } = await req.json();
  if (status !== "accepted" && status !== "declined") {
    return NextResponse.json({ error: "status must be accepted or declined" }, { status: 400 });
  }

  const suggestion = await prisma.hookSuggestion.findUnique({ where: { id: params.id } });
  if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (status === "accepted") {
    // Apply the suggested text to the hook
    await prisma.hook.update({
      where: { id: suggestion.hookId },
      data: { hookText: suggestion.hookText },
    });
    // Decline all other pending suggestions on the same hook
    await prisma.hookSuggestion.updateMany({
      where: { hookId: suggestion.hookId, status: "pending", id: { not: params.id } },
      data: { status: "declined" },
    });
  }

  const updated = await prisma.hookSuggestion.update({
    where: { id: params.id },
    data: { status },
  });

  return NextResponse.json(updated);
}
