import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INVOICE_STORE_KEYS } from "@/lib/invoiceAccess";
import { requireInvoiceUser, isValidValue } from "@/lib/invoiceServer";

// POST { data: { [key]: jsonString } } — one-time upload of a browser's local
// data. Refuses if the cloud already has anything, so a stale browser can never
// overwrite live data.
export async function POST(req: NextRequest) {
  const auth = await requireInvoiceUser();
  if (auth.error) return auth.error;
  if ((await prisma.invoiceData.count()) > 0) {
    return NextResponse.json({ error: "Cloud already has invoice data" }, { status: 409 });
  }
  const { data } = await req.json();
  const entries = Object.entries(data ?? {}).filter(
    ([k, v]) => (INVOICE_STORE_KEYS as readonly string[]).includes(k) && isValidValue(v)
  ) as [string, string][];
  if (entries.length === 0) return NextResponse.json({ error: "Nothing to import" }, { status: 400 });
  await prisma.$transaction(
    entries.map(([key, value]) => prisma.invoiceData.create({ data: { key, value, updatedBy: auth.name } }))
  );
  return NextResponse.json({ ok: true, imported: entries.length });
}
