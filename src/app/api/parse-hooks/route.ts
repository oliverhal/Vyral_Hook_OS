import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_FORMATS = ["Faceless", "Snapchat", "Snapchat + Talking", "Talking head", "Voiceover", "Text-only", "Long text", "Short text", "Greenscreen", "Other"];

// RFC-4180 TSV parser — handles quoted cells containing newlines and tabs
function parseTSV(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const n = raw.length;

  for (let i = 0; i < n; i++) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'; i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"' && cell === "") {
        inQuotes = true;
      } else if (ch === "\t") {
        row.push(cell.trim()); cell = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++;
        row.push(cell.trim());
        if (row.some((c) => c.length > 0)) rows.push(row);
        row = []; cell = "";
      } else {
        cell += ch;
      }
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function looksLikeUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

function matchFormat(s: string): string | null {
  const lower = s.toLowerCase();
  for (const f of VALID_FORMATS) {
    if (lower === f.toLowerCase()) return f;
  }
  for (const f of VALID_FORMATS) {
    if (lower.includes(f.toLowerCase())) return f;
  }
  return null;
}

// ── Header-based column detection ──────────────────────────────────────────
// Reads the first row and maps column names to indices.
// This is the most reliable path when the sheet has labelled headers.

interface ColMap {
  hookCol: number;
  formatCol: number;
  refCol: number;
  captionCol: number;
  notesCol: number;
}

function detectFromHeaders(firstRow: string[]): ColMap | null {
  const map: ColMap = { hookCol: -1, formatCol: -1, refCol: -1, captionCol: -1, notesCol: -1 };

  for (let i = 0; i < firstRow.length; i++) {
    const cell = firstRow[i].toLowerCase().trim();
    if (!cell) continue;

    if (map.hookCol === -1 && (cell.includes("hook") || cell.includes("text on screen") || cell.includes("hook text"))) {
      map.hookCol = i;
    } else if (map.formatCol === -1 && cell === "format") {
      map.formatCol = i;
    } else if (map.refCol === -1 && (cell.includes("reference") || cell.includes("ref vid") || cell.startsWith("ref"))) {
      map.refCol = i;
    } else if (map.captionCol === -1 && cell.includes("caption")) {
      map.captionCol = i;
    } else if (map.notesCol === -1 && (cell.includes("note") || cell.includes("instruction"))) {
      map.notesCol = i;
    }
  }

  // At least hook + one other column must be identified for this to be reliable
  const found = [map.hookCol, map.formatCol, map.refCol, map.captionCol, map.notesCol].filter((v) => v >= 0).length;
  return found >= 2 ? map : null;
}

// ── Heuristic detection (fallback when no headers) ─────────────────────────

function isFormatOnly(col: string[]): boolean {
  const nonEmpty = col.filter((c) => c.length > 0);
  if (nonEmpty.length === 0) return false;
  const matches = nonEmpty.filter((c) => matchFormat(c) !== null);
  return matches.length / nonEmpty.length > 0.6;
}

function heuristicColumns(rows: string[][], numCols: number): ColMap {
  const cols: string[][] = Array.from({ length: numCols }, (_, i) =>
    rows.map((r) => r[i] ?? "")
  );

  let formatCol = -1;
  let refCol = -1;

  for (let c = 0; c < numCols; c++) {
    const nonEmpty = cols[c].filter((v) => v.length > 0);
    if (nonEmpty.length === 0) continue;
    if (refCol === -1 && nonEmpty.some(looksLikeUrl)) { refCol = c; continue; }
    if (formatCol === -1 && isFormatOnly(cols[c])) { formatCol = c; continue; }
  }

  const taken = new Set([formatCol, refCol]);
  let hookCol = 0;
  let bestScore = -1;

  for (let c = 0; c < numCols; c++) {
    if (taken.has(c)) continue;
    const nonEmpty = cols[c].filter((v) => v.length > 10);
    if (nonEmpty.length === 0) continue;
    const avgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / nonEmpty.length;
    // Bias toward EARLIER columns — hook text is almost always leftmost
    const score = avgLen - c * 5;
    if (score > bestScore) { bestScore = score; hookCol = c; }
  }

  return { hookCol, formatCol, refCol, captionCol: -1, notesCol: -1 };
}

// ── AI fallback ────────────────────────────────────────────────────────────

function needsAiFallback(rows: string[][], hookCol: number, formatCol: number): boolean {
  if (formatCol === -1) return true;
  const hookTexts = rows.map((r) => r[hookCol]?.trim() ?? "").filter(Boolean);
  if (hookTexts.length === 0) return true;
  const avgLen = hookTexts.reduce((s, t) => s + t.length, 0) / hookTexts.length;
  if (avgLen < 20) return true;
  return false;
}

async function aiColumnHints(rows: string[][], numCols: number): Promise<ColMap> {
  const sample = rows
    .slice(0, 4)
    .map((r, i) => `Row ${i}: ${r.map((c, j) => `[${j}] ${c.slice(0, 60)}`).join("  |  ")}`)
    .join("\n");

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 80,
    messages: [{
      role: "user",
      content: `Google Sheet rows (${numCols} cols, 0-indexed):\n${sample}\n\nReturn ONLY JSON with column indices (-1 if absent): {"hookCol":N,"formatCol":N,"refCol":N,"captionCol":N,"notesCol":N}`,
    }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const match = raw.match(/\{[^}]+\}/);
  const parsed = match ? JSON.parse(match[0]) : {};
  return {
    hookCol:    typeof parsed.hookCol    === "number" ? parsed.hookCol    : 0,
    formatCol:  typeof parsed.formatCol  === "number" ? parsed.formatCol  : -1,
    refCol:     typeof parsed.refCol     === "number" ? parsed.refCol     : -1,
    captionCol: typeof parsed.captionCol === "number" ? parsed.captionCol : -1,
    notesCol:   typeof parsed.notesCol   === "number" ? parsed.notesCol   : -1,
  };
}

// ── Row merging & hook building ────────────────────────────────────────────

function mergeRows(rows: string[][], { hookCol, formatCol, refCol }: ColMap): string[][] {
  if (formatCol < 0) return rows;
  const merged: string[][] = [];
  for (const row of rows) {
    const hookText = row[hookCol]?.trim() ?? "";
    const formatVal = formatCol >= 0 ? row[formatCol]?.trim() ?? "" : "";
    const refVal = refCol >= 0 ? row[refCol]?.trim() ?? "" : "";
    const hasFormat = matchFormat(formatVal) !== null;
    const hasRef = looksLikeUrl(refVal);
    const hasText = hookText.length > 0;
    if (!hasFormat && !hasRef && hasText && merged.length > 0) {
      const prev = [...merged[merged.length - 1]];
      prev[hookCol] = (prev[hookCol] ?? "") + "\n" + hookText;
      merged[merged.length - 1] = prev;
    } else {
      merged.push(row);
    }
  }
  return merged;
}

function buildHooks(rows: string[][], colMap: ColMap) {
  const { hookCol, formatCol, refCol, captionCol, notesCol } = colMap;
  const processedRows = mergeRows(rows, colMap);

  return processedRows
    .map((r) => {
      const hookText = r[hookCol]?.trim() ?? "";
      if (hookText.length < 5) return null;
      if (/^(hook|hook text|text on screen)$/i.test(hookText)) return null;

      const formatRaw = formatCol >= 0 ? r[formatCol]?.trim() ?? "" : "";
      const format = matchFormat(formatRaw) ?? "Faceless";

      const refRaw = refCol >= 0 ? r[refCol]?.trim() ?? "" : "";
      const referenceVideo = looksLikeUrl(refRaw) ? refRaw : null;

      const caption = captionCol >= 0 ? r[captionCol]?.trim() ?? "" : "";
      const recordingNotes = notesCol >= 0 ? r[notesCol]?.trim() ?? "" : "";

      return { hookText, format, referenceVideo, caption, recordingNotes };
    })
    .filter(Boolean);
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rawText } = await req.json();
  if (!rawText?.trim()) return NextResponse.json({ hooks: [] });

  const allRows = parseTSV(rawText);
  if (allRows.length === 0) return NextResponse.json({ hooks: [] });

  const numCols = Math.max(...allRows.map((r) => r.length));

  // 1. Try header detection first — most reliable
  const headerMap = detectFromHeaders(allRows[0]);
  if (headerMap) {
    // Strip the header row from data rows
    const dataRows = allRows.slice(1).filter((r) => r.some((c) => c.length > 0));
    const hooks = buildHooks(dataRows, headerMap);
    return NextResponse.json({ hooks });
  }

  // 2. Heuristic column detection
  const allDataRows = allRows;
  let colMap = heuristicColumns(allDataRows, numCols);

  // 3. AI fallback when heuristics look unreliable
  if (needsAiFallback(allDataRows, colMap.hookCol, colMap.formatCol)) {
    try {
      colMap = await aiColumnHints(allDataRows, numCols);
    } catch {
      // AI failed — proceed with heuristics
    }
  }

  const hooks = buildHooks(allDataRows, colMap);
  return NextResponse.json({ hooks });
}
