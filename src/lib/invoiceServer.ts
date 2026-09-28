import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { INVOICE_ALLOWED_NAMES } from "@/lib/invoiceAccess";

const MAX_VALUE_BYTES = 2_000_000;

export async function requireInvoiceUser(): Promise<{ name: string; error?: undefined } | { error: NextResponse; name?: undefined }> {
  const session = await getServerSession(authOptions);
  const name = (session?.user as { name?: string } | undefined)?.name ?? "";
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!INVOICE_ALLOWED_NAMES.includes(name)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { name };
}

export function isValidValue(v: unknown): v is string {
  if (typeof v !== "string" || v.length > MAX_VALUE_BYTES) return false;
  try { JSON.parse(v); return true; } catch { return false; }
}
