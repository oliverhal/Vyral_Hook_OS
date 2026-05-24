import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startOfWeek, format } from "date-fns";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hooks = await prisma.hook.findMany({
    select: {
      submitterName: true,
      isSelected: true,
      createdAt: true,
    },
  });

  const map = new Map<string, { count: number; selected: number }>();

  for (const hook of hooks) {
    // Use createdAt so we know when the hook was actually submitted
    // format() uses local time consistently — no UTC shift issues
    const weekStart = format(
      startOfWeek(new Date(hook.createdAt), { weekStartsOn: 1 }),
      "yyyy-MM-dd"
    );
    const key = `${hook.submitterName}::${weekStart}`;
    const existing = map.get(key) ?? { count: 0, selected: 0 };
    map.set(key, {
      count: existing.count + 1,
      selected: existing.selected + (hook.isSelected ? 1 : 0),
    });
  }

  const data = Array.from(map.entries()).map(([key, val]) => {
    const [submitterName, weekStart] = key.split("::");
    return { submitterName, weekStart, ...val };
  });

  const members = await prisma.user.findMany({
    where: { active: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data, members: members.map((m) => m.name) });
}
