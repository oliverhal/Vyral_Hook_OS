import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// languageColIndex: column index (0-based) where language lives in this sheet, or null if absent
const SHEETS = [
  { client: "Vyral Labs",  fileId: "1Vu2VnEan2A4mx8P6TUHHGrk8tqV5ef64ZqgPiqGEjv4", format: "vyral" as const,    languageColIndex: null },
  { client: "Juno",        fileId: "1SX0gSvzHeVxijYuHlX8dGWEfAmwhi3EZzHzxNhue25Y", format: "juno" as const,      languageColIndex: 9    },
  { client: "Jumpspeak",   fileId: "1OgGK2wZWY4qcTFN91xcdiMvqGWF1-izw4mLFs79rOG0", format: "standard" as const,  languageColIndex: 9    },
  { client: "Ecosia",      fileId: "1d2T0_IiAgK973W_-CudgsARjAJBKoSGduipvTbKFajU", format: "ecosia" as const,    languageColIndex: 9    },
  { client: "Artie",       fileId: "1Kiz5ABp-GMbIWCf4vMdW0q_j3Hc55nTuev4mRN9AWLM", format: "artie" as const,    languageColIndex: 11   },
  { client: "Pazi",        fileId: "1UfurIf0UDE8gBqK_WwDG1hdyCQLzhLa7AmlpLxBePLU", format: "standard" as const,  languageColIndex: 9    },
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
  const trimmed = raw.trim();
  const lo = trimmed.toLowerCase();

  // Explicit "no social" responses
  const noSocial = ["n/a", "na", "none", "no", "nope", "-", "–", "—", "don't have",
    "not provided", "no tiktok", "no instagram", "don't have any"];
  if (noSocial.includes(lo) || trimmed.length === 0) return { tiktok: null, instagram: null };

  let tiktok: string | null = null;
  let instagram: string | null = null;

  // 1. Full TikTok URL
  const ttUrl = trimmed.match(/https?:\/\/(?:www\.)?tiktok\.com\/@?([^\/\s?&,'"<\r\n]+)/i);
  if (ttUrl) tiktok = "@" + ttUrl[1].replace(/^@/, "");

  // 2. Full Instagram URL — strip tracking params (igsh=, utm_source= etc.)
  const igUrl = trimmed.match(/https?:\/\/(?:www\.)?instagram\.com\/([^\/\s?&,'"<\r\n]+)/i);
  if (igUrl) instagram = igUrl[1].replace(/\?.*$/, "").replace(/\/$/, "");

  // 3. Instagram by text patterns: "handle on instagram", "@handle (IG)", "ig: @handle", "@handle instagram"
  if (!instagram) {
    const igPats = [
      /(@?[\w.]+)\s+on\s+instagram/i,
      /(@?[\w.]+)\s*\(\s*ig\s*\)/i,
      /(@?[\w.]+)\s*\(\s*instagram\s*\)/i,
      /\big\b\s*:?\s*@?([\w.]+)/i,
      /instagram\s*:?\s*@?([\w.]+)/i,
      /(@?[\w.]+)\s+instagram\b/i,
    ];
    for (const pat of igPats) {
      const m = trimmed.match(pat);
      if (m) { instagram = m[1].replace(/^@/, ""); break; }
    }
  }

  // 4. TikTok by text patterns: "handle on tiktok", "@handle (TikTok)", "tiktok: @handle"
  if (!tiktok) {
    const ttPats = [
      /(@?[\w.]+)\s+on\s+tiktok/i,
      /(@?[\w.]+)\s*\(\s*tiktok\s*\)/i,
      /(@?[\w.]+)\s*\(\s*tt\s*\)/i,
      /tiktok\s*:?\s*@?([\w.]+)/i,
      /\btt\b\s*:?\s*@?([\w.]+)/i,
    ];
    for (const pat of ttPats) {
      const m = trimmed.match(pat);
      if (m) { tiktok = m[1]; break; }
    }
  }

  // 5. Single word/handle with no platform context → store raw as tiktok (ambiguous but preserve data)
  if (!tiktok && !instagram) {
    const cleaned = trimmed.replace(/^@/, "");
    if (/^[\w.]+$/.test(cleaned) && cleaned.length > 2 && cleaned.length < 60) {
      tiktok = trimmed; // keep original including @ if present
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
  // Language is read at the syncSheet level via languageColIndex — not here
  return parseStandard(cols);
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

async function syncSheet(client: string, fileId: string, format: SheetFormat, languageColIndex: number | null) {
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

    // Apply language from the sheet's dedicated column when available
    if (languageColIndex !== null && !row.language) {
      const lang = cols[languageColIndex]?.trim();
      if (lang && lang.length > 0) row.language = lang;
    }

    try {
      await prisma.creatorApplication.upsert({
        where: {
          email_submittedAt_client: {
            email: row.email,
            submittedAt: row.submittedAt,
            client,
          },
        },
        // Re-parse socials and language on every sync so old records get fixed
        update: {
          tiktok: row.tiktok,
          instagram: row.instagram,
          language: row.language ?? undefined,
          phone: row.phone ?? undefined,
          referredBy: row.referredBy ?? undefined,
          chronicIllness: row.chronicIllness ?? undefined,
        },
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
  // Merge hardcoded sheets with any added via the UI
  const dbSheets = await prisma.creatorSheet.findMany({ where: { active: true } });
  const hardcodedClients = new Set(SHEETS.map((s) => s.client));
  const extraSheets = dbSheets
    .filter((s) => !hardcodedClients.has(s.client))
    .map((s) => ({ client: s.client, fileId: s.fileId, format: "standard" as const, languageColIndex: s.languageColIndex }));

  const allSheets = [...SHEETS, ...extraSheets];

  const results = await Promise.allSettled(
    allSheets.map((s) => syncSheet(s.client, s.fileId, s.format, s.languageColIndex))
  );

  // Update lastSyncedAt for DB sheets
  const byClient = Object.fromEntries(
    results.map((r, i) => [allSheets[i].client, r])
  );
  for (const s of dbSheets) {
    const r = byClient[s.client];
    if (!r) continue;
    const created = r.status === "fulfilled" ? (r.value.created ?? 0) : 0;
    await prisma.creatorSheet.update({
      where: { id: s.id },
      data: { lastSyncedAt: new Date(), lastSyncCreated: created },
    }).catch(() => {});
  }

  const summary = results.map((r) => {
    if (r.status === "fulfilled") return r.value;
    return { client: "unknown", error: String(r.reason), created: 0, skipped: 0 };
  });

  const totalCreated = summary.reduce((n, s) => n + (s.created ?? 0), 0);
  const totalSkipped = summary.reduce((n, s) => n + (s.skipped ?? 0), 0);

  return NextResponse.json({ ok: true, created: totalCreated, skipped: totalSkipped, sheets: summary });
}
