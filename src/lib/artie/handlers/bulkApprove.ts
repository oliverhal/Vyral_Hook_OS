import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtieReviewer } from "@/lib/artieServer";
import { cycleByKey } from "@/lib/artie/cycle";
import { needsLinkCheck } from "@/lib/artie/bonus";
import { parseJson } from "@/lib/artie/views";
import { type Programme } from "@/lib/artie/programme";

// Approve every PENDING bonus in a cycle that is a plain "hit the threshold" case. Bonuses with a
// possible linked Instagram+Facebook account are left alone — those need a person to look.
export async function handleBulk(programme: Programme, req: NextRequest) {
  const auth = await requireArtieReviewer();
  if (auth.error) return auth.error;
  const { cycle: key } = await req.json().catch(() => ({} as { cycle?: string }));
  const cycle = cycleByKey(String(key ?? ""));
  if (!cycle) return NextResponse.json({ error: "Invalid cycle" }, { status: 400 });

  const pending = await prisma.artieBonusCandidate.findMany({ where: { programme, cycleKey: cycle.key, status: "pending" } });
  const plain = pending.filter((c) => !needsLinkCheck(parseJson<string[]>(c.flags, [])));
  if (plain.length === 0) return NextResponse.json({ ok: true, approved: 0, skippedForCheck: pending.length });

  const now = new Date();
  await prisma.$transaction([
    ...plain.map((c) => prisma.artieBonusCandidate.update({
      where: { id: c.id },
      data: { status: "approved", approvedAmount: c.initialAmount, reason: "Hit the view threshold — qualifies for a bonus", reviewedBy: auth.name, reviewedAt: now },
    })),
    ...plain.map((c) => prisma.artieBonusEvent.create({
      data: { candidateId: c.id, action: "approved", actor: auth.name,
        before: JSON.stringify({ status: "pending", approvedAmount: null, reason: null }),
        after: JSON.stringify({ status: "approved", approvedAmount: c.initialAmount, reason: "Hit the view threshold — qualifies for a bonus (bulk)" }) },
    })),
  ]);
  return NextResponse.json({ ok: true, approved: plain.length, skippedForCheck: pending.length - plain.length });
}
