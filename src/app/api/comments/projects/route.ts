import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncProjectList } from "@/lib/commentsSync";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await syncProjectList();
  } catch {
    // Tracker API down — still show what we already have.
  }
  const projects = await prisma.commentProject.findMany({
    orderBy: [{ enabled: "desc" }, { name: "asc" }],
    include: { _count: { select: { videos: true } } },
  });
  return NextResponse.json(projects);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, enabled, replyBrief, minViews, lookbackDays } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const project = await prisma.commentProject.update({
    where: { id },
    data: {
      ...(typeof enabled === "boolean" && { enabled }),
      ...(typeof replyBrief === "string" && { replyBrief: replyBrief.trim() || null }),
      ...(Number.isInteger(minViews) && minViews > 0 && { minViews }),
      ...(Number.isInteger(lookbackDays) && lookbackDays > 0 && { lookbackDays }),
    },
  });
  return NextResponse.json(project);
}
