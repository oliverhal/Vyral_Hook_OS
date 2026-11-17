import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtieReviewer } from "@/lib/artieServer";

const snapshot = (c: { status: string; approvedAmount: number | null; reason: string | null }) =>
  JSON.stringify({ status: c.status, approvedAmount: c.approvedAmount, reason: c.reason });

// Approve / reject / correct / reopen one bonus candidate. initialAmount is never
// touched, so what the creator first saw is always recoverable; every decision
// is written to the audit log with who made it.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireArtieReviewer();
  if (auth.error) return auth.error;
  const { action, amount, reason } = await req.json().catch(() => ({} as Record<string, unknown>));
  const note = typeof reason === "string" ? reason.trim().slice(0, 1000) : "";

  const cur = await prisma.artieBonusCandidate.findUnique({ where: { id: params.id } });
  if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let next: { status: string; approvedAmount: number | null; reason: string | null };
  switch (action) {
    case "approve":
      next = { status: "approved", approvedAmount: cur.initialAmount, reason: note || null };
      break;
    case "reject":
      if (!note) return NextResponse.json({ error: "A reason is required to reject a bonus" }, { status: 400 });
      next = { status: "rejected", approvedAmount: 0, reason: note };
      break;
    case "correct": {
      const n = Number(amount);
      if (!Number.isFinite(n) || n < 0 || n > 100000) return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
      if (!note) return NextResponse.json({ error: "A reason is required to correct a bonus" }, { status: 400 });
      next = { status: "corrected", approvedAmount: n, reason: note };
      break;
    }
    case "reopen":
      next = { status: "pending", approvedAmount: null, reason: null };
      break;
    default:
      return NextResponse.json({ error: "action must be approve, reject, correct or reopen" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.artieBonusCandidate.update({
      where: { id: cur.id },
      data: { ...next, reviewedBy: action === "reopen" ? null : auth.name, reviewedAt: action === "reopen" ? null : new Date() },
    });
    await tx.artieBonusEvent.create({
      data: { candidateId: cur.id, action: action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "correct" ? "corrected" : "reopened",
        before: snapshot(cur), after: snapshot(next), actor: auth.name },
    });
    return row;
  });
  return NextResponse.json({ ok: true, status: updated.status, approvedAmount: updated.approvedAmount });
}
