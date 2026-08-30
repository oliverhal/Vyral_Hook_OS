import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  const weekId = searchParams.get("weekId");
  const format = searchParams.get("format");
  const search = searchParams.get("search");
  const viral = searchParams.get("viral");

  // When filtering by validated, also include hooks referenced as sourceHookId in any ValidatedHook
  let validatedSourceIds: string[] = [];
  if (viral === "true") {
    const refs = await prisma.validatedHook.findMany({
      where: { sourceHookId: { not: null } },
      select: { sourceHookId: true },
    });
    validatedSourceIds = refs.map(r => r.sourceHookId!);
  }

  const hooks = await prisma.hook.findMany({
    where: {
      ...(weekId ? { weekId } : campaignId ? { week: { campaignId } } : {}),
      ...(format ? { format } : {}),
      ...(viral === "true"
        ? { OR: [{ wentViral: true }, ...(validatedSourceIds.length ? [{ id: { in: validatedSourceIds } }] : [])] }
        : {}),
      ...(search
        ? {
            OR: [
              { hookText: { contains: search } },
              { submitterName: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      week: { include: { campaign: true } },
      votes: true,
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const result = hooks.map(({ _count, ...hook }) => ({
    ...hook,
    commentCount: _count.comments,
  }));

  return NextResponse.json(result);
}
