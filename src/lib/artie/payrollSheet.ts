// Reads the Artie creator payroll sheet (via Google's public CSV export, the
// same approach the creator-applications sync uses). Pure parsing functions are
// exported separately from the network fetch so they can be tested.

export interface RosterRow {
  sheetKey: string; // stable key: email if the sheet has one, else the lower-cased name
  name: string;
  ratePerVideo: number | null;
  /** "sheet" = read from the per-video column; "derived" = monthly rate ÷ expected videos (the sheet's own formula). */
  rateSource: "sheet" | "derived" | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
}

export interface UnmappedRow {
  line: number; // 1-based row number in the sheet
  reason: string;
  // Just enough to find the row. NEVER the raw cells: payroll sheets carry bank
  // details, addresses and even logins, and none of that may be copied into Hook OS.
  label: string;
}

export interface RosterParse {
  creators: RosterRow[];
  unmapped: UnmappedRow[];
  columns: Record<string, string | null>; // which header each field was read from
  skipped: { otherClient: number; inactive: number };
  error?: string;
}

export interface RosterOptions {
  /** Only import rows whose "Client Name" column equals this (case-insensitive). Blank = everyone. */
  client?: string | null;
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
  id: [/creator\s*id/i, /^id$/i],
  email: [/^e-?mail/i],
  name: [/(creator|full)\s*(full\s*)?name/i, /^name\b/i, /^creator\b(?!\s*id)/i],
  client: [/^client/i, /^programme/i, /^program\b/i],
  status: [/^status\b/i],
  // Only per-video rates: a monthly retainer in this column would be misread as a per-video rate.
  rate: [/per[\s-]*video/i, /video\s*rate/i],
  monthly: [/monthly\s*rate/i],
  expected: [/expected\s*videos/i],
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

const INACTIVE_STATUS = /^(fired|inactive|ended|terminated|left|quit|paused|former)\b/i;

const EMPTY = /^(n\/?a|none|-|—|no|\/|\.|not provided|don'?t have.*)$/i;

/** Marker for a Facebook share link (facebook.com/share/…): it only reveals the page once followed. */
export const FB_SHARE_PREFIX = "share:";

/** @handle, handle, or a profile URL → bare handle / page id (lower-cased). */
export function extractHandle(raw: string | null | undefined, platform: "instagram" | "tiktok" | "facebook"): string | null {
  const s = (raw ?? "").trim();
  if (!s || EMPTY.test(s)) return null;
  if (/^https?:\/\//i.test(s) || /^(www\.)?(instagram|tiktok|facebook)\.com\//i.test(s)) {
    try {
      const u = new URL(/^https?:/i.test(s) ? s : `https://${s}`);
      const segs = u.pathname.split("/").filter(Boolean);
      if (platform === "facebook") {
        const id = u.searchParams.get("id");
        if (id) return id;
        // facebook.com/share/<code> only reveals the page when followed — resolved later.
        if (segs[0]?.toLowerCase() === "share") return `${FB_SHARE_PREFIX}${u.toString()}`;
        // facebook.com/people/<Page-Name>/<numeric id>  and  /pages/<Page-Name>/<numeric id>
        if (["people", "pages"].includes(segs[0]?.toLowerCase() ?? "") && segs.length >= 2) {
          const numeric = segs.slice(2).find((x) => /^\d{6,}$/.test(x));
          return (numeric ?? segs[1]).toLowerCase();
        }
      }
      const seg = segs[0];
      return seg ? seg.replace(/^@/, "").toLowerCase() : null;
    } catch { return null; }
  }
  const h = s.replace(/^@/, "").split(/[?\s/]/)[0].toLowerCase();
  return h || null;
}

/**
 * Follow Facebook share links to the page they point at and re-read the handle. A link we can't
 * resolve becomes null (the creator simply has no Facebook match) rather than a wrong handle.
 */
export async function resolveFacebookShares(creators: RosterRow[], fetchImpl: typeof fetch = fetch): Promise<void> {
  for (const c of creators) {
    if (!c.facebook?.startsWith(FB_SHARE_PREFIX)) continue;
    const url = c.facebook.slice(FB_SHARE_PREFIX.length);
    try {
      const res = await fetchImpl(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
      const resolved = extractHandle(res.url, "facebook");
      c.facebook = resolved && !resolved.startsWith(FB_SHARE_PREFIX) ? resolved : null;
    } catch {
      c.facebook = null;
    }
  }
}

export function parseRate(raw: string | null | undefined): number | null {
  const m = (raw ?? "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export function parseRoster(rows: string[][], opts: RosterOptions = {}): RosterParse {
  const empty = (error: string, columns: Record<string, string | null> = {}): RosterParse =>
    ({ creators: [], unmapped: [], columns, skipped: { otherClient: 0, inactive: 0 }, error });

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
    return empty("Couldn't find a header row with a creator name column and at least one of Instagram / TikTok / Facebook.");
  }

  const header = rows[headerIdx];
  const columns: Record<string, string | null> = {};
  for (const [f, i] of Object.entries(cols)) columns[f] = i == null ? null : header[i].trim();

  const wantClient = (opts.client ?? "").trim().toLowerCase();
  if (wantClient && cols.client == null) {
    return empty(`The sheet has no "Client Name" column, so I can't limit it to ${opts.client}. Clear the programme filter in Settings to import every row.`, columns);
  }

  const creators: RosterRow[] = [];
  const unmapped: UnmappedRow[] = [];
  const skipped = { otherClient: 0, inactive: 0 };
  const seen = new Set<string>();
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.every((c) => !c.trim())) continue;
    const at = (f: string) => (cols[f] != null ? (cells[cols[f] as number] ?? "").trim() : "");

    if (wantClient && at("client").toLowerCase() !== wantClient) { skipped.otherClient++; continue; }
    if (INACTIVE_STATUS.test(at("status"))) { skipped.inactive++; continue; }

    const name = at("name");
    const label = name || at("id") || `row ${r + 1}`;
    if (!name) { unmapped.push({ line: r + 1, reason: "No creator name", label }); continue; }

    const instagram = extractHandle(at("instagram"), "instagram");
    const tiktok = extractHandle(at("tiktok"), "tiktok");
    const facebook = extractHandle(at("facebook"), "facebook");
    if (!instagram && !tiktok && !facebook) {
      unmapped.push({ line: r + 1, reason: "No Instagram / TikTok / Facebook handle", label });
      continue;
    }
    // Prefer the sheet's own creator id (stable across renames), then email, then the name.
    const email = at("email").toLowerCase();
    const sheetKey = at("id") ? `id:${at("id")}` : /@/.test(email) ? email : name.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(sheetKey)) { unmapped.push({ line: r + 1, reason: "Duplicate of an earlier row", label }); continue; }
    seen.add(sheetKey);
    // Per-video rate straight from the sheet; if that cell is blank, use the sheet's own formula
    // (monthly rate ÷ expected videos per cycle — it reproduces the per-video column exactly where all three exist).
    let ratePerVideo = parseRate(at("rate"));
    let rateSource: RosterRow["rateSource"] = ratePerVideo != null ? "sheet" : null;
    if (ratePerVideo == null) {
      const monthly = parseRate(at("monthly")), expected = parseRate(at("expected"));
      if (monthly != null && expected != null && expected > 0) {
        ratePerVideo = Math.round((monthly / expected) * 100) / 100;
        rateSource = "derived";
      }
    }
    creators.push({ sheetKey, name, ratePerVideo, rateSource, instagram, tiktok, facebook });
  }
  return { creators, unmapped, columns, skipped };
}

export async function fetchRoster(sheetUrl: string, opts: RosterOptions = {}): Promise<RosterParse> {
  const fail = (error: string): RosterParse => ({ creators: [], unmapped: [], columns: {}, skipped: { otherClient: 0, inactive: 0 }, error });
  const url = sheetExportUrl(sheetUrl);
  if (!url) return fail("That doesn't look like a Google Sheets link.");
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!res.ok) return fail(`Couldn't read the sheet (HTTP ${res.status}). It must be shared as "anyone with the link can view".`);
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) return fail('Google returned a sign-in page, not CSV. Share the sheet as "anyone with the link can view".');
  const roster = parseRoster(parseCsv(text), opts);
  await resolveFacebookShares(roster.creators);
  return roster;
}
