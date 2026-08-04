import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SHEETS = [
  { client: "Vyral Labs",  fileId: "1Vu2VnEan2A4mx8P6TUHHGrk8tqV5ef64ZqgPiqGEjv4", format: "vyral" as const },
  { client: "Juno",        fileId: "1SX0gSvzHeVxijYuHlX8dGWEfAmwhi3EZzHzxNhue25Y", format: "juno" as const },
  { client: "Jumpspeak",   fileId: "1OgGK2wZWY4qcTFN91xcdiMvqGWF1-izw4mLFs79rOG0", format: "standard" as const },
  { client: "Ecosia",      fileId: "1d2T0_IiAgK973W_-CudgsARjAJBKoSGduipvTbKFajU", format: "ecosia" as const },
  { client: "Artie",       fileId: "1Kiz5ABp-GMbIWCf4vMdW0q_j3Hc55nTuev4mRN9AWLM", format: "artie" as const },
  { client: "Pazi",        fileId: "1UfurIf0UDE8gBqK_WwDG1hdyCQLzhLa7AmlpLxBePLU", format: "standard" as const },
];

type SheetFormat = "vyral" | "juno" | "standard" | "ecosia" | "artie";

interface ParsedRow {
  firstName: string;
  lastName: string;
  email: string;
  over18: boolean;
  location: string;
  tiktok: string | null;
  instagram: string | null;
  notes: string | null;
  submittedAt: Date;
  phone: string | null;
  referredBy: string | null;
  chronicIllness: string | null;
  language: string | null;
}

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

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function extractSocials(raw: string): { tiktok: string | null; instagram: string | null } {
  if (!raw) return { tiktok: null, instagram: null };
  const lo = raw.toLowerCase();
  const noSocial = ["n/a", "none", "don't have", "not provided", "no tiktok", "no instagram"];
  if (noSocial.some((s) => lo.includes(s)) && raw.length < 20) return { tiktok: null, instagram: null };

  let tiktok: string | null = null;
  let instagram: string | null = null;

  const ttUrlMatch = raw.match(/https?:\/\/(?:www\.)?tiktok\.com\/@?([^\/\s?&,'"<\r\n]+)/i);
  if (ttUrlMatch) tiktok = "@" + ttUrlMatch[1].replace(/^@/, "");

  const igUrlMatch = raw.match(/https?:\/\/(?:www\.)?instagram\.com\/([^\/\s?&,'"<\r\n]+)/i);
  if (igUrlMatch) instagram = igUrlMatch[1];

  // If no URL match, use the raw value as tiktok (common for Juno/Artie where they just paste one handle)
  if (!tiktok && !instagram) {
    const cleaned = raw.replace(/^@/, "").trim();
    if (cleaned && !cleaned.includes(" ") && cleaned.length > 2 && cleaned.length < 60) {
      tiktok = raw.trim();
    }
  }

  return { tiktok, instagram };
}

function cleanSocial(s: string | null | undefined): string | null {
  if (!s) return null;
  const skip = ["n/a", "none", "/", ".", "don't have", "no tiktok", "not provided", "no instagram", ""];
  const lo = s.toLowerCase().trim();
  if (skip.includes(lo)) return null;
  return s.trim() || null;
}

function parseVyral(cols: string[]): ParsedRow | null {
  // Timestamp | First Name | Last Name | Email | Over18 | Location | TikTok | Instagram | Notes | Submitted At
  const [, firstName, lastName, email, over18Raw, location, tiktok, instagram, notes, submittedAtRaw] = cols;
  if (!email || !firstName || !submittedAtRaw) return null;
  const submittedAt = new Date(submittedAtRaw);
  if (isNaN(submittedAt.getTime())) return null;
  return {
    firstName: firstName.trim(),
    lastName: (lastName ?? "").trim(),
    email: email.trim().toLowerCase(),
    over18: over18Raw?.trim() === "Yes",
    location: location?.trim() || "Unknown",
    tiktok: cleanSocial(tiktok),
    instagram: cleanSocial(instagram),
    notes: notes?.trim() || null,
    submittedAt,
    phone: null,
    referredBy: null,
    chronicIllness: null,
    language: null,
  };
}

function parseJuno(cols: string[]): ParsedRow | null {
  // Timestamp | Full Name | Email | Location | Over18 | Commitment | Chronic Illness | Social Media | Referral
  const [timestamp, fullName, email, location, over18Raw, commitment, chronicIllness, socialMedia, referredBy] = cols;
  if (!email || !fullName) return null;
  const submittedAt = new Date(timestamp);
  if (isNaN(submittedAt.getTime())) return null;
  const { firstName, lastName } = splitName(fullName);
  const { tiktok, instagram } = extractSocials(socialMedia ?? "");
  const noteParts: string[] = [];
  if (commitment?.trim()) noteParts.push(`Commitment: ${commitment.trim()}`);
  return {
    firstName,
    lastName,
    email: email.trim().toLowerCase(),
    over18: over18Raw?.trim() === "Yes",
    location: location?.trim() || "Unknown",
    tiktok,
    instagram,
    notes: noteParts.join(" | ") || null,
    submittedAt,
    phone: null,
    referredBy: referredBy?.trim() || null,
    chronicIllness: chronicIllness?.trim() || null,
    language: null,
  };
}

function parseStandard(cols: string[]): ParsedRow | null {
  // Timestamp | Full Name | Email | Phone | Commitment | Content Experience | Social Media | Referral | Over18
  const [timestamp, fullName, email, phone, commitment, contentExp, socialMedia, referredBy, over18Raw] = cols;
  if (!email || !fullName) return null;
  const submittedAt = new Date(timestamp);
  if (isNaN(submittedAt.getTime())) return null;
  const { firstName, lastName } = splitName(fullName);
  const { tiktok, instagram } = extractSocials(socialMedia ?? "");
  const noteParts: string[] = [];
  if (contentExp?.trim()) noteParts.push(`Content experience: ${contentExp.trim()}`);
  if (commitment?.trim()) noteParts.push(`Commitment: ${commitment.trim()}`);
  return {
    firstName,
    lastName,
    email: email.trim().toLowerCase(),
    over18: over18Raw?.trim() === "Yes",
    location: "Unknown",
    tiktok,
    instagram,
    notes: noteParts.join(" | ") || null,
    submittedAt,
    phone: phone?.trim() || null,
    referredBy: referredBy?.trim() || null,
    chronicIllness: null,
    language: null,
  };
}

function parseEcosia(cols: string[]): ParsedRow | null {
  // Timestamp | Full Name | Email | Phone | Commitment | Content Experience | Social Media | Referral | Over18 | Language
  const row = parseStandard(cols);
  if (!row) return null;
  const language = cols[9]?.trim() || null;
  return { ...row, language };
}

function parseArtie(cols: string[]): ParsedRow | null {
  // Timestamp | Full Name | Email | Phone | Based in USA? | Over18 | Commitment | Piano Access | Content Experience | Social Media | Referral
  const [timestamp, fullName, email, phone, usaBased, over18Raw, commitment, pianoAccess, contentExp, socialMedia, referredBy] = cols;
  if (!email || !fullName) return null;
  const submittedAt = new Date(timestamp);
  if (isNaN(submittedAt.getTime())) return null;
  const { firstName, lastName } = splitName(fullName);
  const { tiktok, instagram } = extractSocials(socialMedia ?? "");
  const noteParts: string[] = [];
  if (pianoAccess?.trim()) noteParts.push(`Piano access: ${pianoAccess.trim()}`);
  if (contentExp?.trim()) noteParts.push(`Content experience: ${contentExp.trim()}`);
  if (commitment?.trim()) noteParts.push(`Commitment: ${commitment.trim()}`);
  return {
    firstName,
    lastName,
    email: email.trim().toLowerCase(),
    over18: over18Raw?.trim() === "Yes",
    location: usaBased?.trim() === "Yes" ? "United States" : "Unknown",
    tiktok,
    instagram,
    notes: noteParts.join(" | ") || null,
    submittedAt,
    phone: phone?.trim() || null,
    referredBy: referredBy?.trim() || null,
    chronicIllness: null,
    language: null,
  };
}

function parseRow(format: SheetFormat, cols: string[]): ParsedRow | null {
  switch (format) {
    case "vyral":    return parseVyral(cols);
    case "juno":     return parseJuno(cols);
    case "standard": return parseStandard(cols);
    case "ecosia":   return parseEcosia(cols);
    case "artie":    return parseArtie(cols);
  }
}

function isTestEntry(row: ParsedRow): boolean {
  return (
    !row.email.includes("@") ||
    row.email.endsWith("@") ||
    row.email.includes("@@@") ||
    row.firstName.length < 2 ||
    row.email.includes("test@") ||
    row.email.includes("example.com")
  );
}

async function syncSheet(client: string, fileId: string, format: SheetFormat) {
  const url = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return { client, error: `HTTP ${res.status}`, created: 0, skipped: 0 };
  }

  const csv = await res.text();
  const lines = csv.split("\n").filter(Boolean);
  const rows = lines.slice(1); // skip header

  let created = 0;
  let skipped = 0;

  for (const line of rows) {
    const cols = parseCSVLine(line);
    const row = parseRow(format, cols);
    if (!row || isTestEntry(row)) { skipped++; continue; }

    try {
      await prisma.creatorApplication.upsert({
        where: {
          email_submittedAt_client: {
            email: row.email,
            submittedAt: row.submittedAt,
            client,
          },
        },
        update: {},
        create: {
          client,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          over18: row.over18,
          location: row.location,
          tiktok: row.tiktok,
          instagram: row.instagram,
          notes: row.notes,
          submittedAt: row.submittedAt,
          phone: row.phone,
          referredBy: row.referredBy,
          chronicIllness: row.chronicIllness,
          language: row.language,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return { client, created, skipped, total: rows.length };
}

export async function GET() {
  return run();
}

export async function POST() {
  return run();
}

async function run() {
  const results = await Promise.allSettled(
    SHEETS.map((s) => syncSheet(s.client, s.fileId, s.format))
  );

  const summary = results.map((r) => {
    if (r.status === "fulfilled") return r.value;
    return { client: "unknown", error: String(r.reason), created: 0, skipped: 0 };
  });

  const totalCreated = summary.reduce((n, s) => n + (s.created ?? 0), 0);
  const totalSkipped = summary.reduce((n, s) => n + (s.skipped ?? 0), 0);

  return NextResponse.json({ ok: true, created: totalCreated, skipped: totalSkipped, sheets: summary });
}
