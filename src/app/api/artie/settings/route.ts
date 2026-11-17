import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtieReviewer } from "@/lib/artieServer";
import { sheetExportUrl } from "@/lib/artie/payrollSheet";
import { getSettings } from "@/lib/artie/sync";

export async function PUT(req: NextRequest) {
  const auth = await requireArtieReviewer();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  await getSettings();
  const data: Record<string, unknown> = {};

  if ("payrollSheetUrl" in body) {
    const url = typeof body.payrollSheetUrl === "string" ? body.payrollSheetUrl.trim() : "";
    if (url && !sheetExportUrl(url)) return NextResponse.json({ error: "That doesn't look like a Google Sheets link" }, { status: 400 });
    data.payrollSheetUrl = url || null;
  }
  if ("payrollClient" in body) {
    if (typeof body.payrollClient !== "string" || body.payrollClient.length > 60) return NextResponse.json({ error: "Invalid programme name" }, { status: 400 });
    data.payrollClient = body.payrollClient.trim();
  }
  if ("countMode" in body) {
    if (body.countMode !== "unique" && body.countMode !== "instagram") return NextResponse.json({ error: "countMode must be unique or instagram" }, { status: 400 });
    data.countMode = body.countMode;
  }
  if ("videosPerDay" in body) {
    const n = Math.round(Number(body.videosPerDay));
    if (!Number.isFinite(n) || n < 1 || n > 20) return NextResponse.json({ error: "Videos per day must be between 1 and 20" }, { status: 400 });
    data.videosPerDay = n;
  }
  if ("bonusThreshold" in body) {
    const n = Math.round(Number(body.bonusThreshold));
    if (!Number.isFinite(n) || n < 1 || n > 100_000_000) return NextResponse.json({ error: "Invalid bonus threshold" }, { status: 400 });
    data.bonusThreshold = n;
  }
  if ("bonusAmount" in body) {
    const n = Number(body.bonusAmount);
    if (!Number.isFinite(n) || n < 0 || n > 100000) return NextResponse.json({ error: "Invalid bonus amount" }, { status: 400 });
    data.bonusAmount = n;
  }
  if ("currency" in body) {
    if (typeof body.currency !== "string" || !/^[A-Z]{3}$/.test(body.currency)) return NextResponse.json({ error: "Currency must be a 3-letter code like USD" }, { status: 400 });
    data.currency = body.currency;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  await prisma.artieSettings.update({ where: { id: "singleton" }, data });
  return NextResponse.json({ ok: true });
}
