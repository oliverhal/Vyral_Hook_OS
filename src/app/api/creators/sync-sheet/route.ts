import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1Vu2VnEan2A4mx8P6TUHHGrk8tqV5ef64ZqgPiqGEjv4/export?format=csv";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function GET() {
  return sync();
}

export async function POST() {
  return sync();
}

async function sync() {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch sheet" }, { status: 502 });
  }

  const csv = await res.text();
  const lines = csv.split("\n").filter(Boolean);

  // Skip header row
  const rows = lines.slice(1);

  let created = 0;
  let skipped = 0;

  for (const line of rows) {
    const cols = parseCSVLine(line);
    // Columns: Timestamp, First Name, Last Name, Email, Over18, Location, TikTok, Instagram, Notes, Submitted At
    const [, firstName, lastName, email, over18Raw, location, tiktok, instagram, notes, submittedAtRaw] = cols;

    if (!email || !firstName || !submittedAtRaw) { skipped++; continue; }

    // Skip obvious test entries
    if (
      !email.includes("@") ||
      email.endsWith("@") ||
      email.includes("@@@") ||
      firstName.length < 2
    ) { skipped++; continue; }

    const submittedAt = new Date(submittedAtRaw);
    if (isNaN(submittedAt.getTime())) { skipped++; continue; }

    try {
      await prisma.creatorApplication.upsert({
        where: { email_submittedAt: { email, submittedAt } },
        update: {},
        create: {
          firstName: firstName || "",
          lastName: lastName || "",
          email,
          over18: over18Raw?.trim() === "Yes",
          location: location || "Unknown",
          tiktok: tiktok && tiktok !== "N/A" ? tiktok : null,
          instagram: instagram && instagram !== "N/A" ? instagram : null,
          notes: notes || null,
          submittedAt,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, created, skipped, total: rows.length });
}
