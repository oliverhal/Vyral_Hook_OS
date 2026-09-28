import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INVOICE_STORE_KEYS } from "@/lib/invoiceAccess";
import { requireInvoiceUser, isValidValue } from "@/lib/invoiceServer";

// GET → { data: { [key]: jsonString } }
export async function GET() {
  const auth = await requireInvoiceUser();
  if (auth.error) return auth.error;
  const rows = await prisma.invoiceData.findMany();
  const data: Record<string, string> = {};
  for (const r of rows) data[r.key] = r.value;
  return NextResponse.json({ data });
}

// PUT { key, value } → upsert one key
export async function PUT(req: NextRequest) {
  const auth = await requireInvoiceUser();
  if (auth.error) return auth.error;
  const { key, value } = await req.json();
  if (!(INVOICE_STORE_KEYS as readonly string[]).includes(key) || !isValidValue(value)) {
    return NextResponse.json({ error: "Invalid key or value" }, { status: 400 });
  }
  const row = await prisma.invoiceData.upsert({
    where: { key },
    create: { key, value, updatedBy: auth.name },
    update: { value, updatedBy: auth.name },
  });
  return NextResponse.json({ ok: true, updatedAt: row.updatedAt });
}
