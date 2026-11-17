// Reads the Artie creator payroll sheet (via Google's public CSV export, the
// same approach the creator-applications sync uses). Pure parsing functions are
// exported separately from the network fetch so they can be tested.

export interface RosterRow {
  sheetKey: string; // stable key: email if the sheet has one, else the lower-cased name
  name: string;
  ratePerVideo: number | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
}

export interface UnmappedRow {
  line: number; // 1-based row number in the sheet
  reason: string;
  cells: string[];
}

export interface RosterParse {
  creators: RosterRow[];
  unmapped: UnmappedRow[];
  columns: Record<string, string | null>; // which header each field was read from
  error?: string;
}

/** RFC-4180 CSV: quoted cells may contain commas, quotes ("") and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Accepts a full sheet URL or a bare file id; keeps the tab (gid) if the URL has one. */
export function sheetExportUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/\/d\/([A-Za-z0-9_-]{20,})/) ?? s.match(/^([A-Za-z0-9_-]{25,})$/);
  if (!m) return null;
  const gid = s.match(/[#&?]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
}

const FIELD_PATTERNS: Record<string, RegExp[]> = {
  email: [/^e-?mail/i],
  name: [/^(creator|full)?\s*name\b/i, /^creator\b/i],
  rate: [/per\s*video/i, /\brate\b/i, /\bpay\b/i, /\bprice\b/i, /\bfee\b/i],
  instagram: [/instagram/i, /^ig\b/i, /^insta\b/i],
  tiktok: [/tik\s*tok/i, /^tt\b/i],
  facebook: [/facebook/i, /^fb\b/i],
};

function detectColumns(header: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
    out[field] = null;
    for (const re of patterns) {
      const idx = header.findIndex((h, i) => re.test(h.trim()) && !Object.values(out).includes(i));
      if (idx !== -1) { out[field] = idx; break; }
    }
  }
  return out;
}

const EMPTY = /^(n\/?a|none|-|—|no|\/|\.|not provided|don'?t have.*)$/i;

/** @handle, handle, or a profile URL → bare handle / page id (lower-cased). */
export function extractHandle(raw: string | null | undefined, platform: "instagram" | "tiktok" | "facebook"): string | null {
  const s = (raw ?? "").trim();
  if (!s || EMPTY.test(s)) return null;
  if (/^https?:\/\//i.test(s) || /^(www\.)?(instagram|tiktok|facebook)\.com\//i.test(s)) {
    try {
      const u = new URL(/^https?:/i.test(s) ? s : `https://${s}`);
      if (platform === "facebook") {
        const id = u.searchParams.get("id");
        if (id) return id;
      }
      const seg = u.pathname.split("/").filter(Boolean)[0];
      return seg ? seg.replace(/^@/, "").toLowerCase() : null;
    } catch { return null; }
  }
  const h = s.replace(/^@/, "").split(/[?\s/]/)[0].toLowerCase();
  return h || null;
}

export function parseRate(raw: string | null | undefined): number | null {
  const m = (raw ?? "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export function parseRoster(rows: string[][]): RosterParse {
  // Header = first row that names a creator column plus at least one platform column.
  let headerIdx = -1;
  let cols: Record<string, number | null> = {};
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const c = detectColumns(rows[i]);
    if (c.name != null && (c.instagram != null || c.tiktok != null || c.facebook != null)) {
      headerIdx = i; cols = c; break;
    }
  }
  if (headerIdx === -1) {
    return { creators: [], unmapped: [], columns: {}, error: "Couldn't find a header row with a creator name column and at least one of Instagram / TikTok / Facebook." };
  }

  const header = rows[headerIdx];
  const columns: Record<string, string | null> = {};
  for (const [f, i] of Object.entries(cols)) columns[f] = i == null ? null : header[i].trim();

  const creators: RosterRow[] = [];
  const unmapped: UnmappedRow[] = [];
  const seen = new Set<string>();
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.every((c) => !c.trim())) continue;
    const at = (f: string) => (cols[f] != null ? (cells[cols[f] as number] ?? "").trim() : "");
    const name = at("name");
    if (!name) { unmapped.push({ line: r + 1, reason: "No creator name", cells }); continue; }

    const instagram = extractHandle(at("instagram"), "instagram");
    const tiktok = extractHandle(at("tiktok"), "tiktok");
    const facebook = extractHandle(at("facebook"), "facebook");
    if (!instagram && !tiktok && !facebook) {
      unmapped.push({ line: r + 1, reason: "No Instagram / TikTok / Facebook handle", cells });
      continue;
    }
    const email = at("email").toLowerCase();
    const sheetKey = /@/.test(email) ? email : name.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(sheetKey)) { unmapped.push({ line: r + 1, reason: `Duplicate of an earlier row (${sheetKey})`, cells }); continue; }
    seen.add(sheetKey);
    creators.push({ sheetKey, name, ratePerVideo: parseRate(at("rate")), instagram, tiktok, facebook });
  }
  return { creators, unmapped, columns };
}

export async function fetchRoster(sheetUrl: string): Promise<RosterParse> {
  const url = sheetExportUrl(sheetUrl);
  if (!url) return { creators: [], unmapped: [], columns: {}, error: "That doesn't look like a Google Sheets link." };
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!res.ok) {
    return { creators: [], unmapped: [], columns: {}, error: `Couldn't read the sheet (HTTP ${res.status}). It must be shared as "anyone with the link can view".` };
  }
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) {
    return { creators: [], unmapped: [], columns: {}, error: 'Google returned a sign-in page, not CSV. Share the sheet as "anyone with the link can view".' };
  }
  return parseRoster(parseCsv(text));
}
